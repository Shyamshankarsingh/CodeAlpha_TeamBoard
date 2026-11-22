import { h, clearChildren } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { dialog } from '../components/dialog.js';
import { taskCard } from '../components/task-card.js';
import { openTaskPanel } from '../components/task-panel.js';
import { avatar } from '../components/avatar.js';
import { socketClient } from '../lib/socket.js';
import { taskFilterBar } from '../components/task-filter-bar.js';
import { taskTable } from '../components/task-table.js';

export function BoardPage(params) {
  const wsId = params.workspaceId || store.getState().currentWorkspaceId;
  const projectId = params.projectId;
  const boardId = params.boardId;

  const container = h('div', { className: 'tb-board-page' });

  // URL state persistence
  const searchParams = new URLSearchParams(window.location.search);
  let viewMode = searchParams.get('view') === 'list' ? 'list' : 'board';
  let filters = {
    search: searchParams.get('search') || '',
    columnId: searchParams.get('columnId') || undefined,
    priority: searchParams.get('priority') || undefined,
    dueDate: searchParams.get('dueDate') || undefined,
    assigneeId: searchParams.get('assigneeId') || undefined,
    labelId: searchParams.get('labelId') || undefined,
  };
  let sortBy = searchParams.get('sortBy') || 'position';
  let sortDir = searchParams.get('sortDir') || 'asc';
  let offset = parseInt(searchParams.get('offset') || '0', 10);
  const limit = 25;

  let board = null;
  let activeBoardId = boardId;
  let projectMembers = [];
  let projectLabels = [];
  let listTasks = [];
  let listTotal = 0;
  let isLoading = true;
  let presenceUsers = [];

  function syncUrl() {
    const params = new URLSearchParams();
    if (viewMode !== 'board') params.set('view', viewMode);
    if (filters.search) params.set('search', filters.search);
    if (filters.columnId) params.set('columnId', filters.columnId);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.dueDate) params.set('dueDate', filters.dueDate);
    if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
    if (filters.labelId) params.set('labelId', filters.labelId);
    if (sortBy !== 'position') params.set('sortBy', sortBy);
    if (sortDir !== 'asc') params.set('sortDir', sortDir);
    if (offset > 0) params.set('offset', String(offset));

    const qs = params.toString();
    const newPath = window.location.pathname + (qs ? `?${qs}` : '');
    window.history.replaceState(null, '', newPath);
  }

  function matchesFilters(task) {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const titleMatch = (task.title || '').toLowerCase().includes(s);
      const descMatch = (task.description || '').toLowerCase().includes(s);
      if (!titleMatch && !descMatch) return false;
    }
    if (filters.columnId && task.columnId !== filters.columnId) {
      return false;
    }
    if (filters.priority && task.priority !== filters.priority) {
      return false;
    }
    if (filters.assigneeId) {
      const hasAssignee = (task.assignees || []).some(
        (a) => a.id === filters.assigneeId || a.userId === filters.assigneeId
      );
      if (!hasAssignee) return false;
    }
    if (filters.labelId) {
      const hasLabel = (task.labels || []).some((l) => l.id === filters.labelId);
      if (!hasLabel) return false;
    }
    if (filters.dueDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (filters.dueDate === 'overdue') {
        if (!task.dueDate || task.dueDate >= today || task.completedAt) return false;
      } else if (filters.dueDate === 'today') {
        if (!task.dueDate || task.dueDate !== today) return false;
      } else if (filters.dueDate === 'this_week') {
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        if (!task.dueDate || task.dueDate < today || task.dueDate > nextWeek) return false;
      } else if (filters.dueDate === 'none') {
        if (task.dueDate) return false;
      }
    }
    return true;
  }

  async function fetchListTasks() {
    try {
      const q = new URLSearchParams();
      if (filters.search) q.set('search', filters.search);
      if (filters.columnId) q.set('columnId', filters.columnId);
      if (filters.priority) q.set('priority', filters.priority);
      if (filters.dueDate) q.set('dueDate', filters.dueDate);
      if (filters.assigneeId) q.set('assigneeId', filters.assigneeId);
      if (filters.labelId) q.set('labelId', filters.labelId);
      q.set('sortBy', sortBy);
      q.set('sortDir', sortDir);
      q.set('limit', String(limit));
      q.set('offset', String(offset));

      const res = await api(`/api/projects/${projectId}/tasks?${q.toString()}`);
      listTasks = res.tasks || [];
      listTotal = res.pagination ? res.pagination.total : listTasks.length;
    } catch (err) {
      store.setToast(err.message || 'Failed to load list tasks', 'error');
    }
  }

  async function loadBoard() {
    isLoading = true;
    render();
    try {
      if (!activeBoardId) {
        // Fetch project boards and take first
        const boards = await api(`/api/projects/${projectId}/boards`);
        if (boards && boards.length > 0) {
          activeBoardId = boards[0].id;
        } else {
          isLoading = false;
          render();
          return;
        }
      }

      const [boardData, membersData, labelsData] = await Promise.all([
        api(`/api/boards/${activeBoardId}`),
        api(`/api/projects/${projectId}/members`).catch(() => []),
        api(`/api/projects/${projectId}/labels`).catch(() => []),
      ]);

      board = boardData;
      projectMembers = membersData || [];
      projectLabels = labelsData || [];

      if (viewMode === 'list') {
        await fetchListTasks();
      }
    } catch (err) {
      store.setToast(err.message || 'Failed to load board', 'error');
    } finally {
      isLoading = false;
      render();
    }
  }

  async function refreshData() {
    try {
      if (activeBoardId) {
        board = await api(`/api/boards/${activeBoardId}`);
      }
      if (viewMode === 'list') {
        await fetchListTasks();
      }
      render();
    } catch {
      // silent refresh error
    }
  }

  function openAddColumnDialog() {
    let nameInput, categorySelect, errorEl;

    const form = h(
      'form',
      {
        className: 'tb-form',
        onsubmit: async (e) => {
          e.preventDefault();
          errorEl.textContent = '';
          const name = nameInput.value.trim();
          if (!name) {
            errorEl.textContent = 'Column name is required';
            return;
          }

          try {
            await api(`/api/boards/${activeBoardId}/columns`, {
              method: 'POST',
              body: {
                name,
                category: categorySelect.value,
              },
            });
            modal.close();
            store.setToast('Column added', 'success');
            loadBoard();
          } catch (err) {
            errorEl.textContent = err.message || 'Failed to add column';
          }
        },
      },
      (errorEl = h('div', { className: 'tb-form-error' })),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Column Name *'),
        (nameInput = h('input', {
          type: 'text',
          className: 'tb-input',
          placeholder: 'e.g. QA Testing',
          required: true,
          maxLength: 50,
        }))
      ),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Category *'),
        (categorySelect = h(
          'select',
          { className: 'tb-select' },
          h('option', { value: 'backlog' }, 'Backlog'),
          h('option', { value: 'todo' }, 'To Do'),
          h('option', { value: 'in_progress' }, 'In Progress'),
          h('option', { value: 'review' }, 'In Review'),
          h('option', { value: 'done' }, 'Done')
        ))
      ),
      h(
        'div',
        { className: 'tb-form-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'tb-btn tb-btn-secondary',
            onclick: () => modal.close(),
          },
          'Cancel'
        ),
        h('button', { type: 'submit', className: 'tb-btn tb-btn-primary' }, 'Add Column')
      )
    );

    const modal = dialog({
      title: 'Add New Column',
      content: form,
    });
  }

  function openRenameColumnDialog(column) {
    let nameInput, categorySelect, errorEl;

    const form = h(
      'form',
      {
        className: 'tb-form',
        onsubmit: async (e) => {
          e.preventDefault();
          errorEl.textContent = '';
          try {
            await api(`/api/columns/${column.id}`, {
              method: 'PATCH',
              body: {
                name: nameInput.value.trim(),
                category: categorySelect.value,
                expectedVersion: column.version,
              },
            });
            modal.close();
            store.setToast('Column updated', 'success');
            loadBoard();
          } catch (err) {
            errorEl.textContent = err.message || 'Failed to update column';
          }
        },
      },
      (errorEl = h('div', { className: 'tb-form-error' })),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Column Name *'),
        (nameInput = h('input', {
          type: 'text',
          className: 'tb-input',
          value: column.name,
          required: true,
          maxLength: 50,
        }))
      ),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Category *'),
        (categorySelect = h(
          'select',
          { className: 'tb-select' },
          h('option', { value: 'backlog', selected: column.category === 'backlog' }, 'Backlog'),
          h('option', { value: 'todo', selected: column.category === 'todo' }, 'To Do'),
          h('option', { value: 'in_progress', selected: column.category === 'in_progress' }, 'In Progress'),
          h('option', { value: 'review', selected: column.category === 'review' }, 'In Review'),
          h('option', { value: 'done', selected: column.category === 'done' }, 'Done')
        ))
      ),
      h(
        'div',
        { className: 'tb-form-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'tb-btn tb-btn-secondary',
            onclick: () => modal.close(),
          },
          'Cancel'
        ),
        h('button', { type: 'submit', className: 'tb-btn tb-btn-primary' }, 'Save Changes')
      )
    );

    const modal = dialog({
      title: 'Edit Column',
      content: form,
    });
  }

  function openQuickAddTaskDialog(column) {
    let titleInput, prioritySelect, errorEl;
    const form = h(
      'form',
      {
        className: 'tb-form',
        onsubmit: async (e) => {
          e.preventDefault();
          errorEl.textContent = '';
          const title = titleInput.value.trim();
          if (!title) {
            errorEl.textContent = 'Task title is required';
            return;
          }
          try {
            await api(`/api/columns/${column.id}/tasks`, {
              method: 'POST',
              body: {
                title,
                priority: prioritySelect.value,
              },
            });
            modal.close();
            store.setToast('Task created', 'success');
            refreshData();
          } catch (err) {
            errorEl.textContent = err.message || 'Failed to create task';
          }
        },
      },
      (errorEl = h('div', { className: 'tb-form-error' })),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Task Title *'),
        (titleInput = h('input', {
          type: 'text',
          className: 'tb-input',
          placeholder: 'What needs to be done?',
          required: true,
          maxLength: 200,
        }))
      ),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Priority'),
        (prioritySelect = h(
          'select',
          { className: 'tb-select' },
          h('option', { value: 'none' }, 'None'),
          h('option', { value: 'low' }, 'Low'),
          h('option', { value: 'medium' }, 'Medium'),
          h('option', { value: 'high' }, 'High'),
          h('option', { value: 'urgent' }, 'Urgent')
        ))
      ),
      h(
        'div',
        { className: 'tb-form-actions' },
        h(
          'button',
          { type: 'button', className: 'tb-btn tb-btn-secondary', onclick: () => modal.close() },
          'Cancel'
        ),
        h('button', { type: 'submit', className: 'tb-btn tb-btn-primary' }, 'Create Task')
      )
    );

    const modal = dialog({
      title: `Add Task to ${column.name}`,
      content: form,
    });
  }

  async function moveTaskToColumn(task, targetColumnId) {
    try {
      await api(`/api/tasks/${task.id}/move`, {
        method: 'POST',
        body: {
          columnId: targetColumnId,
          expectedVersion: task.version,
        },
      });
      refreshData();
    } catch (err) {
      store.setToast(err.message || 'Failed to move task', 'error');
    }
  }

  async function moveColumn(columnIndex, direction) {
    const columns = board.columns || [];
    const targetIndex = columnIndex + direction;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const current = columns[columnIndex];
    let prevPos = null;
    let nextPos = null;

    if (direction < 0) {
      prevPos = targetIndex > 0 ? columns[targetIndex - 1].position : null;
      nextPos = columns[targetIndex].position;
    } else {
      prevPos = columns[targetIndex].position;
      nextPos = targetIndex < columns.length - 1 ? columns[targetIndex + 1].position : null;
    }

    try {
      await api(`/api/columns/${current.id}/move`, {
        method: 'POST',
        body: {
          prevPosition: prevPos,
          nextPosition: nextPos,
          expectedVersion: current.version,
        },
      });
      loadBoard();
    } catch (err) {
      store.setToast(err.message || 'Failed to move column', 'error');
    }
  }

  async function deleteColumn(column) {
    if (!confirm(`Are you sure you want to delete column "${column.name}"?`)) {
      return;
    }

    try {
      await api(`/api/columns/${column.id}`, { method: 'DELETE' });
      store.setToast('Column deleted', 'success');
      loadBoard();
    } catch (err) {
      store.setToast(err.message || 'Failed to delete column', 'error');
    }
  }

  async function handleFilterChange(newFilters) {
    filters = newFilters;
    offset = 0;
    syncUrl();
    if (viewMode === 'list') {
      await fetchListTasks();
    }
    render();
  }

  async function handleSort(field) {
    if (sortBy === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = field;
      sortDir = 'asc';
    }
    offset = 0;
    syncUrl();
    await fetchListTasks();
    render();
  }

  async function handlePageChange(newOffset) {
    offset = newOffset;
    syncUrl();
    await fetchListTasks();
    render();
  }

  async function setView(mode) {
    if (viewMode === mode) return;
    viewMode = mode;
    offset = 0;
    syncUrl();
    if (viewMode === 'list') {
      await fetchListTasks();
    }
    render();
  }

  function render() {
    clearChildren(container);

    if (isLoading && !board) {
      container.appendChild(h('div', { className: 'tb-loading' }, 'Loading board...'));
      return;
    }

    if (!board) {
      container.appendChild(
        h(
          'div',
          { className: 'tb-card', style: 'text-align: center;' },
          h('h2', {}, 'No Board Found'),
          h('p', { className: 'tb-text-muted' }, 'Could not find a board for this project.'),
          h('a', { href: `/w/${wsId}/p/${projectId}`, className: 'tb-btn tb-btn-primary', style: 'margin-top: 16px;' }, 'Back to Project')
        )
      );
      return;
    }

    const perms = board.permissions || {};
    const columns = board.columns || [];

    const breadcrumbs = h(
      'div',
      { style: 'margin-bottom: var(--space-3); font-size: var(--font-size-sm); color: var(--color-text-muted);' },
      h('a', { href: `/w/${wsId}/projects` }, 'Projects'),
      h('span', { style: 'margin: 0 8px;' }, '/'),
      h('a', { href: `/w/${wsId}/p/${projectId}` }, board.project_name || 'Project'),
      h('span', { style: 'margin: 0 8px;' }, '/'),
      h('span', { style: 'color: var(--color-text-main); font-weight: 500;' }, board.name)
    );

    // View Switcher (Board ⇄ List)
    const viewSwitcher = h(
      'div',
      { className: 'tb-view-switcher', role: 'group', 'aria-label': 'Select view mode' },
      h(
        'button',
        {
          type: 'button',
          className: `tb-view-btn ${viewMode === 'board' ? 'is-active' : ''}`,
          'aria-pressed': viewMode === 'board',
          onclick: () => setView('board'),
        },
        '☷ Board'
      ),
      h(
        'button',
        {
          type: 'button',
          className: `tb-view-btn ${viewMode === 'list' ? 'is-active' : ''}`,
          'aria-pressed': viewMode === 'list',
          onclick: () => setView('list'),
        },
        '☰ List'
      )
    );

    const header = h(
      'div',
      { className: 'tb-board-header', style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: 12px;' },
      h(
        'div',
        { style: 'display: flex; align-items: center; gap: 12px;' },
        h('h1', { className: 'tb-page-title', style: 'margin: 0;' }, board.name),
        h('span', { className: 'tb-badge' }, `${columns.length} columns`),
        presenceUsers.length > 0
          ? h(
              'div',
              {
                className: 'tb-board-presence',
                style: 'display: flex; gap: 4px; align-items: center; margin-left: 8px;',
                title: `${presenceUsers.length} collaborator(s) viewing this board`,
              },
              ...presenceUsers.map((u) => avatar({ name: u.name, size: 'sm', avatarUrl: u.avatarUrl }))
            )
          : null
      ),
      h(
        'div',
        { style: 'display: flex; align-items: center; gap: 12px;' },
        viewSwitcher,
        perms.canManage
          ? h(
              'button',
              { className: 'tb-btn tb-btn-primary tb-btn-sm', onclick: openAddColumnDialog },
              '+ Add Column'
            )
          : null
      )
    );

    // Filter Bar
    const filterBar = taskFilterBar({
      filters,
      columns,
      members: projectMembers,
      labels: projectLabels,
      onFilterChange: handleFilterChange,
    });

    container.appendChild(breadcrumbs);
    container.appendChild(header);
    container.appendChild(filterBar);

    if (viewMode === 'list') {
      // List View: task table
      const tableEl = taskTable({
        tasks: listTasks,
        total: listTotal,
        limit,
        offset,
        sortBy,
        sortDir,
        onSort: handleSort,
        onPageChange: handlePageChange,
        onTaskClick: (task) =>
          openTaskPanel({
            taskId: task.id,
            columns,
            onUpdated: refreshData,
          }),
      });
      container.appendChild(tableEl);
    } else {
      // Board View: Kanban columns with filtered task cards
      const boardScroll = h(
        'div',
        { className: 'tb-board-columns-container' },
        ...columns.map((col, idx) => {
          const allTasks = col.tasks || [];
          const visibleTasks = allTasks.filter(matchesFilters);
          let columnEl;

          columnEl = h(
            'div',
            {
              className: 'tb-board-column',
              ondragover: (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                columnEl.classList.add('is-dragover');
              },
              ondragleave: () => {
                columnEl.classList.remove('is-dragover');
              },
              ondrop: async (e) => {
                e.preventDefault();
                columnEl.classList.remove('is-dragover');
                try {
                  const dataStr = e.dataTransfer.getData('text/plain');
                  const data = JSON.parse(dataStr);
                  if (data && data.taskId && data.columnId !== col.id) {
                    const currentTask = await api(`/api/tasks/${data.taskId}`);
                    await api(`/api/tasks/${data.taskId}/move`, {
                      method: 'POST',
                      body: {
                        columnId: col.id,
                        expectedVersion: currentTask.version,
                      },
                    });
                    refreshData();
                  }
                } catch (err) {
                  store.setToast(err.message || 'Failed to move task', 'error');
                }
              },
            },
            h(
              'div',
              { className: 'tb-column-header' },
              h(
                'div',
                { style: 'display: flex; align-items: center; gap: 8px;' },
                h('h3', { className: 'tb-column-title' }, col.name),
                h(
                  'span',
                  { className: `tb-badge tb-badge-category-${col.category}` },
                  `${visibleTasks.length}${visibleTasks.length !== allTasks.length ? `/${allTasks.length}` : ''}`
                )
              ),
              perms.canManage
                ? h(
                    'div',
                    { className: 'tb-column-actions', style: 'display: flex; gap: 4px;' },
                    h(
                      'button',
                      {
                        className: 'tb-btn-icon',
                        title: 'Move Left',
                        disabled: idx === 0,
                        onclick: () => moveColumn(idx, -1),
                      },
                      '←'
                    ),
                    h(
                      'button',
                      {
                        className: 'tb-btn-icon',
                        title: 'Move Right',
                        disabled: idx === columns.length - 1,
                        onclick: () => moveColumn(idx, 1),
                      },
                      '→'
                    ),
                    h(
                      'button',
                      {
                        className: 'tb-btn-icon',
                        title: 'Edit Column',
                        onclick: () => openRenameColumnDialog(col),
                      },
                      '✎'
                    ),
                    h(
                      'button',
                      {
                        className: 'tb-btn-icon tb-btn-icon-danger',
                        title: 'Delete Column',
                        onclick: () => deleteColumn(col),
                      },
                      '×'
                    )
                  )
                : null
            ),
            h(
              'div',
              { className: 'tb-column-cards' },
              visibleTasks.length === 0
                ? h(
                    'div',
                    { className: 'tb-column-empty' },
                    allTasks.length === 0 ? 'No tasks in column.' : 'No matching tasks.'
                  )
                : visibleTasks.map((t) =>
                    taskCard({
                      task: t,
                      columns,
                      onOpen: (taskToOpen) =>
                        openTaskPanel({
                          taskId: taskToOpen.id,
                          columns,
                          onUpdated: refreshData,
                        }),
                      onMoveToColumn: (taskToMove, targetColId) =>
                        moveTaskToColumn(taskToMove, targetColId),
                    })
                  )
            ),
            h(
              'div',
              { className: 'tb-column-footer', style: 'padding: 8px; border-top: 1px solid var(--border);' },
              h(
                'button',
                {
                  className: 'tb-btn tb-btn-ghost tb-btn-sm',
                  style: 'width: 100%; justify-content: flex-start;',
                  onclick: () => openQuickAddTaskDialog(col),
                },
                '+ Add Task'
              )
            )
          );

          return columnEl;
        })
      );
      container.appendChild(boardScroll);
    }
  }

  // Socket.IO real-time subscription
  socketClient.joinProject(projectId, {
    onPresence: (users) => {
      presenceUsers = users || [];
      render();
    },
    onEvent: () => {
      refreshData();
    },
  });

  container.destroy = () => {
    socketClient.leaveProject(projectId);
  };

  loadBoard();
  return container;
}
