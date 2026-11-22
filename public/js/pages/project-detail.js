import { h, clearChildren } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { dialog } from '../components/dialog.js';
import { avatar } from '../components/avatar.js';

export function ProjectDetailPage(params) {
  const projectId = params.projectId;
  const wsId = params.workspaceId || store.getState().currentWorkspaceId;
  const container = h('div', { className: 'tb-project-detail-page' });

  let project = null;
  let members = [];
  let activity = [];
  let nextCursor = null;
  let activeTab = 'overview'; // 'overview', 'members', 'activity'
  let isLoading = true;

  async function loadData() {
    isLoading = true;
    render();
    try {
      project = await api(`/api/projects/${projectId}`);
      if (activeTab === 'members') {
        members = await api(`/api/projects/${projectId}/members`);
      } else if (activeTab === 'activity') {
        const actRes = await api(`/api/projects/${projectId}/activity`);
        activity = actRes || [];
      }
    } catch (err) {
      store.setToast(err.message || 'Failed to load project', 'error');
    } finally {
      isLoading = false;
      render();
    }
  }

  async function switchTab(tab) {
    activeTab = tab;
    render();
    if (tab === 'members') {
      try {
        members = await api(`/api/projects/${projectId}/members`);
      } catch (err) {
        store.setToast(err.message || 'Failed to load members', 'error');
      }
    } else if (tab === 'activity') {
      try {
        const actRes = await api(`/api/projects/${projectId}/activity`);
        activity = actRes || [];
      } catch (err) {
        store.setToast(err.message || 'Failed to load activity', 'error');
      }
    }
    render();
  }

  function openEditDialog() {
    let nameInput, descInput, visibilitySelect, prioritySelect, startInput, deadlineInput, errorEl;

    const form = h(
      'form',
      {
        className: 'tb-form',
        onsubmit: async (e) => {
          e.preventDefault();
          errorEl.textContent = '';
          try {
            const body = {
              name: nameInput.value.trim(),
              description: descInput.value.trim(),
              visibility: visibilitySelect.value,
              priority: prioritySelect.value,
              startDate: startInput.value || null,
              deadline: deadlineInput.value || null,
              expectedVersion: project.version,
            };
            const updated = await api(`/api/projects/${projectId}`, {
              method: 'PATCH',
              body,
            });
            modal.close();
            project = updated;
            store.setToast('Project updated successfully', 'success');
            render();
          } catch (err) {
            errorEl.textContent = err.message || 'Failed to update project';
          }
        },
      },
      (errorEl = h('div', { className: 'tb-form-error' })),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Project Name *'),
        (nameInput = h('input', {
          type: 'text',
          className: 'tb-input',
          value: project.name,
          required: true,
          maxLength: 100,
        }))
      ),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Description'),
        (descInput = h('textarea', {
          className: 'tb-input',
          rows: 3,
          value: project.description || '',
          maxLength: 5000,
        }))
      ),
      h(
        'div',
        { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);' },
        h(
          'div',
          { className: 'tb-form-group' },
          h('label', { className: 'tb-label' }, 'Visibility'),
          (visibilitySelect = h(
            'select',
            { className: 'tb-select' },
            h('option', { value: 'workspace', selected: project.visibility === 'workspace' }, 'Workspace'),
            h('option', { value: 'private', selected: project.visibility === 'private' }, 'Private')
          ))
        ),
        h(
          'div',
          { className: 'tb-form-group' },
          h('label', { className: 'tb-label' }, 'Priority'),
          (prioritySelect = h(
            'select',
            { className: 'tb-select' },
            h('option', { value: 'none', selected: project.priority === 'none' }, 'None'),
            h('option', { value: 'low', selected: project.priority === 'low' }, 'Low'),
            h('option', { value: 'medium', selected: project.priority === 'medium' }, 'Medium'),
            h('option', { value: 'high', selected: project.priority === 'high' }, 'High'),
            h('option', { value: 'urgent', selected: project.priority === 'urgent' }, 'Urgent')
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
          (startInput = h('input', { type: 'date', className: 'tb-input', value: project.startDate || '' }))
        ),
        h(
          'div',
          { className: 'tb-form-group' },
          h('label', { className: 'tb-label' }, 'Deadline'),
          (deadlineInput = h('input', { type: 'date', className: 'tb-input', value: project.deadline || '' }))
        )
      ),
      h(
        'div',
        { className: 'tb-form-actions', style: 'margin-top: var(--space-4);' },
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
      title: 'Edit Project Settings',
      content: form,
    });
  }

  function openDeleteDialog() {
    let confirmInput, errorEl;

    const form = h(
      'form',
      {
        className: 'tb-form',
        onsubmit: async (e) => {
          e.preventDefault();
          errorEl.textContent = '';
          try {
            await api(`/api/projects/${projectId}`, {
              method: 'DELETE',
              body: { confirmName: confirmInput.value.trim() },
            });
            modal.close();
            store.setToast('Project deleted', 'success');
            router.navigate(`/w/${wsId}/projects`);
          } catch (err) {
            errorEl.textContent = err.message || 'Failed to delete project';
          }
        },
      },
      (errorEl = h('div', { className: 'tb-form-error' })),
      h(
        'p',
        { style: 'margin-bottom: var(--space-4); color: var(--color-text-muted);' },
        `To confirm deletion, please type the project name: `,
        h('strong', {}, project.name)
      ),
      h(
        'div',
        { className: 'tb-form-group' },
        (confirmInput = h('input', {
          type: 'text',
          className: 'tb-input',
          placeholder: project.name,
          required: true,
        }))
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
        h('button', { type: 'submit', className: 'tb-btn tb-btn-danger' }, 'Delete Project')
      )
    );

    const modal = dialog({
      title: 'Delete Project',
      content: form,
    });
  }

  async function toggleArchive() {
    try {
      const isArchived = Boolean(project.archivedAt);
      const endpoint = isArchived ? `/api/projects/${projectId}/unarchive` : `/api/projects/${projectId}/archive`;
      const res = await api(endpoint, {
        method: 'POST',
        body: { expectedVersion: project.version },
      });
      project = res;
      store.setToast(isArchived ? 'Project restored' : 'Project archived', 'success');
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to change archive state', 'error');
    }
  }

  function openAddMemberDialog() {
    let userInput, roleSelect, errorEl;

    const form = h(
      'form',
      {
        className: 'tb-form',
        onsubmit: async (e) => {
          e.preventDefault();
          errorEl.textContent = '';
          const userId = userInput.value.trim();
          if (!userId) {
            errorEl.textContent = 'User ID is required';
            return;
          }

          try {
            await api(`/api/projects/${projectId}/members`, {
              method: 'POST',
              body: { userId, role: roleSelect.value },
            });
            modal.close();
            store.setToast('Member added to project', 'success');
            members = await api(`/api/projects/${projectId}/members`);
            render();
          } catch (err) {
            errorEl.textContent = err.message || 'Failed to add member';
          }
        },
      },
      (errorEl = h('div', { className: 'tb-form-error' })),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'User ID (from workspace) *'),
        (userInput = h('input', {
          type: 'text',
          className: 'tb-input',
          placeholder: 'User UUID',
          required: true,
        }))
      ),
      h(
        'div',
        { className: 'tb-form-group' },
        h('label', { className: 'tb-label' }, 'Project Role'),
        (roleSelect = h(
          'select',
          { className: 'tb-select' },
          h('option', { value: 'member' }, 'Member'),
          h('option', { value: 'lead' }, 'Lead')
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
        h('button', { type: 'submit', className: 'tb-btn tb-btn-primary' }, 'Add Member')
      )
    );

    const modal = dialog({
      title: 'Add Project Member',
      content: form,
    });
  }

  function render() {
    clearChildren(container);

    if (isLoading && !project) {
      container.appendChild(h('div', { className: 'tb-loading' }, 'Loading project details...'));
      return;
    }

    if (!project) {
      container.appendChild(
        h(
          'div',
          { className: 'tb-card', style: 'text-align: center;' },
          h('h2', {}, 'Project Not Found'),
          h('p', { className: 'tb-text-muted' }, 'This project does not exist or you lack access.'),
          h('a', { href: `/w/${wsId}/projects`, className: 'tb-btn tb-btn-primary', style: 'margin-top: 16px;' }, 'Back to Projects')
        )
      );
      return;
    }

    const perms = project.permissions || {};
    const stats = project.stats || { progress: 0, totalTasks: 0, completedTasks: 0 };

    const breadcrumbs = h(
      'div',
      { style: 'margin-bottom: var(--space-3); font-size: var(--font-size-sm); color: var(--color-text-muted);' },
      h('a', { href: `/w/${wsId}/projects` }, '← Projects'),
      h('span', { style: 'margin: 0 8px;' }, '/'),
      h('span', { style: 'color: var(--color-text-main); font-weight: 500;' }, project.name)
    );

    const header = h(
      'div',
      { className: 'tb-project-header', style: 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-6);' },
      h(
        'div',
        {},
        h(
          'div',
          { style: 'display: flex; align-items: center; gap: var(--space-3);' },
          h('h1', { className: 'tb-page-title' }, project.name),
          project.visibility === 'private'
            ? h('span', { className: 'tb-badge tb-badge-warning' }, '🔒 Private')
            : null,
          project.archivedAt
            ? h('span', { className: 'tb-badge tb-badge-danger' }, 'Archived')
            : null,
          project.priority !== 'none'
            ? h('span', { className: `tb-badge tb-badge-priority-${project.priority}` }, project.priority)
            : null
        ),
        h('p', { className: 'tb-text-muted', style: 'margin-top: var(--space-2); max-width: 700px;' }, project.description || 'No description.')
      ),
      h(
        'div',
        { style: 'display: flex; gap: var(--space-2);' },
        h(
          'a',
          { href: `/w/${wsId}/p/${projectId}/board`, className: 'tb-btn tb-btn-primary tb-btn-sm' },
          '📋 Open Board'
        ),
        perms.canEdit
          ? h(
              'button',
              { className: 'tb-btn tb-btn-secondary tb-btn-sm', onclick: openEditDialog },
              'Edit Settings'
            )
          : null,
        perms.canArchive
          ? h(
              'button',
              { className: 'tb-btn tb-btn-ghost tb-btn-sm', onclick: toggleArchive },
              project.archivedAt ? 'Unarchive' : 'Archive'
            )
          : null,
        perms.canDelete
          ? h(
              'button',
              { className: 'tb-btn tb-btn-danger tb-btn-sm', onclick: openDeleteDialog },
              'Delete'
            )
          : null
      )
    );

    const tabs = h(
      'div',
      { className: 'tb-tabs', style: 'margin-bottom: var(--space-6);' },
      h(
        'button',
        {
          className: `tb-tab ${activeTab === 'overview' ? 'active' : ''}`,
          onclick: () => switchTab('overview'),
        },
        'Overview'
      ),
      h(
        'button',
        {
          className: `tb-tab ${activeTab === 'members' ? 'active' : ''}`,
          onclick: () => switchTab('members'),
        },
        'Members'
      ),
      h(
        'button',
        {
          className: `tb-tab ${activeTab === 'activity' ? 'active' : ''}`,
          onclick: () => switchTab('activity'),
        },
        'Activity'
      )
    );

    let tabContent;
    if (activeTab === 'overview') {
      tabContent = h(
        'div',
        { className: 'tb-overview-grid', style: 'display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-6);' },
        h(
          'div',
          { className: 'tb-card' },
          h('h3', {}, 'Project Progress'),
          h(
            'div',
            { style: 'margin: var(--space-4) 0;' },
            h(
              'div',
              { style: 'display: flex; justify-content: space-between; margin-bottom: 6px; font-size: var(--font-size-sm);' },
              h('span', {}, `${stats.completedTasks} of ${stats.totalTasks} tasks completed`),
              h('strong', {}, `${stats.progress}%`)
            ),
            h(
              'div',
              { className: 'tb-progress-bar-track' },
              h('div', {
                className: 'tb-progress-bar-fill',
                style: `width: ${stats.progress}%;`,
              })
            )
          ),
          h(
            'div',
            { style: 'margin-top: var(--space-4);' },
            h(
              'a',
              { href: `/w/${wsId}/p/${projectId}/board`, className: 'tb-btn tb-btn-secondary tb-btn-sm' },
              'View Kanban Columns →'
            )
          )
        ),
        h(
          'div',
          { className: 'tb-card' },
          h('h3', {}, 'Details'),
          h(
            'ul',
            { style: 'display: flex; flex-direction: column; gap: 12px; margin-top: var(--space-4); font-size: var(--font-size-sm); list-style: none; padding: 0;' },
            h('li', {}, h('strong', {}, 'Start Date: '), project.startDate || 'None'),
            h('li', {}, h('strong', {}, 'Deadline: '), project.deadline || 'None'),
            h('li', {}, h('strong', {}, 'Visibility: '), project.visibility),
            h('li', {}, h('strong', {}, 'Owner: '), project.owner ? project.owner.name : 'Unknown'),
            h('li', {}, h('strong', {}, 'Your Role: '), project.role || 'Workspace Member')
          )
        )
      );
    } else if (activeTab === 'members') {
      tabContent = h(
        'div',
        { className: 'tb-card' },
        h(
          'div',
          { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);' },
          h('h3', {}, 'Project Members'),
          perms.canManageMembers
            ? h(
                'button',
                { className: 'tb-btn tb-btn-primary tb-btn-sm', onclick: openAddMemberDialog },
                '+ Add Member'
              )
            : null
        ),
        members.length === 0
          ? h('p', { className: 'tb-text-muted' }, 'No members loaded.')
          : h(
              'div',
              { className: 'tb-member-list' },
              ...members.map((m) =>
                h(
                  'div',
                  {
                    className: 'tb-member-item',
                    style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-border);',
                  },
                  h(
                    'div',
                    { style: 'display: flex; align-items: center; gap: 12px;' },
                    avatar(m.user ? m.user.name : 'User'),
                    h(
                      'div',
                      {},
                      h('div', { style: 'font-weight: 500;' }, m.user ? m.user.name : 'User'),
                      h('div', { className: 'tb-text-muted', style: 'font-size: var(--font-size-xs);' }, m.user ? m.user.email : '')
                    )
                  ),
                  h(
                    'div',
                    { style: 'display: flex; align-items: center; gap: 10px;' },
                    h('span', { className: 'tb-badge' }, m.role),
                    perms.canManageMembers && m.userId !== project.ownerId
                      ? h(
                          'button',
                          {
                            className: 'tb-btn tb-btn-danger tb-btn-sm',
                            onclick: async () => {
                              try {
                                await api(`/api/projects/${projectId}/members/${m.userId}`, { method: 'DELETE' });
                                members = await api(`/api/projects/${projectId}/members`);
                                store.setToast('Member removed', 'success');
                                render();
                              } catch (err) {
                                store.setToast(err.message || 'Failed to remove member', 'error');
                              }
                            },
                          },
                          'Remove'
                        )
                      : null
                  )
                )
              )
            )
      );
    } else if (activeTab === 'activity') {
      tabContent = h(
        'div',
        { className: 'tb-card' },
        h('h3', { style: 'margin-bottom: var(--space-4);' }, 'Activity Audit Log'),
        activity.length === 0
          ? h('p', { className: 'tb-text-muted' }, 'No activity recorded yet.')
          : h(
              'div',
              { className: 'tb-activity-feed', style: 'display: flex; flex-direction: column; gap: 12px;' },
              ...activity.map((act) =>
                h(
                  'div',
                  {
                    className: 'tb-activity-item',
                    style: 'display: flex; gap: 12px; font-size: var(--font-size-sm); padding-bottom: 8px; border-bottom: 1px solid var(--color-border);',
                  },
                  h('span', { style: 'color: var(--color-primary); font-weight: bold;' }, '•'),
                  h(
                    'div',
                    {},
                    h(
                      'span',
                      { style: 'font-weight: 500;' },
                      act.actor ? act.actor.name : 'System'
                    ),
                    h('span', {}, ` performed `),
                    h('strong', {}, act.action),
                    h(
                      'div',
                      { className: 'tb-text-muted', style: 'font-size: var(--font-size-xs); margin-top: 2px;' },
                      new Date(act.createdAt).toLocaleString()
                    )
                  )
                )
              )
            )
      );
    }

    container.appendChild(breadcrumbs);
    container.appendChild(header);
    container.appendChild(tabs);
    container.appendChild(tabContent);
  }

  loadData();
  return container;
}
