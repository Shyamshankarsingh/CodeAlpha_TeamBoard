import { h, clearChildren } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { dialog } from './dialog.js';
import { avatar } from './avatar.js';

export function openTaskPanel({ taskId, columns = [], onUpdated }) {
  let task = null;
  let workspaceMembers = [];
  let projectLabels = [];
  let comments = [];
  let attachments = [];
  let dependencies = { blockedBy: [], blocks: [] };
  let modal = null;

  const contentContainer = h('div', { className: 'tb-task-panel-content' });

  async function loadData() {
    try {
      task = await api(`/api/tasks/${taskId}`);
      workspaceMembers = await api(`/api/workspaces/${task.workspaceId}/members`);
      projectLabels = await api(`/api/projects/${task.projectId}/labels`);
      comments = await api(`/api/tasks/${taskId}/comments`);
      try {
        const attRes = await api(`/api/tasks/${taskId}/attachments`);
        attachments = attRes.attachments || [];
      } catch {}
      try {
        dependencies = await api(`/api/tasks/${taskId}/dependencies`);
      } catch {}
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

    // Comments Section
    let newCommentInput;
    const commentsSection = h(
      'div',
      { className: 'tb-panel-section', style: 'margin-top: var(--space-6);' },
      h('h4', { className: 'tb-section-title' }, `Comments (${comments.length})`),
      h(
        'form',
        {
          style: 'display: flex; flex-direction: column; gap: 8px; margin: 12px 0;',
          onsubmit: async (e) => {
            e.preventDefault();
            const text = newCommentInput.value.trim();
            if (!text) return;
            try {
              await api(`/api/tasks/${taskId}/comments`, {
                method: 'POST',
                body: { body: text },
              });
              newCommentInput.value = '';
              comments = await api(`/api/tasks/${taskId}/comments`);
              render();
            } catch (err) {
              store.setToast(err.message || 'Failed to post comment', 'error');
            }
          },
        },
        (newCommentInput = h('textarea', {
          className: 'tb-input',
          rows: 2,
          placeholder: 'Write a comment... (use @ to mention)',
          maxLength: 5000,
        })),
        h(
          'div',
          { style: 'display: flex; justify-content: flex-end;' },
          h('button', { type: 'submit', className: 'tb-btn tb-btn-primary tb-btn-sm' }, 'Post Comment')
        )
      ),
      h(
        'div',
        { className: 'tb-comments-thread', style: 'display: flex; flex-direction: column; gap: 12px;' },
        ...comments.map((root) => {
          let replyBox;
          const rootEl = h(
            'div',
            { className: 'tb-comment-item', style: 'padding: 8px; border: 1px solid var(--border); border-radius: var(--radius-sm);' },
            h(
              'div',
              { style: 'display: flex; justify-content: space-between; align-items: center;' },
              h(
                'div',
                { style: 'display: flex; align-items: center; gap: 8px;' },
                avatar(root.author ? root.author.name : 'User', 'sm'),
                h('strong', { style: 'font-size: var(--font-size-sm);' }, root.author ? root.author.name : 'User'),
                h('span', { style: 'font-size: var(--font-size-xs); color: var(--color-text-muted);' }, new Date(root.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
              ),
              h(
                'div',
                { style: 'display: flex; gap: 4px;' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'tb-btn tb-btn-ghost tb-btn-sm',
                    style: 'font-size: var(--font-size-xs); padding: 2px 6px;',
                    onclick: () => {
                      replyBox.style.display = replyBox.style.display === 'none' ? 'flex' : 'none';
                    },
                  },
                  'Reply'
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'tb-btn-icon tb-btn-icon-danger',
                    onclick: async () => {
                      if (!confirm('Delete comment?')) return;
                      try {
                        await api(`/api/comments/${root.id}`, { method: 'DELETE' });
                        comments = await api(`/api/tasks/${taskId}/comments`);
                        render();
                      } catch (err) {
                        store.setToast(err.message || 'Failed to delete comment', 'error');
                      }
                    },
                  },
                  '×'
                )
              )
            ),
            h('p', { style: `margin: 6px 0; font-size: var(--font-size-sm); ${root.isDeleted ? 'color: var(--color-text-muted); font-style: italic;' : ''}` }, root.body),
            // Nested replies (FR-C1: 1 level)
            (root.replies || []).length > 0
              ? h(
                  'div',
                  { style: 'margin-left: 24px; padding-left: 8px; border-left: 2px solid var(--border); display: flex; flex-direction: column; gap: 8px; margin-top: 8px;' },
                  ...root.replies.map((reply) =>
                    h(
                      'div',
                      { style: 'font-size: var(--font-size-sm);' },
                      h(
                        'div',
                        { style: 'display: flex; justify-content: space-between; align-items: center;' },
                        h(
                          'div',
                          { style: 'display: flex; align-items: center; gap: 6px;' },
                          avatar(reply.author ? reply.author.name : 'User', 'sm'),
                          h('strong', { style: 'font-size: var(--font-size-xs);' }, reply.author ? reply.author.name : 'User'),
                          h('span', { style: 'font-size: var(--font-size-xs); color: var(--color-text-muted);' }, new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'tb-btn-icon tb-btn-icon-danger',
                            onclick: async () => {
                              if (!confirm('Delete reply?')) return;
                              try {
                                await api(`/api/comments/${reply.id}`, { method: 'DELETE' });
                                comments = await api(`/api/tasks/${taskId}/comments`);
                                render();
                              } catch (err) {
                                store.setToast(err.message || 'Failed to delete reply', 'error');
                              }
                            },
                          },
                          '×'
                        )
                      ),
                      h('p', { style: `margin: 4px 0; font-size: var(--font-size-xs); ${reply.isDeleted ? 'color: var(--color-text-muted); font-style: italic;' : ''}` }, reply.body)
                    )
                  )
                )
              : null,
            // Reply Input Form
            (replyBox = h(
              'form',
              {
                style: 'display: none; gap: 6px; margin-top: 8px; margin-left: 24px;',
                onsubmit: async (e) => {
                  e.preventDefault();
                  const replyText = replyInput.value.trim();
                  if (!replyText) return;
                  try {
                    await api(`/api/tasks/${taskId}/comments`, {
                      method: 'POST',
                      body: { body: replyText, parentId: root.id },
                    });
                    comments = await api(`/api/tasks/${taskId}/comments`);
                    render();
                  } catch (err) {
                    store.setToast(err.message || 'Failed to reply', 'error');
                  }
                },
              },
              (replyInput = h('input', {
                type: 'text',
                className: 'tb-input',
                placeholder: 'Write a reply...',
                maxLength: 5000,
              })),
              h('button', { type: 'submit', className: 'tb-btn tb-btn-secondary tb-btn-sm' }, 'Reply')
            ))
          );
          let replyInput;
          return rootEl;
        })
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

    // Attachments Section
    const fileInput = h('input', { type: 'file', style: 'display: none;' });
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': store.get('csrfToken') },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'Upload failed');
        }
        const data = await res.json();
        attachments.unshift(data.attachment);
        store.setToast('File attached', 'success');
        render();
      } catch (err) {
        store.setToast(err.message, 'error');
      }
    });

    const attachmentsSection = h('div', { className: 'tb-panel-section', style: 'margin-top: var(--space-6);' }, [
      h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' }, [
        h('h4', { className: 'tb-section-title' }, [`Attachments (${attachments.length})`]),
        h('button', {
          type: 'button',
          className: 'tb-btn tb-btn-outline tb-btn-sm',
          onclick: () => fileInput.click(),
        }, ['+ Attach File']),
      ]),
      fileInput,
      h('div', { className: 'tb-attachments-list', style: 'display: flex; flex-direction: column; gap: 8px; margin-top: 8px;' },
        attachments.map(att =>
          h('div', { style: 'display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--color-bg-secondary); border-radius: var(--radius-sm); font-size: 0.85rem;' }, [
            h('a', {
              href: `/api/attachments/${att.id}/download`,
              style: 'color: var(--color-primary); text-decoration: none; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;',
              download: att.fileName,
            }, [att.fileName]),
            h('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
              h('span', { style: 'color: var(--color-text-muted); font-size: 0.75rem;' }, [
                `${Math.round(att.fileSize / 1024)} KB`
              ]),
              h('button', {
                type: 'button',
                className: 'tb-btn tb-btn-ghost tb-btn-sm',
                style: 'color: var(--color-danger); padding: 0 4px; line-height: 1;',
                onclick: async () => {
                  if (!confirm(`Delete ${att.fileName}?`)) return;
                  try {
                    await api(`/api/attachments/${att.id}`, { method: 'DELETE' });
                    attachments = attachments.filter(a => a.id !== att.id);
                    store.setToast('Attachment deleted', 'success');
                    render();
                  } catch (err) {
                    store.setToast(err.message || 'Failed to delete attachment', 'error');
                  }
                },
              }, ['×']),
            ]),
          ])
        )
      ),
    ]);

    // Dependencies Section
    const dependenciesSection = h('div', { className: 'tb-panel-section', style: 'margin-top: var(--space-6);' }, [
      h('h4', { className: 'tb-section-title' }, ['Dependencies']),
      h('div', { style: 'margin-top: 6px;' }, [
        h('span', { style: 'font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted);' }, ['Blocked by:']),
        (dependencies.blockedBy && dependencies.blockedBy.length > 0)
          ? h('div', { style: 'display: flex; flex-direction: column; gap: 6px; margin-top: 4px;' },
              dependencies.blockedBy.map(dep =>
                h('div', { style: 'display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; padding: 4px 8px; background: var(--color-bg-secondary); border-radius: var(--radius-sm);' }, [
                  h('span', {}, [dep.title]),
                  h('button', {
                    type: 'button',
                    className: 'tb-btn tb-btn-ghost tb-btn-sm',
                    style: 'color: var(--color-danger); padding: 0 4px;',
                    onclick: async () => {
                      try {
                        await api(`/api/dependencies/${dep.dependencyId}`, { method: 'DELETE' });
                        dependencies.blockedBy = dependencies.blockedBy.filter(d => d.dependencyId !== dep.dependencyId);
                        store.setToast('Dependency removed', 'success');
                        render();
                      } catch (err) {
                        store.setToast(err.message || 'Failed to remove dependency', 'error');
                      }
                    },
                  }, ['×']),
                ])
              )
            )
          : h('p', { style: 'font-size: 0.8rem; color: var(--color-text-muted); margin: 4px 0;' }, ['No blocking tasks']),
      ]),
      (dependencies.blocks && dependencies.blocks.length > 0)
        ? h('div', { style: 'margin-top: 8px;' }, [
            h('span', { style: 'font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted);' }, ['Blocks:']),
            h('div', { style: 'display: flex; flex-direction: column; gap: 6px; margin-top: 4px;' },
              dependencies.blocks.map(b =>
                h('div', { style: 'font-size: 0.85rem; padding: 4px 8px; background: var(--color-bg-secondary); border-radius: var(--radius-sm);' }, [
                  b.title
                ])
              )
            ),
          ])
        : null,
    ]);

    contentContainer.appendChild(mainForm);
    contentContainer.appendChild(assigneesSection);
    contentContainer.appendChild(labelsSection);
    contentContainer.appendChild(subtasksSection);
    contentContainer.appendChild(attachmentsSection);
    contentContainer.appendChild(dependenciesSection);
    contentContainer.appendChild(footerActions);
  }

  modal = dialog({
    title: 'Task Details',
    content: contentContainer,
    className: 'tb-task-panel-dialog',
  });

  loadData();
}
