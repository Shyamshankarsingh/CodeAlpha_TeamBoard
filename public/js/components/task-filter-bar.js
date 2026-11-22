import { h } from '../lib/dom.js';

export function taskFilterBar({
  filters = {},
  columns = [],
  members = [],
  labels = [],
  onFilterChange = () => {},
}) {
  const currentFilters = { ...filters };

  let searchTimeout = null;
  let searchInput, columnSelect, prioritySelect, dueDateSelect, assigneeSelect, labelSelect, clearBtn;

  function hasActiveFilters() {
    return Boolean(
      (currentFilters.search && currentFilters.search.trim()) ||
      currentFilters.columnId ||
      currentFilters.priority ||
      currentFilters.dueDate ||
      currentFilters.assigneeId ||
      currentFilters.labelId
    );
  }

  function updateClearBtnVisibility() {
    if (clearBtn) {
      clearBtn.style.display = hasActiveFilters() ? 'inline-flex' : 'none';
    }
  }

  function notifyChange() {
    updateClearBtnVisibility();
    onFilterChange({ ...currentFilters });
  }

  const container = h(
    'div',
    { className: 'tb-filter-bar' },
    // Search input
    h(
      'div',
      { className: 'tb-filter-item tb-filter-search-wrapper' },
      (searchInput = h('input', {
        type: 'text',
        className: 'tb-input tb-filter-search',
        placeholder: 'Search tasks...',
        value: currentFilters.search || '',
        'aria-label': 'Search tasks',
        oninput: (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            currentFilters.search = e.target.value.trim();
            notifyChange();
          }, 300);
        },
      }))
    ),
    // Status / Column dropdown
    h(
      'div',
      { className: 'tb-filter-item' },
      (columnSelect = h(
        'select',
        {
          className: 'tb-select tb-filter-select',
          'aria-label': 'Filter by status or column',
          onchange: (e) => {
            currentFilters.columnId = e.target.value || undefined;
            notifyChange();
          },
        },
        h('option', { value: '' }, 'All Statuses'),
        ...columns.map((c) =>
          h('option', { value: c.id, selected: currentFilters.columnId === c.id }, c.name)
        )
      ))
    ),
    // Priority dropdown
    h(
      'div',
      { className: 'tb-filter-item' },
      (prioritySelect = h(
        'select',
        {
          className: 'tb-select tb-filter-select',
          'aria-label': 'Filter by priority',
          onchange: (e) => {
            currentFilters.priority = e.target.value || undefined;
            notifyChange();
          },
        },
        h('option', { value: '' }, 'All Priorities'),
        h('option', { value: 'urgent', selected: currentFilters.priority === 'urgent' }, 'Urgent'),
        h('option', { value: 'high', selected: currentFilters.priority === 'high' }, 'High'),
        h('option', { value: 'medium', selected: currentFilters.priority === 'medium' }, 'Medium'),
        h('option', { value: 'low', selected: currentFilters.priority === 'low' }, 'Low'),
        h('option', { value: 'none', selected: currentFilters.priority === 'none' }, 'None')
      ))
    ),
    // Due date dropdown
    h(
      'div',
      { className: 'tb-filter-item' },
      (dueDateSelect = h(
        'select',
        {
          className: 'tb-select tb-filter-select',
          'aria-label': 'Filter by due date',
          onchange: (e) => {
            currentFilters.dueDate = e.target.value || undefined;
            notifyChange();
          },
        },
        h('option', { value: '' }, 'All Due Dates'),
        h('option', { value: 'overdue', selected: currentFilters.dueDate === 'overdue' }, 'Overdue'),
        h('option', { value: 'today', selected: currentFilters.dueDate === 'today' }, 'Due Today'),
        h('option', { value: 'this_week', selected: currentFilters.dueDate === 'this_week' }, 'Due This Week'),
        h('option', { value: 'none', selected: currentFilters.dueDate === 'none' }, 'No Due Date')
      ))
    ),
    // Assignee dropdown
    h(
      'div',
      { className: 'tb-filter-item' },
      (assigneeSelect = h(
        'select',
        {
          className: 'tb-select tb-filter-select',
          'aria-label': 'Filter by assignee',
          onchange: (e) => {
            currentFilters.assigneeId = e.target.value || undefined;
            notifyChange();
          },
        },
        h('option', { value: '' }, 'All Assignees'),
        ...members.map((m) =>
          h('option', { value: m.userId || m.id, selected: currentFilters.assigneeId === (m.userId || m.id) }, m.name)
        )
      ))
    ),
    // Label dropdown
    h(
      'div',
      { className: 'tb-filter-item' },
      (labelSelect = h(
        'select',
        {
          className: 'tb-select tb-filter-select',
          'aria-label': 'Filter by label',
          onchange: (e) => {
            currentFilters.labelId = e.target.value || undefined;
            notifyChange();
          },
        },
        h('option', { value: '' }, 'All Labels'),
        ...labels.map((l) =>
          h('option', { value: l.id, selected: currentFilters.labelId === l.id }, l.name)
        )
      ))
    ),
    // Clear filters button
    (clearBtn = h(
      'button',
      {
        type: 'button',
        className: 'tb-btn tb-btn-ghost tb-btn-sm tb-filter-clear',
        style: `display: ${hasActiveFilters() ? 'inline-flex' : 'none'};`,
        onclick: () => {
          currentFilters.search = '';
          currentFilters.columnId = undefined;
          currentFilters.priority = undefined;
          currentFilters.dueDate = undefined;
          currentFilters.assigneeId = undefined;
          currentFilters.labelId = undefined;

          if (searchInput) searchInput.value = '';
          if (columnSelect) columnSelect.value = '';
          if (prioritySelect) prioritySelect.value = '';
          if (dueDateSelect) dueDateSelect.value = '';
          if (assigneeSelect) assigneeSelect.value = '';
          if (labelSelect) labelSelect.value = '';

          notifyChange();
        },
      },
      '✕ Clear Filters'
    ))
  );

  return container;
}
