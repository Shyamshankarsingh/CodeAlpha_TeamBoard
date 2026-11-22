import { h, clearChildren } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { dialog } from './dialog.js';

export function openTaskPanel({ taskId, columns = [], onUpdated }) {
  let task = null;
  let workspaceMembers = [];
  let projectLabels = [];
  let modal = null;

  const contentContainer = h('div', { className: 'tb-task-panel-content' });

  async function loadData() {
    try {
      task = await api(`/api/tasks/${taskId}`);
      // Load workspace members for assignee selection
      workspaceMembers = await api(`/api/workspaces/${task.workspaceId}/members`);
      // Load project labels
      projectLabels = await api(`/api/projects/${task.projectId}/labels`);
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to load task details', 'error');
      if (modal) modal.close();
    }
  }

  async function saveDetails(updates) {
    try {
      const updated = await api(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: {
          ...updates,
          expectedVersion: task.version,
        },
      });
      task = updated;
      store.setToast('Task saved', 'success');
      if (typeof onUpdated === 'function') onUpdated();
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to update task', 'error');
      if (err.code === 'CONCURRENCY_CONFLICT') {
        loadData();
      }
    }
  }

  async function toggleAssignee(userId) {
    const current = (task.assignees || []).map((a) => a.id);
    const updated = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];

    try {
      const newAssignees = await api(`/api/tasks/${taskId}/assignees`, {
        method: 'PUT',
        body: { userIds: updated },
      });
      task.assignees = newAssignees;
      if (typeof onUpdated === 'function') onUpdated();
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to update assignees', 'error');
    }
  }

  async function toggleLabel(labelId) {
    const current = (task.labels || []).map((l) => l.id);
    const updated = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];

    try {
      const newLabels = await api(`/api/tasks/${taskId}/labels`, {
        method: 'PUT',
        body: { labelIds: updated },
      });
      task.labels = newLabels;
      if (typeof onUpdated === 'function') onUpdated();
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to update labels', 'error');
    }
  }

  async function addSubtask(title) {
    if (!title.trim()) return;
    try {
      await api(`/api/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: { title: title.trim() },
      });
      task = await api(`/api/tasks/${taskId}`);
      if (typeof onUpdated === 'function') onUpdated();
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to add subtask', 'error');
    }
  }

  async function toggleSubtask(subtaskId, completed) {
    try {
      await api(`/api/subtasks/${subtaskId}`, {
        method: 'PATCH',
        body: { completed },
      });
      task = await api(`/api/tasks/${taskId}`);
      if (typeof onUpdated === 'function') onUpdated();
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to update subtask', 'error');
    }
  }

  async function deleteSubtask(subtaskId) {
    try {
      await api(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
      task = await api(`/api/tasks/${taskId}`);
      if (typeof onUpdated === 'function') onUpdated();
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to delete subtask', 'error');
    }
  }

  async function handleMove(targetColId) {
    try {
      const updated = await api(`/api/tasks/${taskId}/move`, {
        method: 'POST',
        body: {
          columnId: targetColId,
          expectedVersion: task.version,
        },
      });
      task = updated;
      store.setToast('Task moved', 'success');
      if (typeof onUpdated === 'function') onUpdated();
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to move task', 'error');
    }
  }

  function render() {
    clearChildren(contentContainer);
    if (!task) {
      contentContainer.appendChild(h('div', { className: 'tb-loading' }, 'Loading...'));
      return;
    }

    let titleInput, descInput, prioritySelect, startInput, dueInput;

    const mainForm = h(
      'form',
      {
        className: 'tb-task-panel-form',
        onsubmit: (e) => {
          e.preventDefault();
          saveDetails({
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            priority: prioritySelect.value,
            startDate: startInput.value || null,
            dueDate: dueInput.value || null,
          });
        },
      },
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Title *'),
        (titleInput = h('input', {
          type: 'text',
          className: 'tb-input',
          value: task.title,
          required: true,
          maxLength: 200,
        }))
      ),
      h(
        'div',
        { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);' },
        h(
          'div',
          { className: 'tb-form-group' },
          h('label', { className: 'tb-label' }, 'Column / Status'),
          h(
            'select',
            {
              className: 'tb-select',
              onchange: (e) => handleMove(e.target.value),
            },
            ...columns.map((c) =>
              h('option', { value: c.id, selected: c.id === task.columnId }, `${c.name} (${c.category})`)
            )
          )
        ),
        h(
          'div',
          { className: 'tb-form-group' },
          h('label', { className: 'tb-label' }, 'Priority'),
          (prioritySelect = h(
            'select',
            { className: 'tb-select' },
            h('option', { value: 'none', selected: task.priority === 'none' }, 'None'),
            h('option', { value: 'low', selected: task.priority === 'low' }, 'Low'),
            h('option', { value: 'medium', selected: task.priority === 'medium' }, 'Medium'),
            h('option', { value: 'high', selected: task.priority === 'high' }, 'High'),
            h('option', { value: 'urgent', selected: task.priority === 'urgent' }, 'Urgent')
          ))
        )
      ),
      h(
        'div',
        { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);' },
        h(
          'div',
          { className: 'tb-form-group' },
          h('label', { className: 'tb-label' }, 'Start Date'),
          (startInput = h('input', { type: 'date', className: 'tb-input', value: task.startDate || '' }))
        ),
        h(
          'div',
          { className: 'tb-form-group' },
          h('label', { className: 'tb-label' }, 'Due Date'),
          (dueInput = h('input', { type: 'date', className: 'tb-input', value: task.dueDate || '' }))
        )
      ),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Description'),
        (descInput = h('textarea', {
          className: 'tb-input',
          rows: 4,
          value: task.description || '',
          maxLength: 10000,
        }))
      ),
      h(
        'div',
        { className: 'tb-form-actions', style: 'margin-bottom: var(--space-6);' },
        h('button', { type: 'submit', className: 'tb-btn tb-btn-primary' }, 'Save Changes')
      )
    );

    // Assignees Section
    const currentAssigneeIds = (task.assignees || []).map((a) => a.id);
    const assigneesSection = h(
      'div',
      { className: 'tb-panel-section' },
      h('h4', { className: 'tb-section-title' }, 'Assignees'),
      h(
        'div',
        { className: 'tb-assignee-chips', style: 'display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;' },
        ...workspaceMembers.map((m) => {
          const isAssigned = currentAssigneeIds.includes(m.userId);
          return h(
            'button',
            {
              type: 'button',
              className: `tb-chip ${isAssigned ? 'is-active' : ''}`,
              onclick: () => toggleAssignee(m.userId),
            },
            isAssigned ? '✓ ' : '+ ',
            m.name || 'Member'
          );
        })
      )
    );

    // Labels Section
    const currentLabelIds = (task.labels || []).map((l) => l.id);
    const labelsSection = h(
      'div',
      { className: 'tb-panel-section', style: 'margin-top: var(--space-4);' },
      h('h4', { className: 'tb-section-title' }, 'Labels'),
      h(
        'div',
        { style: 'display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;' },
        ...projectLabels.map((l) => {
          const isApplied = currentLabelIds.includes(l.id);
          return h(
            'button',
            {
              type: 'button',
              className: `tb-chip ${isApplied ? 'is-active' : ''}`,
              style: isApplied ? `background-color: ${l.color}; color: #FFFFFF;` : '',
              onclick: () => toggleLabel(l.id),
            },
            isApplied ? '✓ ' : '+ ',
            l.name
          );
        })
      )
    );

    // Subtasks Section
    let subtaskInput;
    const subtasksSection = h(
      'div',
      { className: 'tb-panel-section', style: 'margin-top: var(--space-6);' },
      h('h4', { className: 'tb-section-title' }, 'Subtasks'),
      h(
        'div',
        { className: 'tb-subtasks-list', style: 'display: flex; flex-direction: column; gap: 8px; margin: 8px 0;' },
        ...(task.subtasks || []).map((s) =>
          h(
            'div',
            { style: 'display: flex; align-items: center; justify-content: space-between; gap: 8px;' },
            h(
              'label',
              { style: 'display: flex; align-items: center; gap: 8px; cursor: pointer;' },
              h('input', {
                type: 'checkbox',
                checked: Boolean(s.completed),
                onchange: (e) => toggleSubtask(s.id, e.target.checked),
              }),
              h(
                'span',
                { style: s.completed ? 'text-decoration: line-through; color: var(--color-text-muted);' : '' },
                s.title
              )
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'tb-btn-icon tb-btn-icon-danger',
                onclick: () => deleteSubtask(s.id),
              },
              '×'
            )
          )
        )
      ),
      h(
        'form',
        {
          style: 'display: flex; gap: 8px; margin-top: 8px;',
          onsubmit: (e) => {
            e.preventDefault();
            addSubtask(subtaskInput.value);
            subtaskInput.value = '';
          },
        },
        (subtaskInput = h('input', {
          type: 'text',
          className: 'tb-input',
          placeholder: 'Add a subtask...',
          maxLength: 200,
        })),
        h('button', { type: 'submit', className: 'tb-btn tb-btn-secondary' }, 'Add')
      )
    );

    // Footer actions (Duplicate, Archive, Delete)
    const footerActions = h(
      'div',
      { style: 'display: flex; justify-content: space-between; margin-top: var(--space-8); padding-top: var(--space-4); border-top: 1px solid var(--border);' },
      h(
        'div',
        { style: 'display: flex; gap: 8px;' },
        h(
          'button',
          {
            type: 'button',
            className: 'tb-btn tb-btn-secondary tb-btn-sm',
            onclick: async () => {
              try {
                await api(`/api/tasks/${taskId}/duplicate`, { method: 'POST' });
                store.setToast('Task duplicated', 'success');
                modal.close();
                if (typeof onUpdated === 'function') onUpdated();
              } catch (err) {
                store.setToast(err.message || 'Failed to duplicate task', 'error');
              }
            },
          },
          'Duplicate'
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'tb-btn tb-btn-ghost tb-btn-sm',
            onclick: async () => {
              try {
                await api(`/api/tasks/${taskId}/archive`, {
                  method: 'POST',
                  body: { expectedVersion: task.version },
                });
                store.setToast('Task archived', 'success');
                modal.close();
                if (typeof onUpdated === 'function') onUpdated();
              } catch (err) {
                store.setToast(err.message || 'Failed to archive task', 'error');
              }
            },
          },
          'Archive'
        )
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'tb-btn tb-btn-danger tb-btn-sm',
          onclick: async () => {
            if (!confirm(`Permanently delete "${task.title}"?`)) return;
            try {
              await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
              store.setToast('Task deleted', 'success');
              modal.close();
              if (typeof onUpdated === 'function') onUpdated();
            } catch (err) {
              store.setToast(err.message || 'Failed to delete task', 'error');
            }
          },
        },
        'Delete'
      )
    );

    contentContainer.appendChild(mainForm);
    contentContainer.appendChild(assigneesSection);
    contentContainer.appendChild(labelsSection);
    contentContainer.appendChild(subtasksSection);
    contentContainer.appendChild(footerActions);
  }

  modal = dialog({
    title: 'Task Details',
    content: contentContainer,
  });

  loadData();
}
