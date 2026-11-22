import { getDb } from '../../db/index.js';
import { generateId } from '../../lib/ids.js';

function formatNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    actor: row.actor_id
      ? {
          id: row.actor_id,
          name: row.actor_name,
          avatarUrl: row.actor_avatar_path ? `/uploads/avatars/${row.actor_avatar_path}` : null,
        }
      : null,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export const notificationsRepo = {
  createNotification({
    id = generateId(),
    userId,
    actorId = null,
    type,
    title,
    body,
    entityType = null,
    entityId = null,
    workspaceId = null,
    projectId = null,
    createdAt = new Date().toISOString(),
  }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO notifications (
        id, user_id, actor_id, type, title, body, entity_type, entity_id, workspace_id, project_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      actorId,
      type,
      title,
      body,
      entityType,
      entityId,
      workspaceId,
      projectId,
      createdAt
    );

    return this.findNotificationById(id);
  },

  findNotificationById(id) {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT 
          n.*,
          u.name AS actor_name,
          u.avatar_path AS actor_avatar_path
        FROM notifications n
        LEFT JOIN users u ON n.actor_id = u.id
        WHERE n.id = ?
      `)
      .get(id);

    return formatNotification(row);
  },

  listNotifications(userId, { limit = 20, cursor = null, unreadOnly = false } = {}) {
    const db = getDb();
    const conditions = ['n.user_id = ?'];
    const params = [userId];

    if (unreadOnly) {
      conditions.push('n.read_at IS NULL');
    }

    if (cursor) {
      conditions.push('n.created_at < ?');
      params.push(cursor);
    }

    params.push(limit + 1);

    const rows = db
      .prepare(`
        SELECT 
          n.*,
          u.name AS actor_name,
          u.avatar_path AS actor_avatar_path
        FROM notifications n
        LEFT JOIN users u ON n.actor_id = u.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY n.created_at DESC
        LIMIT ?
      `)
      .all(...params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

    return {
      items: items.map(formatNotification),
      nextCursor,
      hasMore,
    };
  },

  countUnread(userId) {
    const db = getDb();
    const row = db
      .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL')
      .get(userId);
    return row ? row.count : 0;
  },

  markAsRead(id, userId, now = new Date().toISOString()) {
    const db = getDb();
    const result = db
      .prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL')
      .run(now, id, userId);
    return result.changes > 0;
  },

  markAllAsRead(userId, now = new Date().toISOString()) {
    const db = getDb();
    const result = db
      .prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
      .run(now, userId);
    return result.changes;
  },

  deleteNotification(id, userId) {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return result.changes > 0;
  },

  existsNotification(userId, type, entityId) {
    const db = getDb();
    const row = db
      .prepare('SELECT 1 FROM notifications WHERE user_id = ? AND type = ? AND entity_id = ? LIMIT 1')
      .get(userId, type, entityId);
    return Boolean(row);
  },

  getUserNotificationPrefs(userId) {
    const db = getDb();
    const row = db.prepare('SELECT notification_prefs FROM users WHERE id = ?').get(userId);
    if (!row || !row.notification_prefs) return {};
    try {
      return JSON.parse(row.notification_prefs);
    } catch {
      return {};
    }
  },

  findTasksDueSoon() {
    const db = getDb();
    return db
      .prepare(`
        SELECT 
          t.id, t.title, t.due_date, t.project_id, p.workspace_id
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.due_date IS NOT NULL
          AND t.completed_at IS NULL
          AND t.archived_at IS NULL
          AND date(t.due_date) <= date('now', '+1 day')
          AND date(t.due_date) >= date('now')
      `)
      .all();
  },

  findTasksOverdue() {
    const db = getDb();
    return db
      .prepare(`
        SELECT 
          t.id, t.title, t.due_date, t.project_id, p.workspace_id
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.due_date IS NOT NULL
          AND t.completed_at IS NULL
          AND t.archived_at IS NULL
          AND date(t.due_date) < date('now')
      `)
      .all();
  },

  getTaskAssigneeIds(taskId) {
    const db = getDb();
    const rows = db.prepare('SELECT user_id FROM task_assignees WHERE task_id = ?').all(taskId);
    return rows.map((r) => r.user_id);
  },

  getTaskWatcherIds(taskId) {
    const db = getDb();
    const rows = db.prepare('SELECT user_id FROM task_watchers WHERE task_id = ?').all(taskId);
    return rows.map((r) => r.user_id);
  },
};
