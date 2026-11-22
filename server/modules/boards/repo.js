import { getDb } from '../../db/index.js';
import { generateId } from '../../lib/ids.js';
import { generateInitialPositions, between } from '../../lib/position.js';

export const boardsRepo = {
  createDefaultBoard(db, projectId) {
    const boardId = generateId();
    const now = new Date().toISOString();
    const boardPosition = between(null, null);

    db.prepare(`
      INSERT INTO boards (id, project_id, name, position, version, created_at, updated_at)
      VALUES (?, ?, 'Kanban Board', ?, 1, ?, ?)
    `).run(boardId, projectId, boardPosition, now, now);

    const defaultColumns = [
      { name: 'Backlog', category: 'backlog' },
      { name: 'To Do', category: 'todo' },
      { name: 'In Progress', category: 'in_progress' },
      { name: 'In Review', category: 'review' },
      { name: 'Done', category: 'done' },
    ];

    const positions = generateInitialPositions(defaultColumns.length);

    const insertCol = db.prepare(`
      INSERT INTO board_columns (id, board_id, name, position, category, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);

    for (let i = 0; i < defaultColumns.length; i++) {
      const col = defaultColumns[i];
      insertCol.run(generateId(), boardId, col.name, positions[i], col.category, now, now);
    }

    return this.findBoardById(boardId);
  },

  createBoard({ id = generateId(), projectId, name, position = null }) {
    const db = getDb();
    const now = new Date().toISOString();

    let pos = position;
    if (!pos) {
      const last = db.prepare(`
        SELECT position FROM boards WHERE project_id = ? ORDER BY position DESC LIMIT 1
      `).get(projectId);
      pos = between(last ? last.position : null, null);
    }

    db.prepare(`
      INSERT INTO boards (id, project_id, name, position, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(id, projectId, name, pos, now, now);

    return this.findBoardById(id);
  },

  findBoardById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT b.*, p.workspace_id, p.visibility as project_visibility, p.name as project_name
      FROM boards b
      JOIN projects p ON b.project_id = p.id
      WHERE b.id = ?
    `).get(id);
  },

  listBoardsForProject(projectId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM boards
      WHERE project_id = ? AND archived_at IS NULL
      ORDER BY position ASC
    `).all(projectId);
  },

  countActiveBoardsForProject(projectId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT count(*) as count FROM boards
      WHERE project_id = ? AND archived_at IS NULL
    `).get(projectId);
    return row ? Number(row.count) : 0;
  },

  updateBoard(id, updates, expectedVersion, now = new Date().toISOString()) {
    const db = getDb();
    const result = db.prepare(`
      UPDATE boards
      SET name = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(updates.name, now, id, expectedVersion);

    return result.changes;
  },

  deleteBoard(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM boards WHERE id = ?').run(id);
    return result.changes > 0;
  },

  // --- Column operations ---

  createColumn({ id = generateId(), boardId, name, category, position }) {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO board_columns (id, board_id, name, position, category, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, boardId, name, position, category, now, now);

    return this.findColumnById(id);
  },

  findColumnById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT c.*, b.project_id, p.workspace_id, p.visibility as project_visibility
      FROM board_columns c
      JOIN boards b ON c.board_id = b.id
      JOIN projects p ON b.project_id = p.id
      WHERE c.id = ?
    `).get(id);
  },

  listColumnsForBoard(boardId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM board_columns
      WHERE board_id = ?
      ORDER BY position ASC
    `).all(boardId);
  },

  updateColumn(id, updates, expectedVersion, now = new Date().toISOString()) {
    const db = getDb();
    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      params.push(updates.category);
    }

    fields.push('version = version + 1');
    fields.push('updated_at = ?');
    params.push(now);

    params.push(id, expectedVersion);

    const result = db.prepare(`
      UPDATE board_columns
      SET ${fields.join(', ')}
      WHERE id = ? AND version = ?
    `).run(...params);

    return result.changes;
  },

  moveColumn(id, newPosition, expectedVersion, now = new Date().toISOString()) {
    const db = getDb();
    const result = db.prepare(`
      UPDATE board_columns
      SET position = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(newPosition, now, id, expectedVersion);

    return result.changes;
  },

  deleteColumn(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM board_columns WHERE id = ?').run(id);
    return result.changes > 0;
  },

  countActiveTasksInColumn(columnId) {
    const db = getDb();
    const hasTasks = db.prepare(`
      SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tasks'
    `).get();

    if (!hasTasks) return 0;

    const row = db.prepare(`
      SELECT count(*) as count FROM tasks
      WHERE column_id = ? AND archived_at IS NULL
    `).get(columnId);

    return row ? Number(row.count) : 0;
  },

  moveTasksToColumn(fromColumnId, toColumnId) {
    const db = getDb();
    const hasTasks = db.prepare(`
      SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tasks'
    `).get();

    if (!hasTasks) return 0;

    const result = db.prepare(`
      UPDATE tasks SET column_id = ? WHERE column_id = ?
    `).run(toColumnId, fromColumnId);

    return result.changes;
  },

  recomputeTasksCompletedAt(columnId, isDone) {
    const db = getDb();
    const hasTasks = db.prepare(`
      SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tasks'
    `).get();

    if (!hasTasks) return 0;

    const now = new Date().toISOString();
    if (isDone) {
      const result = db.prepare(`
        UPDATE tasks SET completed_at = ? WHERE column_id = ? AND completed_at IS NULL
      `).run(now, columnId);
      return result.changes;
    } else {
      const result = db.prepare(`
        UPDATE tasks SET completed_at = NULL WHERE column_id = ? AND completed_at IS NOT NULL
      `).run(columnId);
      return result.changes;
    }
  },
};
