import { h } from '../lib/dom.js';
import { avatar } from './avatar.js';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdue(dueDate, completedAt) {
  if (!dueDate || completedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

export function taskTable({
  tasks = [],
  total = 0,
  limit = 25,
  offset = 0,
  sortBy = 'position',
  sortDir = 'asc',
  onSort = () => {},
  onPageChange = () => {},
  onTaskClick = () => {},
  columns = [],
  onBulkAction = () => {},
}) {
  const selectedIds = new Set();
  const bulkBar = h('div', {
    className: 'tb-bulk-bar',
    style: 'display: none; padding: 8px 12px; margin-bottom: 8px; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 6px; align-items: center; justify-content: space-between; font-size: 0.85rem;',
  });

  function updateBulkBar() {
    if (selectedIds.size === 0) {
      bulkBar.style.display = 'none';
      bulkBar.replaceChildren();
      return;
    }

    bulkBar.style.display = 'flex';
    const countSpan = h('span', { style: 'font-weight: 600;' }, [`${selectedIds.size} task(s) selected`]);

    const colSelect = h('select', { className: 'tb-select tb-select-sm', style: 'padding: 2px 6px; font-size: 0.8rem;' }, [
      h('option', { value: '' }, ['Move to column...']),
      ...columns.map(c => h('option', { value: c.id }, [c.name]))
    ]);

    const moveBtn = h('button', {
      type: 'button',
      className: 'tb-btn tb-btn-outline tb-btn-sm',
      onclick: () => {
        if (!colSelect.value) return;
        onBulkAction(Array.from(selectedIds), 'move', colSelect.value);
        selectedIds.clear();
        updateBulkBar();
      },
    }, ['Move']);

    const archiveBtn = h('button', {
      type: 'button',
      className: 'tb-btn tb-btn-ghost tb-btn-sm',
      onclick: () => {
        onBulkAction(Array.from(selectedIds), 'archive');
        selectedIds.clear();
        updateBulkBar();
      },
    }, ['Archive']);

    const deleteBtn = h('button', {
      type: 'button',
      className: 'tb-btn tb-btn-danger tb-btn-sm',
      onclick: () => {
        if (!confirm(`Delete ${selectedIds.size} selected tasks?`)) return;
        onBulkAction(Array.from(selectedIds), 'delete');
        selectedIds.clear();
        updateBulkBar();
      },
    }, ['Delete']);

    const clearBtn = h('button', {
      type: 'button',
      className: 'tb-btn tb-btn-ghost tb-btn-sm',
      onclick: () => {
        selectedIds.clear();
        table.querySelectorAll('.tb-task-select-cb').forEach(cb => { cb.checked = false; });
        const allCb = table.querySelector('.tb-select-all-cb');
        if (allCb) allCb.checked = false;
        updateBulkBar();
      },
    }, ['Clear Selection']);

    const actions = h('div', { style: 'display: flex; gap: 8px; align-items: center;' }, [
      colSelect,
      moveBtn,
      archiveBtn,
      deleteBtn,
      clearBtn,
    ]);

    bulkBar.replaceChildren(countSpan, actions);
  }

  function renderSortHeader(label, field) {
    const isCurrent = sortBy === field;
    const arrow = isCurrent ? (sortDir === 'asc' ? '▲' : '▼') : '↕';

    return h(
      'th',
      {
        className: 'tb-th-sortable',
        scope: 'col',
        'aria-sort': isCurrent ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none',
        onclick: () => onSort(field),
        onkeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSort(field);
          }
        },
        tabIndex: 0,
        role: 'columnheader',
      },
      h(
        'div',
        { className: 'tb-th-content' },
        h('span', {}, label),
        h('span', { className: `tb-sort-arrow ${isCurrent ? 'is-active' : ''}` }, arrow)
      )
    );
  }

  const table = h(
    'table',
    { className: 'tb-table tb-task-table' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { style: 'width: 40px; text-align: center;' }, [
          h('input', {
            type: 'checkbox',
            className: 'tb-select-all-cb',
            'aria-label': 'Select all tasks',
            onchange: (e) => {
              const checked = e.target.checked;
              selectedIds.clear();
              if (checked) {
                tasks.forEach(t => selectedIds.add(t.id));
              }
              table.querySelectorAll('.tb-task-select-cb').forEach(cb => { cb.checked = checked; });
              updateBulkBar();
            },
          })
        ]),
        renderSortHeader('Title', 'title'),
        h('th', { scope: 'col' }, 'Status'),
        renderSortHeader('Priority', 'priority'),
        h('th', { scope: 'col' }, 'Assignees'),
        h('th', { scope: 'col' }, 'Labels'),
        renderSortHeader('Due Date', 'due_date'),
        renderSortHeader('Created', 'created_at')
      )
    ),
    h(
      'tbody',
      {},
      tasks.length === 0
        ? h(
            'tr',
            {},
            h(
              'td',
              { colSpan: 8, className: 'tb-empty-cell' },
              h(
                'div',
                { className: 'tb-empty-state' },
                h('p', { className: 'tb-empty-title' }, 'No tasks found'),
                h('p', { className: 'tb-empty-subtitle' }, 'Try clearing filters or search to view more tasks.')
              )
            )
          )
        : tasks.map((task) => {
            const overdue = isOverdue(task.dueDate, task.completedAt);
            const assignees = task.assignees || [];
            const labels = task.labels || [];
            const subtasks = task.subtasks || [];
            const completedSubtasks = subtasks.filter((s) => s.completed).length;

            return h(
              'tr',
              {
                className: 'tb-task-row',
                tabIndex: 0,
                role: 'button',
                'aria-label': `View task details for ${task.title}`,
                onclick: () => onTaskClick(task),
                onkeydown: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTaskClick(task);
                  }
                },
              },
              // 0. Checkbox cell
              h('td', { style: 'width: 40px; text-align: center;' }, [
                h('input', {
                  type: 'checkbox',
                  className: 'tb-task-select-cb',
                  checked: selectedIds.has(task.id),
                  'aria-label': `Select task ${task.title}`,
                  onclick: (e) => {
                    e.stopPropagation();
                    if (e.target.checked) selectedIds.add(task.id);
                    else selectedIds.delete(task.id);
                    updateBulkBar();
                  },
                })
              ]),
              // 1. Title cell
              h(
                'td',
                { className: 'tb-task-cell-title' },
                h(
                  'div',
                  { className: 'tb-task-title-group' },
                  h('span', { className: 'tb-task-title-text' }, task.title),
                  subtasks.length > 0
                    ? h(
                        'span',
                        { className: 'tb-task-subtask-badge' },
                        `✓ ${completedSubtasks}/${subtasks.length}`
                      )
                    : null
                )
              ),
              // 2. Status cell
              h(
                'td',
                { className: 'tb-task-cell-status' },
                h(
                  'span',
                  { className: `tb-badge tb-badge-category-${task.columnCategory || 'todo'}` },
                  task.columnName || 'To Do'
                )
              ),
              // 3. Priority cell
              h(
                'td',
                { className: 'tb-task-cell-priority' },
                task.priority && task.priority !== 'none'
                  ? h(
                      'span',
                      { className: `tb-priority-badge tb-priority-${task.priority}` },
                      task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
                    )
                  : h('span', { className: 'tb-text-muted' }, 'None')
              ),
              // 4. Assignees cell
              h(
                'td',
                { className: 'tb-task-cell-assignees' },
                assignees.length > 0
                  ? h(
                      'div',
                      { className: 'tb-assignee-stack' },
                      ...assignees.map((u) =>
                        avatar({ name: u.name, size: 24, avatarUrl: u.avatarUrl })
                      )
                    )
                  : h('span', { className: 'tb-text-muted' }, 'Unassigned')
              ),
              // 5. Labels cell
              h(
                'td',
                { className: 'tb-task-cell-labels' },
                labels.length > 0
                  ? h(
                      'div',
                      { className: 'tb-label-group' },
                      ...labels.map((l) =>
                        h(
                          'span',
                          {
                            className: 'tb-label-pill',
                            style: `background-color: ${l.color};`,
                          },
                          l.name
                        )
                      )
                    )
                  : h('span', { className: 'tb-text-muted' }, '—')
              ),
              // 6. Due date cell
              h(
                'td',
                { className: 'tb-task-cell-due' },
                task.dueDate
                  ? h(
                      'span',
                      { className: overdue ? 'tb-due-overdue' : 'tb-due-date' },
                      formatDate(task.dueDate) + (overdue ? ' (Overdue)' : '')
                    )
                  : h('span', { className: 'tb-text-muted' }, '—')
              ),
              // 7. Created cell
              h(
                'td',
                { className: 'tb-task-cell-created' },
                h('span', { className: 'tb-text-muted' }, formatDate(task.createdAt))
              )
            );
          })
    )
  );

  // Pagination bar
  const startItem = total === 0 ? 0 : offset + 1;
  const endItem = Math.min(offset + limit, total);

  const pagination = h(
    'div',
    { className: 'tb-pagination' },
    h(
      'div',
      { className: 'tb-pagination-info' },
      `Showing ${startItem}–${endItem} of ${total} tasks`
    ),
    h(
      'div',
      { className: 'tb-pagination-actions' },
      h(
        'button',
        {
          type: 'button',
          className: 'tb-btn tb-btn-secondary tb-btn-sm',
          disabled: offset === 0,
          onclick: () => onPageChange(Math.max(0, offset - limit)),
        },
        '← Previous'
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'tb-btn tb-btn-secondary tb-btn-sm',
          disabled: offset + limit >= total,
          onclick: () => onPageChange(offset + limit),
        },
        'Next →'
      )
    )
  );

  return h(
    'div',
    { className: 'tb-task-table-wrapper' },
    bulkBar,
    h('div', { className: 'tb-table-card' }, table),
    pagination
  );
}
