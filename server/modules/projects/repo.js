import { getDb } from '../../db/index.js';

export const projectsRepo = {
  createProject({
    id,
    workspaceId,
    name,
    description = '',
    visibility = 'workspace',
    priority = 'none',
    startDate = null,
    deadline = null,
    ownerId,
    version = 1,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO projects (
        id, workspace_id, name, description, visibility, priority,
        start_date, deadline, owner_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      workspaceId,
      name,
      description,
      visibility,
      priority,
      startDate,
      deadline,
      ownerId,
      version,
      createdAt,
      updatedAt
    );

    return this.findProjectById(id);
  },

  findProjectById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, u.name as owner_name, u.email as owner_email, u.avatar_path as owner_avatar_url
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `).get(id);
  },

  listProjects(workspaceId, { archived = 'false', search = null } = {}) {
    const db = getDb();
    const conditions = ['p.workspace_id = ?'];
    const params = [workspaceId];

    if (archived === 'false') {
      conditions.push('p.archived_at IS NULL');
    } else if (archived === 'true') {
      conditions.push('p.archived_at IS NOT NULL');
    }

    if (search && search.trim()) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern);
    }

    const sql = `
      SELECT p.*, u.name as owner_name, u.email as owner_email, u.avatar_path as owner_avatar_url,
             (SELECT count(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.created_at DESC
    `;

    return db.prepare(sql).all(...params);
  },

  updateProject(id, updates, expectedVersion, now = new Date().toISOString()) {
    const db = getDb();
    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.visibility !== undefined) {
      fields.push('visibility = ?');
      params.push(updates.visibility);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      params.push(updates.priority);
    }
    if (updates.startDate !== undefined) {
      fields.push('start_date = ?');
      params.push(updates.startDate);
    }
    if (updates.deadline !== undefined) {
      fields.push('deadline = ?');
      params.push(updates.deadline);
    }

    fields.push('version = version + 1');
    fields.push('updated_at = ?');
    params.push(now);

    params.push(id, expectedVersion);

    const result = db.prepare(`
      UPDATE projects
      SET ${fields.join(', ')}
      WHERE id = ? AND version = ?
    `).run(...params);

    return result.changes;
  },

  setArchived(id, archivedAt, expectedVersion, now = new Date().toISOString()) {
    const db = getDb();
    const result = db.prepare(`
      UPDATE projects
      SET archived_at = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(archivedAt, now, id, expectedVersion);

    return result.changes;
  },

  deleteProject(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  },

  addProjectMember(projectId, userId, role = 'member', addedAt = new Date().toISOString()) {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO project_members (project_id, user_id, role, added_at)
      VALUES (?, ?, ?, ?)
    `).run(projectId, userId, role, addedAt);
  },

  findProjectMember(projectId, userId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM project_members
      WHERE project_id = ? AND user_id = ?
    `).get(projectId, userId);
  },

  updateProjectMemberRole(projectId, userId, role) {
    const db = getDb();
    const result = db.prepare(`
      UPDATE project_members
      SET role = ?
      WHERE project_id = ? AND user_id = ?
    `).run(role, projectId, userId);

    return result.changes > 0;
  },

  removeProjectMember(projectId, userId) {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM project_members
      WHERE project_id = ? AND user_id = ?
    `).run(projectId, userId);

    return result.changes > 0;
  },

  listProjectMembers(projectId) {
    const db = getDb();
    return db.prepare(`
      SELECT pm.project_id, pm.user_id, pm.role, pm.added_at,
             u.id, u.name, u.email, u.avatar_path as avatar_url
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY pm.added_at ASC
    `).all(projectId);
  },

  getProjectStats(projectId) {
    const db = getDb();
    // Check if tasks table exists (tasks are added in Phase 6)
    const hasTasks = db.prepare(`
      SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tasks'
    `).get();

    if (!hasTasks) {
      return { totalTasks: 0, completedTasks: 0, progress: 0 };
    }

    const row = db.prepare(`
      SELECT
        count(*) as total,
        sum(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed
      FROM tasks
      WHERE project_id = ? AND archived_at IS NULL
    `).get(projectId);

    const total = row ? Number(row.total || 0) : 0;
    const completed = row ? Number(row.completed || 0) : 0;
    const progress = total > 0 ? Math.round((completed * 100) / total) : 0;

    return { totalTasks: total, completedTasks: completed, progress };
  },

  listProjectActivity(projectId, { cursor = null, limit = 20 } = {}) {
    const db = getDb();
    const conditions = ['a.project_id = ?'];
    const params = [projectId];

    if (cursor) {
      conditions.push('a.created_at < ?');
      params.push(cursor);
    }

    params.push(limit + 1);

    const rows = db.prepare(`
      SELECT a.*, u.name as actor_name, u.email as actor_email, u.avatar_path as actor_avatar_url
      FROM activity_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(...params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

    return {
      items: items.map(formatActivityRow),
      nextCursor,
    };
  },

  listWorkspaceActivity(workspaceId, { cursor = null, limit = 20 } = {}) {
    const db = getDb();
    const conditions = ['a.workspace_id = ?'];
    const params = [workspaceId];

    if (cursor) {
      conditions.push('a.created_at < ?');
      params.push(cursor);
    }

    params.push(limit + 1);

    const rows = db.prepare(`
      SELECT a.*, u.name as actor_name, u.email as actor_email, u.avatar_path as actor_avatar_url
      FROM activity_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(...params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

    return {
      items: items.map(formatActivityRow),
      nextCursor,
    };
  },
};

function formatActivityRow(row) {
  let metadata = {};
  try {
    metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
  } catch {
    metadata = {};
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    metadata,
    createdAt: row.created_at,
    actor: row.actor_id ? {
      id: row.actor_id,
      name: row.actor_name,
      email: row.actor_email,
      avatarUrl: row.actor_avatar_url,
    } : null,
  };
}
