import { notificationsRepo } from './repo.js';
import { events } from '../../lib/events.js';
import { AppError } from '../../lib/errors.js';
import { nowIso } from '../../lib/time.js';

let listenersInitialized = false;

export const notificationsService = {
  getUserNotifications(userId, query) {
    return notificationsRepo.listNotifications(userId, query);
  },

  getUnreadCount(userId) {
    return {
      unreadCount: notificationsRepo.countUnread(userId),
    };
  },

  markNotificationRead(userId, id) {
    const notification = notificationsRepo.findNotificationById(id);
    if (!notification || notification.userId !== userId) {
      throw new AppError('NOT_FOUND', 404, 'Notification not found');
    }

    const now = nowIso();
    notificationsRepo.markAsRead(id, userId, now);

    events.emitEvent('notification.read', {
      userId,
      id,
      readAt: now,
    });

    return {
      id,
      readAt: now,
    };
  },

  markAllNotificationsRead(userId) {
    const now = nowIso();
    const count = notificationsRepo.markAllAsRead(userId, now);

    events.emitEvent('notification.read_all', {
      userId,
      readAt: now,
    });

    return {
      success: true,
      updatedCount: count,
    };
  },

  deleteNotification(userId, id) {
    const notification = notificationsRepo.findNotificationById(id);
    if (!notification || notification.userId !== userId) {
      throw new AppError('NOT_FOUND', 404, 'Notification not found');
    }

    notificationsRepo.deleteNotification(id, userId);
    return { success: true };
  },

  createNotification({
    userId,
    actorId = null,
    type,
    title,
    body,
    entityType = null,
    entityId = null,
    workspaceId = null,
    projectId = null,
  }) {
    // 1. Actor self-exclusion (FR-N2)
    if (actorId && actorId === userId) {
      return null;
    }

    // 2. User preferences check (FR-N4)
    const prefs = notificationsRepo.getUserNotificationPrefs(userId);
    if (prefs.inApp === false) {
      return null;
    }
    if (prefs[type] === false) {
      return null;
    }
    if (prefs.mentionsOnly === true && type !== 'comment_mention') {
      return null;
    }

    const created = notificationsRepo.createNotification({
      userId,
      actorId,
      type,
      title,
      body,
      entityType,
      entityId,
      workspaceId,
      projectId,
    });

    // 3. Emit domain event so real-time socket pushes to user:<userId>
    events.emitEvent('notification.created', {
      userId,
      data: created,
      notification: created,
    });

    return created;
  },

  // Background reminder & overdue jobs with idempotent deduplication (FR-N3)
  checkDueSoonTasks() {
    const tasks = notificationsRepo.findTasksDueSoon();
    const created = [];

    for (const task of tasks) {
      const assignees = notificationsRepo.getTaskAssigneeIds(task.id);
      for (const userId of assignees) {
        if (!notificationsRepo.existsNotification(userId, 'task_due_soon', task.id)) {
          const n = this.createNotification({
            userId,
            type: 'task_due_soon',
            title: 'Task Due Soon',
            body: `Task "${task.title}" is due soon`,
            entityType: 'task',
            entityId: task.id,
            workspaceId: task.workspace_id,
            projectId: task.project_id,
          });
          if (n) created.push(n);
        }
      }
    }

    return created;
  },

  checkOverdueTasks() {
    const tasks = notificationsRepo.findTasksOverdue();
    const created = [];

    for (const task of tasks) {
      const assignees = notificationsRepo.getTaskAssigneeIds(task.id);
      for (const userId of assignees) {
        if (!notificationsRepo.existsNotification(userId, 'task_overdue', task.id)) {
          const n = this.createNotification({
            userId,
            type: 'task_overdue',
            title: 'Task Overdue',
            body: `Task "${task.title}" is overdue`,
            entityType: 'task',
            entityId: task.id,
            workspaceId: task.workspace_id,
            projectId: task.project_id,
          });
          if (n) created.push(n);
        }
      }
    }

    return created;
  },

  setupNotificationListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    // 1. Task assignees changed
    events.on('task.assignees_changed', (payload) => {
      try {
        const { workspaceId, projectId, taskId, taskTitle, actorId, previousUserIds = [], newUserIds = [] } = payload;

        // Added assignees -> task_assigned
        const added = newUserIds.filter((id) => !previousUserIds.includes(id));
        for (const uid of added) {
          notificationsService.createNotification({
            userId: uid,
            actorId,
            type: 'task_assigned',
            title: 'Task Assigned',
            body: `You were assigned to "${taskTitle || 'a task'}"`,
            entityType: 'task',
            entityId: taskId,
            workspaceId,
            projectId,
          });
        }

        // Removed assignees -> task_unassigned
        const removed = previousUserIds.filter((id) => !newUserIds.includes(id));
        for (const uid of removed) {
          notificationsService.createNotification({
            userId: uid,
            actorId,
            type: 'task_unassigned',
            title: 'Task Unassigned',
            body: `You were unassigned from "${taskTitle || 'a task'}"`,
            entityType: 'task',
            entityId: taskId,
            workspaceId,
            projectId,
          });
        }
      } catch (err) {
        console.error('Error handling task.assignees_changed', err);
      }
    });

    // 2. Comment created -> mentions & watcher notifications
    events.on('comment.created', (payload) => {
      try {
        const { workspaceId, projectId, taskId, mentions = [], actorId } = payload;

        // Mentions -> comment_mention
        for (const uid of mentions) {
          notificationsService.createNotification({
            userId: uid,
            actorId,
            type: 'comment_mention',
            title: 'Mentioned in Comment',
            body: 'You were mentioned in a comment',
            entityType: 'task',
            entityId: taskId,
            workspaceId,
            projectId,
          });
        }

        // Watchers -> comment_created (excluding actor and mentioned users)
        const watchers = notificationsRepo.getTaskWatcherIds(taskId);
        for (const watcherId of watchers) {
          if (watcherId !== actorId && !mentions.includes(watcherId)) {
            notificationsService.createNotification({
              userId: watcherId,
              actorId,
              type: 'comment_created',
              title: 'New Comment',
              body: 'New comment on a task you are watching',
              entityType: 'task',
              entityId: taskId,
              workspaceId,
              projectId,
            });
          }
        }
      } catch (err) {
        console.error('Error handling comment.created', err);
      }
    });

    // 3. Project member added -> project_invitation
    events.on('project.member_added', (payload) => {
      try {
        const { workspaceId, projectId, userId, actorId } = payload;
        notificationsService.createNotification({
          userId,
          actorId,
          type: 'project_invitation',
          title: 'Added to Project',
          body: 'You were added as a member of a project',
          entityType: 'project',
          entityId: projectId,
          workspaceId,
          projectId,
        });
      } catch (err) {
        console.error('Error handling project.member_added', err);
      }
    });

    // 4. Project member updated -> role_changed
    events.on('project.member_updated', (payload) => {
      try {
        const { workspaceId, projectId, userId, role, actorId } = payload;
        notificationsService.createNotification({
          userId,
          actorId,
          type: 'role_changed',
          title: 'Project Role Updated',
          body: `Your project role was updated to ${role}`,
          entityType: 'project',
          entityId: projectId,
          workspaceId,
          projectId,
        });
      } catch (err) {
        console.error('Error handling project.member_updated', err);
      }
    });

    // 5. Workspace member added -> workspace_invitation
    events.on('workspace.member_added', (payload) => {
      try {
        const { workspaceId, userId, actorId } = payload;
        notificationsService.createNotification({
          userId,
          actorId,
          type: 'workspace_invitation',
          title: 'Joined Workspace',
          body: 'You joined a workspace',
          entityType: 'workspace',
          entityId: workspaceId,
          workspaceId,
        });
      } catch (err) {
        console.error('Error handling workspace.member_added', err);
      }
    });

    // 6. Workspace member role changed -> role_changed
    events.on('workspace.member_role_changed', (payload) => {
      try {
        const { workspaceId, userId, role, actorId } = payload;
        notificationsService.createNotification({
          userId,
          actorId,
          type: 'role_changed',
          title: 'Workspace Role Updated',
          body: `Your workspace role was updated to ${role}`,
          entityType: 'workspace',
          entityId: workspaceId,
          workspaceId,
        });
      } catch (err) {
        console.error('Error handling workspace.member_role_changed', err);
      }
    });
  },
};

// Initialize listeners at module load
notificationsService.setupNotificationListeners();
