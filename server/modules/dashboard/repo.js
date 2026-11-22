import { getDb } from '../../db/index.js';

export const dashboardRepo = {
  getWorkspaceTaskStats(projectIds) {
    if (!projectIds || projectIds.length === 0) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        completionPercentage: 0,
        priorityDistribution: {
          urgent: 0,
          high: 0,
          medium: 0,
          low: 0,
          none: 0,
        },
      };
    }

    const db = getDb();
    const placeholders = projectIds.map(() => '?').join(', ');
    const sql = `
      SELECT 
        COUNT(*) AS total_tasks,
        COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) AS completed_tasks,
        COUNT(CASE WHEN t.completed_at IS NULL THEN 1 END) AS in_progress_tasks,
        COUNT(CASE 
          WHEN t.completed_at IS NULL AND t.due_date IS NOT NULL AND date(t.due_date) < date('now') 
          THEN 1 
        END) AS overdue_tasks,
        COUNT(CASE WHEN t.priority = 'urgent' AND t.completed_at IS NULL THEN 1 END) AS p_urgent,
        COUNT(CASE WHEN t.priority = 'high' AND t.completed_at IS NULL THEN 1 END) AS p_high,
        COUNT(CASE WHEN t.priority = 'medium' AND t.completed_at IS NULL THEN 1 END) AS p_medium,
        COUNT(CASE WHEN t.priority = 'low' AND t.completed_at IS NULL THEN 1 END) AS p_low,
        COUNT(CASE WHEN (t.priority = 'none' OR t.priority IS NULL) AND t.completed_at IS NULL THEN 1 END) AS p_none
      FROM tasks t
      WHERE t.archived_at IS NULL
        AND t.project_id IN (${placeholders})
    `;

    const row = db.prepare(sql).get(...projectIds);
    const total = row ? row.total_tasks : 0;
    const completed = row ? row.completed_tasks : 0;

    return {
      totalTasks: total,
      completedTasks: completed,
      inProgressTasks: row ? row.in_progress_tasks : 0,
      overdueTasks: row ? row.overdue_tasks : 0,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      priorityDistribution: {
        urgent: row ? row.p_urgent : 0,
        high: row ? row.p_high : 0,
        medium: row ? row.p_medium : 0,
        low: row ? row.p_low : 0,
        none: row ? row.p_none : 0,
      },
    };
  },

  getProjectProgress(projectIds) {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    const db = getDb();
    const placeholders = projectIds.map(() => '?').join(', ');
    const sql = `
      SELECT 
        p.id,
        p.name,
        p.visibility,
        COUNT(t.id) AS total_tasks,
        COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) AS completed_tasks
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.archived_at IS NULL
      WHERE p.id IN (${placeholders}) AND p.archived_at IS NULL
      GROUP BY p.id
      ORDER BY p.name ASC
    `;

    const rows = db.prepare(sql).all(...projectIds);
    return rows.map((r) => {
      const total = r.total_tasks;
      const completed = r.completed_tasks;
      return {
        id: r.id,
        name: r.name,
        visibility: r.visibility,
        totalTasks: total,
        completedTasks: completed,
        progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  },

  getMyTasks(userId, projectIds, { limit = 20, cursor = null } = {}) {
    if (!projectIds || projectIds.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const db = getDb();
    const placeholders = projectIds.map(() => '?').join(', ');
    const conditions = [
      't.archived_at IS NULL',
      `t.project_id IN (${placeholders})`,
      'EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)',
    ];
    const params = [...projectIds, userId];

    if (cursor) {
      conditions.push('t.created_at < ?');
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT 
        t.id, t.title, t.priority, t.due_date, t.start_date, t.completed_at, t.created_at,
        t.project_id, p.name AS project_name,
        t.column_id, c.name AS column_name, c.category AS column_category
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN board_columns c ON t.column_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE WHEN t.completed_at IS NOT NULL THEN 1 ELSE 0 END ASC,
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END ASC,
        t.due_date ASC,
        t.created_at DESC
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(...params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

    return {
      items: items.map((r) => ({
        id: r.id,
        title: r.title,
        priority: r.priority,
        dueDate: r.due_date,
        startDate: r.start_date,
        completedAt: r.completed_at,
        createdAt: r.created_at,
        projectId: r.project_id,
        projectName: r.project_name,
        columnId: r.column_id,
        columnName: r.column_name,
        columnCategory: r.column_category,
      })),
      nextCursor,
      hasMore,
    };
  },

  getUpcomingTasks(projectIds) {
    if (!projectIds || projectIds.length === 0) {
      return {
        today: [],
        tomorrow: [],
        thisWeek: [],
        nextWeek: [],
      };
    }

    const db = getDb();
    const placeholders = projectIds.map(() => '?').join(', ');
    const sql = `
      SELECT 
        t.id, t.title, t.priority, t.due_date,
        t.project_id, p.name AS project_name,
        t.column_id, c.name AS column_name,
        date(t.due_date) AS due_date_only,
        date('now') AS today_date,
        date('now', '+1 day') AS tomorrow_date,
        date('now', '+7 days') AS week_end_date,
        date('now', '+14 days') AS fortnight_end_date
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN board_columns c ON t.column_id = c.id
      WHERE t.archived_at IS NULL
        AND t.completed_at IS NULL
        AND t.due_date IS NOT NULL
        AND date(t.due_date) >= date('now')
        AND date(t.due_date) <= date('now', '+14 days')
        AND t.project_id IN (${placeholders})
      ORDER BY t.due_date ASC, t.title ASC
    `;

    const rows = db.prepare(sql).all(...projectIds);

    const today = [];
    const tomorrow = [];
    const thisWeek = [];
    const nextWeek = [];

    for (const r of rows) {
      const task = {
        id: r.id,
        title: r.title,
        priority: r.priority,
        dueDate: r.due_date,
        projectId: r.project_id,
        projectName: r.project_name,
        columnId: r.column_id,
        columnName: r.column_name,
      };

      if (r.due_date_only === r.today_date) {
        today.push(task);
      } else if (r.due_date_only === r.tomorrow_date) {
        tomorrow.push(task);
      } else if (r.due_date_only <= r.week_end_date) {
        thisWeek.push(task);
      } else {
        nextWeek.push(task);
      }
    }

    return {
      today,
      tomorrow,
      thisWeek,
      nextWeek,
    };
  },

  getWorkspaceActivity(workspaceId, projectIds, { limit = 20 } = {}) {
    const db = getDb();
    let sql;
    let params;

    if (!projectIds || projectIds.length === 0) {
      sql = `
        SELECT 
          a.id, a.workspace_id, a.project_id, a.actor_id, a.entity_type, a.entity_id,
          a.action, a.metadata, a.created_at,
          u.name AS actor_name, u.avatar_path AS actor_avatar_path,
          NULL AS project_name
        FROM activity_logs a
        LEFT JOIN users u ON a.actor_id = u.id
        WHERE a.workspace_id = ? AND a.project_id IS NULL
        ORDER BY a.created_at DESC
        LIMIT ?
      `;
      params = [workspaceId, limit];
    } else {
      const placeholders = projectIds.map(() => '?').join(', ');
      sql = `
        SELECT 
          a.id, a.workspace_id, a.project_id, a.actor_id, a.entity_type, a.entity_id,
          a.action, a.metadata, a.created_at,
          u.name AS actor_name, u.avatar_path AS actor_avatar_path,
          p.name AS project_name
        FROM activity_logs a
        LEFT JOIN users u ON a.actor_id = u.id
        LEFT JOIN projects p ON a.project_id = p.id
        WHERE a.workspace_id = ?
          AND (a.project_id IS NULL OR a.project_id IN (${placeholders}))
        ORDER BY a.created_at DESC
        LIMIT ?
      `;
      params = [workspaceId, ...projectIds, limit];
    }

    const rows = db.prepare(sql).all(...params);
    return rows.map((r) => {
      let metadata = {};
      try {
        metadata = JSON.parse(r.metadata || '{}');
      } catch {}

      return {
        id: r.id,
        workspaceId: r.workspace_id,
        projectId: r.project_id,
        projectName: r.project_name,
        entityType: r.entity_type,
        entityId: r.entity_id,
        action: r.action,
        metadata,
        actor: r.actor_id
          ? {
              id: r.actor_id,
              name: r.actor_name,
              avatarUrl: r.actor_avatar_path ? `/uploads/avatars/${r.actor_avatar_path}` : null,
            }
          : null,
        createdAt: r.created_at,
      };
    });
  },
};
