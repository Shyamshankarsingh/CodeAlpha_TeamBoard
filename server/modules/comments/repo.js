import { getDb } from '../../db/index.js';
import { generateId } from '../../lib/ids.js';

export const commentsRepo = {
  createComment({
    id = generateId(),
    taskId,
    userId,
    parentId = null,
    body,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO comments (id, task_id, user_id, parent_id, body, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, taskId, userId, parentId, body, createdAt, updatedAt);

    return this.findCommentById(id);
  },

  findCommentById(id) {
    const db = getDb();
    const row = db.prepare(`
      SELECT c.*,
             u.id as author_id, u.name as author_name, u.email as author_email, u.avatar_path as author_avatar_url,
             t.project_id, p.workspace_id, p.visibility as project_visibility
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN tasks t ON c.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE c.id = ?
    `).get(id);

    return row ? formatCommentRow(row) : null;
  },

  listCommentsForTask(taskId) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.*,
             u.id as author_id, u.name as author_name, u.email as author_email, u.avatar_path as author_avatar_url,
             t.project_id, p.workspace_id, p.visibility as project_visibility
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN tasks t ON c.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `).all(taskId);

    return rows.map(formatCommentRow);
  },

  countReplies(commentId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT count(*) as count FROM comments WHERE parent_id = ? AND deleted_at IS NULL
    `).get(commentId);
    return row ? Number(row.count) : 0;
  },

  updateComment(id, body, expectedVersion, now = new Date().toISOString()) {
    const db = getDb();
    const result = db.prepare(`
      UPDATE comments
      SET body = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(body, now, id, expectedVersion);

    return result.changes;
  },

  softDeleteComment(id, now = new Date().toISOString(), placeholder = '[Comment deleted]') {
    const db = getDb();
    const result = db.prepare(`
      UPDATE comments
      SET body = ?, deleted_at = ?, version = version + 1, updated_at = ?
      WHERE id = ?
    `).run(placeholder, now, now, id);

    return result.changes > 0;
  },

  hardDeleteComment(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

function formatCommentRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    parentId: row.parent_id,
    body: row.body,
    deletedAt: row.deleted_at,
    isDeleted: Boolean(row.deleted_at),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    projectVisibility: row.project_visibility,
    author: {
      id: row.author_id,
      name: row.author_name,
      email: row.author_email,
      avatarUrl: row.author_avatar_url,
    },
  };
}
