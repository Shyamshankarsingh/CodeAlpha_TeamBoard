import { getDb } from '../../db/index.js';
import { generateId } from '../../lib/ids.js';

export const dependenciesRepo = {
  createDependency({
    id = generateId(),
    taskId,
    dependsOnTaskId,
    createdAt = new Date().toISOString(),
  }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO task_dependencies (id, task_id, depends_on_task_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, taskId, dependsOnTaskId, createdAt);

    return this.findDependencyById(id);
  },

  findDependencyById(id) {
    const db = getDb();
    const row = db.prepare(`
      SELECT td.*,
             t1.title as task_title, t1.project_id as task_project_id,
             t2.title as depends_on_task_title, t2.project_id as depends_on_project_id,
             p.workspace_id, p.visibility as project_visibility
      FROM task_dependencies td
      JOIN tasks t1 ON td.task_id = t1.id
      JOIN tasks t2 ON td.depends_on_task_id = t2.id
      JOIN projects p ON t1.project_id = p.id
      WHERE td.id = ?
    `).get(id);

    return row ? formatDependencyRow(row) : null;
  },

  findExistingDependency(taskId, dependsOnTaskId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?
    `).get(taskId, dependsOnTaskId);

    return row || null;
  },

  listDependenciesForTask(taskId) {
    const db = getDb();

    // Blocked by (tasks this task depends on)
    const blockedBy = db.prepare(`
      SELECT td.id as dependency_id, td.created_at,
             t.id, t.title, t.completed_at, t.priority, t.column_id, bc.name as column_name
      FROM task_dependencies td
      JOIN tasks t ON td.depends_on_task_id = t.id
      JOIN board_columns bc ON t.column_id = bc.id
      WHERE td.task_id = ?
      ORDER BY td.created_at ASC
    `).all(taskId);

    // Blocks (tasks that depend on this task)
    const blocks = db.prepare(`
      SELECT td.id as dependency_id, td.created_at,
             t.id, t.title, t.completed_at, t.priority, t.column_id, bc.name as column_name
      FROM task_dependencies td
      JOIN tasks t ON td.task_id = t.id
      JOIN board_columns bc ON t.column_id = bc.id
      WHERE td.depends_on_task_id = ?
      ORDER BY td.created_at ASC
    `).all(taskId);

    return {
      blockedBy: blockedBy.map(formatDepItem),
      blocks: blocks.map(formatDepItem),
    };
  },

  getAllDependenciesForProject(projectId) {
    const db = getDb();
    return db.prepare(`
      SELECT td.task_id, td.depends_on_task_id
      FROM task_dependencies td
      JOIN tasks t ON td.task_id = t.id
      WHERE t.project_id = ?
    `).all(projectId);
  },

  deleteDependency(id) {
    const db = getDb();
    db.prepare('DELETE FROM task_dependencies WHERE id = ?').run(id);
  },
};

function formatDependencyRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    dependsOnTaskId: row.depends_on_task_id,
    createdAt: row.created_at,
    taskTitle: row.task_title,
    dependsOnTaskTitle: row.depends_on_task_title,
    projectId: row.task_project_id,
    workspaceId: row.workspace_id,
    projectVisibility: row.project_visibility,
  };
}

function formatDepItem(row) {
  return {
    dependencyId: row.dependency_id,
    id: row.id,
    title: row.title,
    status: row.completed_at ? 'completed' : 'in_progress',
    priority: row.priority,
    columnId: row.column_id,
    columnName: row.column_name,
    createdAt: row.created_at,
  };
}
