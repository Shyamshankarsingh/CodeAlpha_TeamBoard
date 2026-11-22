import { generateId } from './ids.js';

export function logActivity(db, {
  workspaceId,
  projectId = null,
  actorId = null,
  entityType,
  entityId,
  action,
  metadata = {},
}) {
  const id = generateId();
  const now = new Date().toISOString();
  const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

  db.prepare(`
    INSERT INTO activity_logs (id, workspace_id, project_id, actor_id, entity_type, entity_id, action, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, workspaceId, projectId, actorId, entityType, entityId, action, metaStr, now);

  return id;
}
