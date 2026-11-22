import { getDb } from '../../db/index.js';
import { generateId } from '../../lib/ids.js';

export const attachmentsRepo = {
  createAttachment({
    id = generateId(),
    taskId,
    uploaderId,
    fileName,
    fileSize,
    mimeType,
    storagePath,
    createdAt = new Date().toISOString(),
  }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO attachments (id, task_id, uploader_id, file_name, file_size, mime_type, storage_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, taskId, uploaderId, fileName, fileSize, mimeType, storagePath, createdAt);

    return this.findAttachmentById(id);
  },

  findAttachmentById(id) {
    const db = getDb();
    const row = db.prepare(`
      SELECT a.*,
             u.name as uploader_name, u.email as uploader_email,
             t.project_id, p.workspace_id, p.visibility as project_visibility
      FROM attachments a
      JOIN users u ON a.uploader_id = u.id
      JOIN tasks t ON a.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE a.id = ?
    `).get(id);

    return row ? formatAttachmentRow(row) : null;
  },

  listAttachmentsForTask(taskId) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT a.*,
             u.name as uploader_name, u.email as uploader_email,
             t.project_id, p.workspace_id, p.visibility as project_visibility
      FROM attachments a
      JOIN users u ON a.uploader_id = u.id
      JOIN tasks t ON a.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
    `).all(taskId);

    return rows.map(formatAttachmentRow);
  },

  deleteAttachment(id) {
    const db = getDb();
    db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
  },
};

function formatAttachmentRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    uploaderId: row.uploader_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    uploader: {
      id: row.uploader_id,
      name: row.uploader_name,
      email: row.uploader_email,
    },
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    projectVisibility: row.project_visibility,
  };
}
