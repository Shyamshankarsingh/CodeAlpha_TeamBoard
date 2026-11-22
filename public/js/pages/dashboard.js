import { h, clearChildren } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { avatar } from '../components/avatar.js';

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getPriorityBadge(priority) {
  if (!priority || priority === 'none') return null;
  const colors = {
    urgent: 'var(--color-danger, #ef4444)',
    high: 'var(--color-warning, #f59e0b)',
    medium: 'var(--color-info, #3b82f6)',
    low: 'var(--color-text-muted, #9ca3af)',
  };
  return h(
    'span',
    {
      className: 'tb-badge',
      style: `font-size: 11px; padding: 1px 6px; text-transform: uppercase; border-left: 3px solid ${
        colors[priority] || 'var(--border)'
      };`,
    },
    priority
  );
}

export function DashboardPage(params = {}) {
  const wsId = params.workspaceId || store.getState().currentWorkspaceId;
  const container = h('div', { className: 'tb-dashboard-page' });

  let isLoading = true;
  let overview = null;
  let myTasks = [];
  let upcoming = { today: [], tomorrow: [], thisWeek: [], nextWeek: [] };
  let activity = [];

  async function loadDashboard() {
    isLoading = true;
    render();

    try {
      const [overviewRes, myTasksRes, upcomingRes, activityRes] = await Promise.all([
        api(`/api/workspaces/${wsId}/dashboard/overview`),
        api(`/api/workspaces/${wsId}/dashboard/my-tasks?limit=10`),
        api(`/api/workspaces/${wsId}/dashboard/upcoming`),
        api(`/api/workspaces/${wsId}/dashboard/activity?limit=10`),
      ]);

      overview = overviewRes || { stats: {}, projects: [] };
      myTasks = myTasksRes?.items || [];
      upcoming = upcomingRes || { today: [], tomorrow: [], thisWeek: [], nextWeek: [] };
      activity = activityRes || [];
    } catch (err) {
      store.setToast(err.message || 'Failed to load dashboard', 'error');
    } finally {
      isLoading = false;
      render();
    }
  }

  function renderMetricCard(title, value, subtext, highlightColor) {
    return h(
      'div',
      {
        className: 'tb-card tb-metric-card',
        style:
          'flex: 1; min-width: 180px; padding: var(--space-4); border-top: 3px solid ' +
          (highlightColor || 'var(--color-primary)') +
          ';',
      },
      h('div', { style: 'font-size: var(--font-size-sm); color: var(--color-text-muted);' }, title),
      h(
        'div',
        {
          style:
            'font-size: 28px; font-weight: 700; color: var(--color-text-main); margin: var(--space-2) 0;',
        },
        String(value)
      ),
      subtext
        ? h('div', { style: 'font-size: var(--font-size-xs); color: var(--color-text-dim);' }, subtext)
        : null
    );
  }

  function render() {
    clearChildren(container);

    if (isLoading && !overview) {
      container.appendChild(
        h('div', { className: 'tb-loading', style: 'padding: 40px; text-align: center;' }, 'Loading workspace dashboard...')
      );
      return;
    }

    const { workspaces } = store.getState();
    const currentWs = workspaces.find((w) => w.id === wsId) || workspaces[0];
    const stats = overview?.stats || {};
    const projects = overview?.projects || [];

    // Header
    const header = h(
      'div',
      {
        style:
          'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);',
      },
      h(
        'div',
        {},
        h(
          'h1',
          { className: 'tb-page-title', style: 'margin: 0;' },
          `${currentWs ? currentWs.name : 'Workspace'} Dashboard`
        ),
        h(
          'p',
          { className: 'tb-text-muted', style: 'margin-top: 4px;' },
          'Overview, progress, and upcoming deadlines across your visible projects.'
        )
      ),
      h(
        'div',
        { style: 'display: flex; gap: 8px;' },
        h(
          'a',
          { href: `/w/${wsId}/projects`, className: 'tb-btn tb-btn-secondary tb-btn-sm' },
          'View All Projects'
        ),
        h(
          'button',
          {
            className: 'tb-btn tb-btn-ghost tb-btn-sm',
            title: 'Refresh',
            onclick: loadDashboard,
          },
          '🔄 Refresh'
        )
      )
    );

    // Metric Summary Cards Row
    const metricsRow = h(
      'div',
      {
        style: 'display: flex; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-6);',
      },
      renderMetricCard('Total Tasks', stats.totalTasks ?? 0, 'Across visible projects', 'var(--color-primary)'),
      renderMetricCard(
        'Completed',
        stats.completedTasks ?? 0,
        `${stats.completionPercentage ?? 0}% overall completion`,
        'var(--color-success, #10b981)'
      ),
      renderMetricCard(
        'In Progress',
        stats.inProgressTasks ?? 0,
        'Currently active',
        'var(--color-info, #3b82f6)'
      ),
      renderMetricCard(
        'Overdue Tasks',
        stats.overdueTasks ?? 0,
        stats.overdueTasks > 0 ? 'Requires attention' : 'All deadlines met',
        stats.overdueTasks > 0 ? 'var(--color-danger, #ef4444)' : 'var(--color-text-muted)'
      )
    );

    // Main 2-Column Grid
    const mainGrid = h(
      'div',
      {
        style:
          'display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: var(--space-6); margin-bottom: var(--space-6);',
      },
      // Column 1: Projects Progress & My Tasks
      h(
        'div',
        { style: 'display: flex; flex-direction: column; gap: var(--space-6);' },
        // Projects Progress Card
        h(
          'div',
          { className: 'tb-card' },
          h('h3', { style: 'margin-top: 0; margin-bottom: var(--space-4);' }, 'Project Progress'),
          projects.length === 0
            ? h('div', { className: 'tb-empty-state', style: 'padding: 16px 0; color: var(--color-text-muted);' }, 'No active projects found.')
            : h(
                'div',
                { style: 'display: flex; flex-direction: column; gap: 14px;' },
                ...projects.map((p) =>
                  h(
                    'div',
                    { style: 'display: flex; flex-direction: column; gap: 4px;' },
                    h(
                      'div',
                      { style: 'display: flex; justify-content: space-between; align-items: center;' },
                      h(
                        'a',
                        {
                          href: `/w/${wsId}/p/${p.id}`,
                          style: 'font-weight: 500; color: var(--color-text-main); text-decoration: none;',
                        },
                        p.name
                      ),
                      h(
                        'span',
                        { style: 'font-size: var(--font-size-xs); color: var(--color-text-muted);' },
                        `${p.completedTasks}/${p.totalTasks} done (${p.progressPercent}%)`
                      )
                    ),
                    h(
                      'div',
                      {
                        style:
                          'width: 100%; height: 8px; background: var(--bg-hover, #e2e8f0); border-radius: 4px; overflow: hidden;',
                      },
                      h('div', {
                        style: `height: 100%; width: ${p.progressPercent}%; background: var(--color-primary, #6366f1); border-radius: 4px; transition: width 0.3s ease;`,
                      })
                    )
                  )
                )
              )
        ),
        // My Tasks Card
        h(
          'div',
          { className: 'tb-card' },
          h(
            'div',
            { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);' },
            h('h3', { style: 'margin: 0;' }, 'My Tasks'),
            h('span', { className: 'tb-badge' }, `${myTasks.length} assigned`)
          ),
          myTasks.length === 0
            ? h('div', { className: 'tb-empty-state', style: 'padding: 16px 0; color: var(--color-text-muted);' }, 'No open tasks assigned to you.')
            : h(
                'div',
                { style: 'display: flex; flex-direction: column; gap: 8px;' },
                ...myTasks.map((t) =>
                  h(
                    'div',
                    {
                      className: 'tb-task-item',
                      style:
                        'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-surface);',
                    },
                    h(
                      'div',
                      { style: 'display: flex; flex-direction: column; gap: 2px;' },
                      h(
                        'a',
                        {
                          href: `/w/${wsId}/p/${t.projectId}`,
                          style: 'font-weight: 500; font-size: var(--font-size-sm); color: var(--color-text-main); text-decoration: none;',
                        },
                        t.title
                      ),
                      h(
                        'span',
                        { style: 'font-size: var(--font-size-xs); color: var(--color-text-muted);' },
                        `${t.projectName} • ${t.columnName}`
                      )
                    ),
                    h(
                      'div',
                      { style: 'display: flex; align-items: center; gap: 8px;' },
                      getPriorityBadge(t.priority),
                      t.dueDate
                        ? h(
                            'span',
                            { style: 'font-size: var(--font-size-xs); color: var(--color-text-dim);' },
                            `Due ${t.dueDate}`
                          )
                        : null
                    )
                  )
                )
              )
        )
      ),

      // Column 2: Upcoming Deadlines & Recent Activity
      h(
        'div',
        { style: 'display: flex; flex-direction: column; gap: var(--space-6);' },
        // Upcoming Deadlines Card
        h(
          'div',
          { className: 'tb-card' },
          h('h3', { style: 'margin-top: 0; margin-bottom: var(--space-4);' }, 'Upcoming Deadlines (14 Days)'),
          renderUpcomingSection('Today', upcoming.today, 'var(--color-danger, #ef4444)'),
          renderUpcomingSection('Tomorrow', upcoming.tomorrow, 'var(--color-warning, #f59e0b)'),
          renderUpcomingSection('This Week', upcoming.thisWeek),
          renderUpcomingSection('Next Week', upcoming.nextWeek),
          upcoming.today.length === 0 &&
          upcoming.tomorrow.length === 0 &&
          upcoming.thisWeek.length === 0 &&
          upcoming.nextWeek.length === 0
            ? h('div', { className: 'tb-empty-state', style: 'padding: 16px 0; color: var(--color-text-muted);' }, 'No tasks due in the next 14 days.')
            : null
        ),
        // Recent Activity Feed
        h(
          'div',
          { className: 'tb-card' },
          h('h3', { style: 'margin-top: 0; margin-bottom: var(--space-4);' }, 'Recent Workspace Activity'),
          activity.length === 0
            ? h('div', { className: 'tb-empty-state', style: 'padding: 16px 0; color: var(--color-text-muted);' }, 'No recent activity.')
            : h(
                'div',
                { style: 'display: flex; flex-direction: column; gap: 10px;' },
                ...activity.map((a) =>
                  h(
                    'div',
                    { style: 'display: flex; gap: 10px; align-items: flex-start; font-size: var(--font-size-xs);' },
                    avatar({ name: a.actor?.name || 'User', size: 'sm', avatarUrl: a.actor?.avatarUrl }),
                    h(
                      'div',
                      { style: 'flex: 1;' },
                      h('strong', {}, a.actor?.name || 'Someone'),
                      ' ',
                      h('span', { style: 'color: var(--color-text-muted);' }, formatAction(a)),
                      a.projectName
                        ? h('span', { style: 'color: var(--color-text-dim);' }, ` in ${a.projectName}`)
                        : null,
                      h(
                        'div',
                        { style: 'color: var(--color-text-dim); margin-top: 2px;' },
                        formatRelativeTime(a.createdAt)
                      )
                    )
                  )
                )
              )
        )
      )
    );

    container.appendChild(header);
    container.appendChild(metricsRow);
    container.appendChild(mainGrid);
  }

  function renderUpcomingSection(title, list, accentColor) {
    if (!list || list.length === 0) return null;
    return h(
      'div',
      { style: 'margin-bottom: var(--space-3);' },
      h(
        'div',
        {
          style: `font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; color: ${
            accentColor || 'var(--color-text-muted)'
          }; margin-bottom: 6px;`,
        },
        `${title} (${list.length})`
      ),
      h(
        'div',
        { style: 'display: flex; flex-direction: column; gap: 6px;' },
        ...list.map((item) =>
          h(
            'div',
            {
              style:
                'display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--bg-hover); border-radius: var(--radius-sm); font-size: var(--font-size-xs);',
            },
            h('span', { style: 'font-weight: 500;' }, item.title),
            h('span', { style: 'color: var(--color-text-muted);' }, item.projectName)
          )
        )
      )
    );
  }

  function formatAction(a) {
    switch (a.action) {
      case 'task.created':
        return 'created a task';
      case 'task.updated':
        return 'updated a task';
      case 'task.moved':
        return 'moved a task';
      case 'comment.created':
        return 'commented on a task';
      case 'project.created':
        return 'created a project';
      default:
        return a.action.replace(/\./g, ' ');
    }
  }

  loadDashboard();
  return container;
}
