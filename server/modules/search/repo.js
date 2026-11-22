import { getDb } from '../../db/index.js';

export const searchRepo = {
  searchTasks({ workspaceId, query, limit = 30 }) {
    const db = getDb();

    // Sanitize query for FTS5: extract alphanumeric tokens and format with prefix wildcard
    const tokens = query.match(/[A-Za-z0-9_]+/g);
    if (!tokens || tokens.length === 0) return [];

    const ftsQuery = tokens.map(t => `"${t}"*`).join(' ');

    try {
      const rows = db.prepare(`
        SELECT t.id, t.title, t.description, t.priority, t.due_date, t.column_id,
               t.project_id, p.name as project_name, p.workspace_id, p.visibility as project_visibility,
               bc.name as column_name
        FROM tasks_fts fts
        JOIN tasks t ON fts.task_id = t.id
        JOIN projects p ON t.project_id = p.id
        JOIN board_columns bc ON t.column_id = bc.id
        WHERE p.workspace_id = ? AND tasks_fts MATCH ?
        LIMIT ?
      `).all(workspaceId, ftsQuery, limit);

      return rows.map(formatSearchResult);
    } catch {
      // Fallback to LIKE if FTS syntax edge case arises
      const pattern = `%${tokens.join('%')}%`;
      const rows = db.prepare(`
        SELECT t.id, t.title, t.description, t.priority, t.due_date, t.column_id,
               t.project_id, p.name as project_name, p.workspace_id, p.visibility as project_visibility,
               bc.name as column_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN board_columns bc ON t.column_id = bc.id
        WHERE p.workspace_id = ? AND (t.title LIKE ? OR t.description LIKE ?)
        LIMIT ?
      `).all(workspaceId, pattern, pattern, limit);

      return rows.map(formatSearchResult);
    }
  },
};

function formatSearchResult(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: row.due_date,
    columnId: row.column_id,
    columnName: row.column_name,
    projectId: row.project_id,
    projectName: row.project_name,
    workspaceId: row.workspace_id,
    projectVisibility: row.project_visibility,
  };
}
