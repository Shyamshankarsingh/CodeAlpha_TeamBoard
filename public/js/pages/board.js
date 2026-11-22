import { h, clearChildren } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { dialog } from '../components/dialog.js';
import { taskCard } from '../components/task-card.js';
import { openTaskPanel } from '../components/task-panel.js';

export function BoardPage(params) {
  const wsId = params.workspaceId || store.getState().currentWorkspaceId;
  const projectId = params.projectId;
  const boardId = params.boardId;

  const container = h('div', { className: 'tb-board-page' });

  let board = null;
  let activeBoardId = boardId;
  let isLoading = true;

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

      board = await api(`/api/boards/${activeBoardId}`);
    } catch (err) {
      store.setToast(err.message || 'Failed to load board', 'error');
    } finally {
      isLoading = false;
      render();
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
            loadBoard();
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
      loadBoard();
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
      // Moving left: insert before targetIndex
      prevPos = targetIndex > 0 ? columns[targetIndex - 1].position : null;
      nextPos = columns[targetIndex].position;
    } else {
      // Moving right: insert after targetIndex
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

  function render() {
    clearChildren(container);

    if (isLoading && !board) {
      container.appendChild(h('div', { className: 'tb-loading' }, 'Loading Kanban board...'));
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

    const header = h(
      'div',
      { className: 'tb-board-header', style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);' },
      h(
        'div',
        { style: 'display: flex; align-items: center; gap: 12px;' },
        h('h1', { className: 'tb-page-title', style: 'margin: 0;' }, board.name),
        h('span', { className: 'tb-badge' }, `${columns.length} columns`)
      ),
      h(
        'div',
        { style: 'display: flex; gap: 8px;' },
        perms.canManage
          ? h(
              'button',
              { className: 'tb-btn tb-btn-primary tb-btn-sm', onclick: openAddColumnDialog },
              '+ Add Column'
            )
          : null
      )
    );

    const boardScroll = h(
      'div',
      { className: 'tb-board-columns-container' },
      ...columns.map((col, idx) => {
        const tasks = col.tasks || [];
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
                  loadBoard();
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
              h('span', { className: `tb-badge tb-badge-category-${col.category}` }, `${tasks.length}`)
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
            tasks.length === 0
              ? h('div', { className: 'tb-column-empty' }, 'No tasks in column.')
              : tasks.map((t) =>
                  taskCard({
                    task: t,
                    columns,
                    onOpen: (taskToOpen) =>
                      openTaskPanel({
                        taskId: taskToOpen.id,
                        columns,
                        onUpdated: loadBoard,
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

    container.appendChild(breadcrumbs);
    container.appendChild(header);
    container.appendChild(boardScroll);
  }

  loadBoard();
  return container;
}
