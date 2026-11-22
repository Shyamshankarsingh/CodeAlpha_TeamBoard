import { getDb } from '../../db/index.js';
import { generateId } from '../../lib/ids.js';

export const tasksRepo = {
  createTask({
    id = generateId(),
    projectId,
    boardId,
    columnId,
    title,
    description = '',
    priority = 'none',
    reporterId,
    position,
    startDate = null,
    dueDate = null,
    completedAt = null,
    version = 1,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO tasks (
        id, project_id, board_id, column_id, title, description,
        priority, reporter_id, position, start_date, due_date,
        completed_at, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      boardId,
      columnId,
      title,
      description,
      priority,
      reporterId,
      position,
      startDate,
      dueDate,
      completedAt,
      version,
      createdAt,
      updatedAt
    );

    return this.findTaskById(id);
  },

  findTaskById(id) {
    const db = getDb();
    const row = db.prepare(`
      SELECT t.*,
             c.name as column_name, c.category as column_category,
             p.workspace_id, p.visibility as project_visibility, p.name as project_name,
             u.name as reporter_name, u.email as reporter_email, u.avatar_path as reporter_avatar_url
      FROM tasks t
      JOIN board_columns c ON t.column_id = c.id
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON t.reporter_id = u.id
      WHERE t.id = ?
    `).get(id);

    if (!row) return null;
    return this.hydrateTask(row);
  },

  hydrateTask(row) {
    const assignees = this.getTaskAssignees(row.id);
    const labels = this.getTaskLabels(row.id);
    const subtasks = this.getSubtasks(row.id);
    const watchers = this.getWatchers(row.id);

    return {
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      workspaceId: row.workspace_id,
      projectVisibility: row.project_visibility,
      boardId: row.board_id,
      columnId: row.column_id,
      columnName: row.column_name,
      columnCategory: row.column_category,
      title: row.title,
      description: row.description,
      priority: row.priority,
      reporterId: row.reporter_id,
      reporter: {
        id: row.reporter_id,
        name: row.reporter_name,
        email: row.reporter_email,
        avatarUrl: row.reporter_avatar_url,
      },
      position: row.position,
      startDate: row.start_date,
      dueDate: row.due_date,
      completedAt: row.completed_at,
      archivedAt: row.archived_at,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      assignees,
      labels,
      subtasks,
      watchers,
    };
  },

  listTasksForBoard(boardId, includeArchived = false) {
    const db = getDb();
    const condition = includeArchived ? '' : 'AND t.archived_at IS NULL';

    const rows = db.prepare(`
      SELECT t.*,
             c.name as column_name, c.category as column_category,
             p.workspace_id, p.visibility as project_visibility, p.name as project_name,
             u.name as reporter_name, u.email as reporter_email, u.avatar_path as reporter_avatar_url
      FROM tasks t
      JOIN board_columns c ON t.column_id = c.id
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON t.reporter_id = u.id
      WHERE t.board_id = ? ${condition}
      ORDER BY t.position ASC
    `).all(boardId);

    return rows.map((r) => this.hydrateTask(r));
  },

  listTasksForColumn(columnId, includeArchived = false) {
    const db = getDb();
    const condition = includeArchived ? '' : 'AND t.archived_at IS NULL';

    const rows = db.prepare(`
      SELECT t.*,
             c.name as column_name, c.category as column_category,
             p.workspace_id, p.visibility as project_visibility, p.name as project_name,
             u.name as reporter_name, u.email as reporter_email, u.avatar_path as reporter_avatar_url
      FROM tasks t
      JOIN board_columns c ON t.column_id = c.id
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON t.reporter_id = u.id
      WHERE t.column_id = ? ${condition}
      ORDER BY t.position ASC
    `).all(columnId);

    return rows.map((r) => this.hydrateTask(r));
  },

  listFilteredProjectTasks(projectId, {
    search,
    columnId,
    category,
    priority,
    assigneeId,
    labelId,
    dueDate,
    includeArchived = false,
    sortBy = 'position',
    sortDir = 'asc',
    limit = 25,
    offset = 0,
  } = {}) {
    const db = getDb();
    const conditions = ['t.project_id = ?'];
    const params = [projectId];

    if (!includeArchived) {
      conditions.push('t.archived_at IS NULL');
    }

    if (columnId) {
      conditions.push('t.column_id = ?');
      params.push(columnId);
    }

    if (category) {
      conditions.push('c.category = ?');
      params.push(category);
    }

    if (priority) {
      conditions.push('t.priority = ?');
      params.push(priority);
    }

    if (assigneeId) {
      conditions.push('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
      params.push(assigneeId);
    }

    if (labelId) {
      conditions.push('EXISTS (SELECT 1 FROM task_labels tl WHERE tl.task_id = t.id AND tl.label_id = ?)');
      params.push(labelId);
    }

    if (dueDate === 'overdue') {
      conditions.push("t.due_date IS NOT NULL AND date(t.due_date) < date('now') AND t.completed_at IS NULL");
    } else if (dueDate === 'today') {
      conditions.push("t.due_date IS NOT NULL AND date(t.due_date) = date('now')");
    } else if (dueDate === 'this_week') {
      conditions.push("t.due_date IS NOT NULL AND date(t.due_date) >= date('now') AND date(t.due_date) <= date('now', '+7 days')");
    } else if (dueDate === 'none') {
      conditions.push('t.due_date IS NULL');
    }

    if (search && search.trim()) {
      conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countRow = db.prepare(`
      SELECT COUNT(*) AS total
      FROM tasks t
      JOIN board_columns c ON t.column_id = c.id
      WHERE ${whereClause}
    `).get(...params);
    const total = countRow ? countRow.total : 0;

    // Sorting allowlist
    let orderClause = 't.position ASC';
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

    if (sortBy === 'title') {
      orderClause = `t.title COLLATE NOCASE ${dir}`;
    } else if (sortBy === 'priority') {
      if (dir === 'ASC') {
        orderClause = `
          CASE t.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END ASC, t.position ASC
        `;
      } else {
        orderClause = `
          CASE t.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END DESC, t.position ASC
        `;
      }
    } else if (sortBy === 'due_date') {
      orderClause = `CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ${dir}, t.position ASC`;
    } else if (sortBy === 'created_at') {
      orderClause = `t.created_at ${dir}`;
    } else {
      orderClause = `t.position ${dir}`;
    }

    const queryParams = [...params, limit, offset];
    const rows = db.prepare(`
      SELECT t.*,
             c.name as column_name, c.category as column_category,
             p.workspace_id, p.visibility as project_visibility, p.name as project_name,
             u.name as reporter_name, u.email as reporter_email, u.avatar_path as reporter_avatar_url
      FROM tasks t
      JOIN board_columns c ON t.column_id = c.id
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON t.reporter_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `).all(...queryParams);

    const tasks = rows.map((r) => this.hydrateTask(r));

    return {
      tasks,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + tasks.length < total,
      },
    };
  },

  updateTask(id, updates, expectedVersion, now = new Date().toISOString()) {
    const db = getDb();
    const fields = [];
    const params = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      params.push(updates.priority);
    }
    if (updates.startDate !== undefined) {
      fields.push('start_date = ?');
      params.push(updates.startDate);
    }
    if (updates.dueDate !== undefined) {
      fields.push('due_date = ?');
      params.push(updates.dueDate);
    }

    fields.push('version = version + 1');
    fields.push('updated_at = ?');
    params.push(now);

    params.push(id, expectedVersion);

    const result = db.prepare(`
      UPDATE tasks
      SET ${fields.join(', ')}
      WHERE id = ? AND version = ?
    `).run(...params);

    return result.changes;
  },

  moveTask(id, { columnId, position, completedAt }, expectedVersion, now = new Date().toISOString()) {
    const db = getDb();
    const fields = ['position = ?', 'version = version + 1', 'updated_at = ?'];
    const params = [position, now];

    if (columnId !== undefined) {
      fields.push('column_id = ?');
      params.push(columnId);
    }

    if (completedAt !== undefined) {
      fields.push('completed_at = ?');
      params.push(completedAt);
    }

    params.push(id, expectedVersion);

    const result = db.prepare(`
      UPDATE tasks
      SET ${fields.join(', ')}
      WHERE id = ? AND version = ?
    `).run(...params);

    return result.changes;
  },

  setArchived(id, archivedAt, expectedVersion, now = new Date().toISOString()) {
    const db = getDb();
    const result = db.prepare(`
      UPDATE tasks
      SET archived_at = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(archivedAt, now, id, expectedVersion);

    return result.changes;
  },

  deleteTask(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return result.changes > 0;
  },

  // Assignees
  getTaskAssignees(taskId) {
    const db = getDb();
    return db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_path as avatar_url, ta.assigned_at
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
      ORDER BY ta.assigned_at ASC
    `).all(taskId);
  },

  setTaskAssignees(taskId, userIds) {
    const db = getDb();
    db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(taskId);
    if (userIds.length > 0) {
      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO task_assignees (task_id, user_id, assigned_at)
        VALUES (?, ?, ?)
      `);
      for (const uid of userIds) {
        insert.run(taskId, uid, now);
      }
    }
  },

  // Labels
  getTaskLabels(taskId) {
    const db = getDb();
    return db.prepare(`
      SELECT l.id, l.name, l.color
      FROM task_labels tl
      JOIN labels l ON tl.label_id = l.id
      WHERE tl.task_id = ?
      ORDER BY l.name ASC
    `).all(taskId);
  },

  setTaskLabels(taskId, labelIds) {
    const db = getDb();
    db.prepare('DELETE FROM task_labels WHERE task_id = ?').run(taskId);
    if (labelIds.length > 0) {
      const insert = db.prepare(`
        INSERT INTO task_labels (task_id, label_id)
        VALUES (?, ?)
      `);
      for (const lid of labelIds) {
        insert.run(taskId, lid);
      }
    }
  },

  listProjectLabels(projectId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM labels WHERE project_id = ? ORDER BY name ASC
    `).all(projectId);
  },

  findLabelById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM labels WHERE id = ?').get(id);
  },

  createLabel({ id = generateId(), projectId, name, color }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO labels (id, project_id, name, color)
      VALUES (?, ?, ?, ?)
    `).run(id, projectId, name, color);
    return this.findLabelById(id);
  },

  deleteLabel(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM labels WHERE id = ?').run(id);
    return result.changes > 0;
  },

  // Subtasks
  getSubtasks(taskId) {
    const db = getDb();
    return db.prepare(`
      SELECT id, task_id, title, completed, position, created_at, updated_at
      FROM subtasks
      WHERE task_id = ?
      ORDER BY position ASC
    `).all(taskId);
  },

  findSubtaskById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT s.*, t.project_id, p.workspace_id, p.visibility as project_visibility
      FROM subtasks s
      JOIN tasks t ON s.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE s.id = ?
    `).get(id);
  },

  createSubtask({ id = generateId(), taskId, title, position }) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO subtasks (id, task_id, title, completed, position, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `).run(id, taskId, title, position, now, now);
    return this.findSubtaskById(id);
  },

  updateSubtask(id, updates, now = new Date().toISOString()) {
    const db = getDb();
    const fields = ['updated_at = ?'];
    const params = [now];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.completed !== undefined) {
      fields.push('completed = ?');
      params.push(updates.completed ? 1 : 0);
    }

    params.push(id);

    const result = db.prepare(`
      UPDATE subtasks SET ${fields.join(', ')} WHERE id = ?
    `).run(...params);

    return result.changes > 0;
  },

  moveSubtask(id, position, now = new Date().toISOString()) {
    const db = getDb();
    const result = db.prepare(`
      UPDATE subtasks SET position = ?, updated_at = ? WHERE id = ?
    `).run(position, now, id);
    return result.changes > 0;
  },

  deleteSubtask(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
    return result.changes > 0;
  },

  // Watchers
  getWatchers(taskId) {
    const db = getDb();
    return db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_path as avatar_url, tw.created_at
      FROM task_watchers tw
      JOIN users u ON tw.user_id = u.id
      WHERE tw.task_id = ?
      ORDER BY tw.created_at ASC
    `).all(taskId);
  },

  addWatcher(taskId, userId) {
    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO task_watchers (task_id, user_id, created_at)
      VALUES (?, ?, ?)
    `).run(taskId, userId, new Date().toISOString());
  },

  removeWatcher(taskId, userId) {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM task_watchers WHERE task_id = ? AND user_id = ?
    `).run(taskId, userId);
    return result.changes > 0;
  },

  isWatcher(taskId, userId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT 1 FROM task_watchers WHERE task_id = ? AND user_id = ?
    `).get(taskId, userId);
    return Boolean(row);
  },
};
