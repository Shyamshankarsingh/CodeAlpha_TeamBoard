import { getDb } from '../../db/index.js';
import { tasksRepo } from './repo.js';
import { boardsRepo } from '../boards/repo.js';
import { projectsRepo } from '../projects/repo.js';
import { workspacesRepo } from '../workspaces/repo.js';
import { permissions } from '../../lib/permissions.js';
import { between } from '../../lib/position.js';
import { generateId } from '../../lib/ids.js';
import { AppError } from '../../lib/errors.js';
import { events } from '../../lib/events.js';
import { logActivity } from '../../lib/activity.js';

export const tasksService = {
  createTask(userId, columnId, data) {
    const column = boardsRepo.findColumnById(columnId);
    if (!column) {
      throw new AppError('NOT_FOUND', 404, 'Column not found');
    }

    const membership = workspacesRepo.findMembership(column.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Column not found');
    }

    const projectMembership = projectsRepo.findProjectMember(column.project_id, userId);
    if (!permissions.canCreateTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    let position;
    if (data.prevPosition !== undefined || data.nextPosition !== undefined) {
      position = between(data.prevPosition, data.nextPosition);
    } else {
      const existing = tasksRepo.listTasksForColumn(columnId);
      const last = existing.length > 0 ? existing[existing.length - 1].position : null;
      position = between(last, null);
    }

    const completedAt = column.category === 'done' ? new Date().toISOString() : null;

    const db = getDb();
    let task;

    const execute = db.transact(() => {
      task = tasksRepo.createTask({
        projectId: column.project_id,
        boardId: column.board_id,
        columnId,
        title: data.title,
        description: data.description || '',
        priority: data.priority || 'none',
        reporterId: userId,
        position,
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
        completedAt,
      });

      // TK-11: Creator auto-watches task
      tasksRepo.addWatcher(task.id, userId);

      logActivity(db, {
        workspaceId: column.workspace_id,
        projectId: column.project_id,
        actorId: userId,
        entityType: 'task',
        entityId: task.id,
        action: 'task.created',
        metadata: { title: task.title, columnId },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('task.created', {
        workspaceId: column.workspace_id,
        projectId: column.project_id,
        columnId,
        taskId: task.id,
        actorId: userId,
      });
    });

    return tasksRepo.findTaskById(task.id);
  },

  getTask(userId, taskId) {
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

    return task;
  },

  listProjectTasks(userId, projectId, query) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMember = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewProject(membership.role, project.visibility, Boolean(projectMember))) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    return tasksRepo.listFilteredProjectTasks(projectId, query);
  },

  updateTask(userId, taskId, updates) {
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

    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      const changes = tasksRepo.updateTask(taskId, updates, updates.expectedVersion);
      if (changes === 0) {
        const current = tasksRepo.findTaskById(taskId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Task not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Task was modified by another user. Please reload.'
        );
      }

      updated = tasksRepo.findTaskById(taskId);

      logActivity(db, {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        entityType: 'task',
        entityId: taskId,
        action: 'task.updated',
        metadata: { updates },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('task.updated', {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        actorId: userId,
      });
    });

    return updated;
  },

  moveTask(userId, taskId, { columnId: targetColId, prevPosition = null, nextPosition = null, targetPosition = null, expectedVersion }) {
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

    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    let completedAt = undefined;
    if (targetColId && targetColId !== task.columnId) {
      const targetCol = boardsRepo.findColumnById(targetColId);
      if (!targetCol) {
        throw new AppError('NOT_FOUND', 404, 'Target column not found');
      }

      // TK-13: Invariant check - column must belong to the same project
      if (targetCol.project_id !== task.projectId) {
        throw new AppError('INVALID_COLUMN', 400, 'Cannot move task to a column in a different project');
      }

      // TK-5: Moving to done sets completed_at, moving out clears it
      if (targetCol.category === 'done' && task.columnCategory !== 'done') {
        completedAt = new Date().toISOString();
      } else if (targetCol.category !== 'done' && task.columnCategory === 'done') {
        completedAt = null;
      }
    }

    const newPosition = targetPosition || between(prevPosition, nextPosition);

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      const changes = tasksRepo.moveTask(
        taskId,
        {
          columnId: targetColId,
          position: newPosition,
          completedAt,
        },
        expectedVersion
      );

      if (changes === 0) {
        const current = tasksRepo.findTaskById(taskId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Task not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Task was modified by another user. Please reload.'
        );
      }

      updated = tasksRepo.findTaskById(taskId);

      logActivity(db, {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        entityType: 'task',
        entityId: taskId,
        action: 'task.moved',
        metadata: {
          fromColumnId: task.columnId,
          toColumnId: targetColId || task.columnId,
          position: newPosition,
        },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('task.moved', {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        columnId: targetColId || task.columnId,
        position: newPosition,
        actorId: userId,
      });
    });

    return updated;
  },

  duplicateTask(userId, taskId) {
    const original = tasksRepo.findTaskById(taskId);
    if (!original) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const membership = workspacesRepo.findMembership(original.workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const projectMembership = projectsRepo.findProjectMember(original.projectId, userId);
    if (!permissions.canViewProject(membership.role, original.projectVisibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    if (!permissions.canCreateTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const newPosition = between(original.position, null);
    const db = getDb();
    let duplicated;

    const execute = db.transact(() => {
      duplicated = tasksRepo.createTask({
        projectId: original.projectId,
        boardId: original.boardId,
        columnId: original.columnId,
        title: `${original.title} (Copy)`,
        description: original.description,
        priority: original.priority,
        reporterId: userId,
        position: newPosition,
        startDate: original.startDate,
        dueDate: original.dueDate,
        completedAt: original.completedAt,
      });

      // Clone assignees
      const assigneeIds = original.assignees.map((a) => a.id);
      if (assigneeIds.length > 0) {
        tasksRepo.setTaskAssignees(duplicated.id, assigneeIds);
      }

      // Clone labels
      const labelIds = original.labels.map((l) => l.id);
      if (labelIds.length > 0) {
        tasksRepo.setTaskLabels(duplicated.id, labelIds);
      }

      // Clone subtasks
      for (const sub of original.subtasks) {
        tasksRepo.createSubtask({
          taskId: duplicated.id,
          title: sub.title,
          position: sub.position,
        });
      }

      // Creator auto-watches
      tasksRepo.addWatcher(duplicated.id, userId);

      logActivity(db, {
        workspaceId: original.workspaceId,
        projectId: original.projectId,
        actorId: userId,
        entityType: 'task',
        entityId: duplicated.id,
        action: 'task.duplicated',
        metadata: { originalTaskId: original.id },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('task.created', {
        workspaceId: original.workspaceId,
        projectId: original.projectId,
        columnId: original.columnId,
        taskId: duplicated.id,
        actorId: userId,
      });
    });

    return tasksRepo.findTaskById(duplicated.id);
  },

  archiveTask(userId, taskId, { expectedVersion }) {
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

    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      const now = new Date().toISOString();
      const changes = tasksRepo.setArchived(taskId, now, expectedVersion);
      if (changes === 0) {
        const current = tasksRepo.findTaskById(taskId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Task not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Task was modified by another user. Please reload.'
        );
      }

      updated = tasksRepo.findTaskById(taskId);

      logActivity(db, {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        entityType: 'task',
        entityId: taskId,
        action: 'task.archived',
        metadata: {},
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('task.archived', {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        actorId: userId,
      });
    });

    return updated;
  },

  unarchiveTask(userId, taskId, { expectedVersion }) {
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

    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      const changes = tasksRepo.setArchived(taskId, null, expectedVersion);
      if (changes === 0) {
        const current = tasksRepo.findTaskById(taskId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Task not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Task was modified by another user. Please reload.'
        );
      }

      updated = tasksRepo.findTaskById(taskId);

      logActivity(db, {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        entityType: 'task',
        entityId: taskId,
        action: 'task.unarchived',
        metadata: {},
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('task.unarchived', {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        actorId: userId,
      });
    });

    return updated;
  },

  deleteTask(userId, taskId) {
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

    const canDelete = permissions.canDeleteTask(
      membership.role,
      projectMembership?.role,
      task.reporterId,
      userId
    );

    if (!canDelete) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    const execute = db.transact(() => {
      tasksRepo.deleteTask(taskId);

      logActivity(db, {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        entityType: 'task',
        entityId: taskId,
        action: 'task.deleted',
        metadata: { title: task.title },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('task.deleted', {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        actorId: userId,
      });
    });

    return { success: true };
  },

  // Assignees
  updateAssignees(userId, taskId, userIds) {
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

    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // TK-6: Validate all assignees belong to workspace
    for (const uid of userIds) {
      const wsMember = workspacesRepo.findMembership(task.workspaceId, uid);
      if (!wsMember) {
        throw new AppError('INVALID_ASSIGNEE', 400, `User ${uid} is not a member of this workspace`);
      }
    }

    const previousUserIds = (task.assignees || []).map((a) => a.id);

    const db = getDb();
    const execute = db.transact(() => {
      tasksRepo.setTaskAssignees(taskId, userIds);

      // Auto-watch for all assignees
      for (const uid of userIds) {
        tasksRepo.addWatcher(taskId, uid);
      }

      logActivity(db, {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        entityType: 'task',
        entityId: taskId,
        action: 'task.assignees_updated',
        metadata: { userIds },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('task.updated', {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        actorId: userId,
      });

      events.emitEvent('task.assignees_changed', {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        taskTitle: task.title,
        actorId: userId,
        previousUserIds,
        newUserIds: userIds,
      });
    });

    return tasksRepo.getTaskAssignees(taskId);
  },

  // Labels
  updateLabels(userId, taskId, labelIds) {
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

    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // TK-8: Cross-project label rejection
    for (const lid of labelIds) {
      const label = tasksRepo.findLabelById(lid);
      if (!label || label.project_id !== task.projectId) {
        throw new AppError('CROSS_PROJECT_LABEL', 400, 'Labels must belong to the same project');
      }
    }

    const db = getDb();
    const execute = db.transact(() => {
      tasksRepo.setTaskLabels(taskId, labelIds);

      logActivity(db, {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        actorId: userId,
        entityType: 'task',
        entityId: taskId,
        action: 'task.labels_updated',
        metadata: { labelIds },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('task.updated', {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId,
        actorId: userId,
      });
    });

    return tasksRepo.getTaskLabels(taskId);
  },

  listProjectLabels(userId, projectId) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewProject(membership.role, project.visibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    return tasksRepo.listProjectLabels(projectId);
  },

  createLabel(userId, projectId, { name, color }) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    return tasksRepo.createLabel({ projectId, name, color });
  },

  deleteLabel(userId, labelId) {
    const label = tasksRepo.findLabelById(labelId);
    if (!label) {
      throw new AppError('NOT_FOUND', 404, 'Label not found');
    }

    const project = projectsRepo.findProjectById(label.project_id);
    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    tasksRepo.deleteLabel(labelId);
    return { success: true };
  },

  // Subtasks
  createSubtask(userId, taskId, { title }) {
    const task = tasksRepo.findTaskById(taskId);
    if (!task) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const membership = workspacesRepo.findMembership(task.workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const existing = tasksRepo.getSubtasks(taskId);
    const last = existing.length > 0 ? existing[existing.length - 1].position : null;
    const position = between(last, null);

    const subtask = tasksRepo.createSubtask({
      taskId,
      title,
      position,
    });

    return subtask;
  },

  updateSubtask(userId, subtaskId, updates) {
    const subtask = tasksRepo.findSubtaskById(subtaskId);
    if (!subtask) {
      throw new AppError('NOT_FOUND', 404, 'Subtask not found');
    }

    const membership = workspacesRepo.findMembership(subtask.workspace_id, userId);
    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    tasksRepo.updateSubtask(subtaskId, updates);
    return tasksRepo.findSubtaskById(subtaskId);
  },

  moveSubtask(userId, subtaskId, { prevPosition = null, nextPosition = null }) {
    const subtask = tasksRepo.findSubtaskById(subtaskId);
    if (!subtask) {
      throw new AppError('NOT_FOUND', 404, 'Subtask not found');
    }

    const membership = workspacesRepo.findMembership(subtask.workspace_id, userId);
    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const newPosition = between(prevPosition, nextPosition);
    tasksRepo.moveSubtask(subtaskId, newPosition);
    return tasksRepo.findSubtaskById(subtaskId);
  },

  deleteSubtask(userId, subtaskId) {
    const subtask = tasksRepo.findSubtaskById(subtaskId);
    if (!subtask) {
      throw new AppError('NOT_FOUND', 404, 'Subtask not found');
    }

    const membership = workspacesRepo.findMembership(subtask.workspace_id, userId);
    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    tasksRepo.deleteSubtask(subtaskId);
    return { success: true };
  },

  // Watchers
  watchTask(userId, taskId) {
    const task = tasksRepo.findTaskById(taskId);
    if (!task) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const membership = workspacesRepo.findMembership(task.workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    tasksRepo.addWatcher(taskId, userId);
    return { success: true };
  },

  unwatchTask(userId, taskId) {
    tasksRepo.removeWatcher(taskId, userId);
    return { success: true };
  },

  // Bulk Operations
  bulkAction(userId, projectId, { taskIds, action, columnId, assigneeIds }) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const workspaceId = project.workspace_id || project.workspaceId;
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const projMember = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewProject(membership.role, project.visibility, projMember)) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    if (!permissions.canEditTask(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    let updatedCount = 0;

    const execute = db.transact(() => {
      // Filter tasks belonging to project
      const validTaskIds = taskIds.filter(id => {
        const t = tasksRepo.findTaskById(id);
        return t && t.projectId === projectId;
      });

      if (action === 'move' && columnId) {
        const col = boardsRepo.findColumnById(columnId);
        if (col && col.project_id === projectId) {
          const completedAt = col.category === 'done' ? new Date().toISOString() : null;
          updatedCount = tasksRepo.bulkMoveTasks(validTaskIds, columnId, completedAt);
        }
      } else if (action === 'archive') {
        updatedCount = tasksRepo.bulkArchiveTasks(validTaskIds, new Date().toISOString());
      } else if (action === 'delete') {
        const allowedTaskIds = validTaskIds.filter(id => {
          const t = tasksRepo.findTaskById(id);
          return permissions.canDeleteTask(membership.role, projMember?.role, t.reporterId, userId);
        });
        updatedCount = tasksRepo.bulkDeleteTasks(allowedTaskIds);
      } else if (action === 'assign' && assigneeIds) {
        for (const taskId of validTaskIds) {
          tasksRepo.setTaskAssignees(taskId, assigneeIds);
          updatedCount++;
        }
      }
    });

    execute();
    return { success: true, count: updatedCount };
  },
};
