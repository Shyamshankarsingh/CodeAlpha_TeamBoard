import { getDb } from '../../db/index.js';
import { commentsRepo } from './repo.js';
import { tasksRepo } from '../tasks/repo.js';
import { projectsRepo } from '../projects/repo.js';
import { workspacesRepo } from '../workspaces/repo.js';
import { permissions } from '../../lib/permissions.js';
import { AppError } from '../../lib/errors.js';
import { events } from '../../lib/events.js';
import { logActivity } from '../../lib/activity.js';

export const commentsService = {
  listComments(userId, taskId) {
    const task = tasksRepo.findTaskById(taskId);
    if (!task) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const membership = workspacesRepo.findMembership(task.workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const projectMembership = projectsRepo.findProjectMember(task.projectId, userId);
    if (!permissions.canViewProject(membership.role, task.projectVisibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const allComments = commentsRepo.listCommentsForTask(taskId);

    // Build 1-level threaded tree (FR-C1)
    const rootComments = [];
    const repliesMap = new Map();

    for (const comment of allComments) {
      if (comment.parentId) {
        if (!repliesMap.has(comment.parentId)) {
          repliesMap.set(comment.parentId, []);
        }
        repliesMap.get(comment.parentId).push(comment);
      } else {
        rootComments.push(comment);
      }
    }

    return rootComments.map((root) => ({
      ...root,
      replies: repliesMap.get(root.id) || [],
    }));
  },

  createComment(userId, taskId, { body, parentId = null, mentions = [] }) {
    const task = tasksRepo.findTaskById(taskId);
    if (!task) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const membership = workspacesRepo.findMembership(task.workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const projectMembership = projectsRepo.findProjectMember(task.projectId, userId);
    if (!permissions.canViewProject(membership.role, task.projectVisibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    if (!permissions.canCreateComment(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // FR-C1: 1-level nesting rule
    if (parentId) {
      const parent = commentsRepo.findCommentById(parentId);
      if (!parent || parent.taskId !== taskId) {
        throw new AppError('NOT_FOUND', 404, 'Parent comment not found');
      }
      if (parent.parentId !== null) {
        throw new AppError(
          'INVALID_NESTING',
          400,
          'Cannot reply to a reply; maximum 1 level of nesting allowed'
        );
      }
    }

    // FR-C4: Validate mentions belong to workspace
    for (const mentionUid of mentions) {
      const wsMember = workspacesRepo.findMembership(task.workspaceId, mentionUid);
      if (!wsMember) {
        throw new AppError('INVALID_MENTION', 400, `Mentioned user ${mentionUid} is not a member of this workspace`);
      }
    }

    const db = getDb();
    let comment;

    const execute = db.transact(() => {
      comment = commentsRepo.createComment({
        taskId,
        userId,
        parentId,
        body,
      });

      // Auto-watch: Commenter watches task
      tasksRepo.addWatcher(taskId, userId);

      // Auto-watch mentioned users
      for (const mentionUid of mentions) {
        tasksRepo.addWatcher(taskId, mentionUid);
      }

      logActivity(db, {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        entityType: 'comment',
        entityId: comment.id,
        action: 'comment.created',
        metadata: { taskId, parentId, mentionsCount: mentions.length },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('comment.created', {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        comment,
        mentions,
        actorId: userId,
      });
    });

    return comment;
  },

  updateComment(userId, commentId, { body, expectedVersion }) {
    const comment = commentsRepo.findCommentById(commentId);
    if (!comment) {
      throw new AppError('NOT_FOUND', 404, 'Comment not found');
    }

    const membership = workspacesRepo.findMembership(comment.workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Comment not found');
    }

    // Author edit only (FR-C2)
    if (!permissions.canEditComment(membership.role, comment.userId, userId)) {
      throw new AppError('FORBIDDEN', 403, 'Only the author can edit this comment');
    }

    if (comment.isDeleted) {
      throw new AppError('COMMENT_DELETED', 400, 'Cannot edit a deleted comment');
    }

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      const changes = commentsRepo.updateComment(commentId, body, expectedVersion);
      if (changes === 0) {
        const current = commentsRepo.findCommentById(commentId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Comment not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Comment was modified by another request. Please reload.'
        );
      }

      updated = commentsRepo.findCommentById(commentId);

      logActivity(db, {
        workspaceId: comment.workspaceId,
        projectId: comment.projectId,
        actorId: userId,
        entityType: 'comment',
        entityId: commentId,
        action: 'comment.updated',
        metadata: {},
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('comment.updated', {
        workspaceId: comment.workspaceId,
        projectId: comment.projectId,
        taskId: comment.taskId,
        commentId,
        actorId: userId,
      });
    });

    return updated;
  },

  deleteComment(userId, commentId) {
    const comment = commentsRepo.findCommentById(commentId);
    if (!comment) {
      throw new AppError('NOT_FOUND', 404, 'Comment not found');
    }

    const membership = workspacesRepo.findMembership(comment.workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Comment not found');
    }

    const projectMembership = projectsRepo.findProjectMember(comment.projectId, userId);
    const canDelete = permissions.canDeleteComment(
      membership.role,
      projectMembership?.role,
      comment.userId,
      userId
    );

    if (!canDelete) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // FR-C3: Soft delete if replies exist; hard delete otherwise
    const repliesCount = commentsRepo.countReplies(commentId);
    const isSoftDelete = repliesCount > 0;

    const db = getDb();
    const execute = db.transact(() => {
      if (isSoftDelete) {
        commentsRepo.softDeleteComment(commentId);
      } else {
        commentsRepo.hardDeleteComment(commentId);
      }

      logActivity(db, {
        workspaceId: comment.workspaceId,
        projectId: comment.projectId,
        actorId: userId,
        entityType: 'comment',
        entityId: commentId,
        action: 'comment.deleted',
        metadata: { isSoftDelete },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('comment.deleted', {
        workspaceId: comment.workspaceId,
        projectId: comment.projectId,
        taskId: comment.taskId,
        commentId,
        isSoftDelete,
        actorId: userId,
      });
    });

    return { success: true, softDeleted: isSoftDelete };
  },
};
