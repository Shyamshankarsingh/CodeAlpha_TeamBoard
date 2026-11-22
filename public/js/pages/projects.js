import { h, clearChildren } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { dialog } from '../components/dialog.js';

export function ProjectsPage(params) {
  const wsId = params.workspaceId || store.getState().currentWorkspaceId;
  const container = h('div', { className: 'tb-projects-page' });

  let projects = [];
  let currentFilter = 'false'; // 'false' (active), 'true' (archived)
  let searchQuery = '';
  let isLoading = true;

  async function loadProjects() {
    isLoading = true;
    render();
    try {
      const q = new URLSearchParams();
      q.set('archived', currentFilter);
      if (searchQuery.trim()) {
        q.set('search', searchQuery.trim());
      }
      const data = await api(`/api/workspaces/${wsId}/projects?${q.toString()}`);
      projects = data || [];
    } catch (err) {
      store.setToast(err.message || 'Failed to load projects', 'error');
    } finally {
      isLoading = false;
      render();
    }
  }

  function openCreateDialog() {
    let nameInput, descInput, visibilitySelect, prioritySelect, startInput, deadlineInput, errorEl;

    const form = h(
      'form',
      {
        className: 'tb-form',
        onsubmit: async (e) => {
          e.preventDefault();
          errorEl.textContent = '';
          const name = nameInput.value.trim();
          if (!name) {
            errorEl.textContent = 'Project name is required';
            return;
          }

          try {
            const body = {
              name,
              description: descInput.value.trim(),
              visibility: visibilitySelect.value,
              priority: prioritySelect.value,
              startDate: startInput.value || null,
              deadline: deadlineInput.value || null,
            };
            const created = await api(`/api/workspaces/${wsId}/projects`, {
              method: 'POST',
              body,
            });
            modal.close();
            store.setToast('Project created successfully', 'success');
            router.navigate(`/w/${wsId}/p/${created.id}`);
          } catch (err) {
            errorEl.textContent = err.message || 'Failed to create project';
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
          placeholder: 'e.g. Website Redesign',
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
          placeholder: 'Summary of project goals and scope...',
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
            h('option', { value: 'workspace' }, 'Workspace (Visible to all)'),
            h('option', { value: 'private' }, 'Private (Members only)')
          ))
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
        )
      ),
      h(
        'div',
        { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);' },
        h(
          'div',
          { className: 'tb-form-group' },
          h('label', { className: 'tb-label' }, 'Start Date'),
          (startInput = h('input', { type: 'date', className: 'tb-input' }))
        ),
        h(
          'div',
          { className: 'tb-form-group' },
          h('label', { className: 'tb-label' }, 'Deadline'),
          (deadlineInput = h('input', { type: 'date', className: 'tb-input' }))
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
        h('button', { type: 'submit', className: 'tb-btn tb-btn-primary' }, 'Create Project')
      )
    );

    const modal = dialog({
      title: 'Create Project',
      content: form,
    });
  }

  function render() {
    clearChildren(container);

    const { workspaces } = store.getState();
    const currentWs = workspaces.find((w) => w.id === wsId);
    const canCreate = currentWs && ['owner', 'admin', 'member'].includes(currentWs.role);

    const header = h(
      'div',
      { className: 'tb-projects-header' },
      h(
        'div',
        {},
        h('h1', { className: 'tb-page-title' }, 'Projects'),
        h('p', { className: 'tb-text-muted' }, 'Track initiatives, deadlines, and board progress.')
      ),
      canCreate
        ? h(
            'button',
            {
              className: 'tb-btn tb-btn-primary',
              onclick: openCreateDialog,
            },
            '+ New Project'
          )
        : null
    );

    const toolbar = h(
      'div',
      { className: 'tb-projects-toolbar', style: 'display: flex; gap: var(--space-4); margin: var(--space-4) 0;' },
      h('input', {
        type: 'search',
        className: 'tb-input',
        style: 'max-width: 300px;',
        placeholder: 'Search projects...',
        value: searchQuery,
        oninput: (e) => {
          searchQuery = e.target.value;
          loadProjects();
        },
      }),
      h(
        'div',
        { className: 'tb-filter-tabs' },
        h(
          'button',
          {
            className: `tb-btn tb-btn-sm ${currentFilter === 'false' ? 'tb-btn-primary' : 'tb-btn-ghost'}`,
            onclick: () => {
              currentFilter = 'false';
              loadProjects();
            },
          },
          'Active'
        ),
        h(
          'button',
          {
            className: `tb-btn tb-btn-sm ${currentFilter === 'true' ? 'tb-btn-primary' : 'tb-btn-ghost'}`,
            onclick: () => {
              currentFilter = 'true';
              loadProjects();
            },
          },
          'Archived'
        )
      )
    );

    let content;
    if (isLoading) {
      content = h('div', { className: 'tb-loading' }, 'Loading projects...');
    } else if (projects.length === 0) {
      content = h(
        'div',
        { className: 'tb-empty-state', style: 'padding: var(--space-8); text-align: center;' },
        h('h3', {}, currentFilter === 'true' ? 'No archived projects' : 'No projects yet'),
        h(
          'p',
          { className: 'tb-text-muted', style: 'margin: var(--space-2) 0 var(--space-4);' },
          currentFilter === 'true'
            ? 'When projects are completed or archived, they will appear here.'
            : 'Create your first project to organize tasks and start collaborating.'
        ),
        canCreate && currentFilter === 'false'
          ? h(
              'button',
              { className: 'tb-btn tb-btn-primary', onclick: openCreateDialog },
              '+ Create Project'
            )
          : null
      );
    } else {
      content = h(
        'div',
        { className: 'tb-projects-grid' },
        ...projects.map((p) => {
          const stats = p.stats || { progress: 0, totalTasks: 0, completedTasks: 0 };
          return h(
            'div',
            {
              className: 'tb-card tb-project-card',
              style: 'cursor: pointer;',
              onclick: () => router.navigate(`/w/${wsId}/p/${p.id}`),
            },
            h(
              'div',
              { style: 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-2);' },
              h('h3', { className: 'tb-project-name' }, p.name),
              h(
                'div',
                { style: 'display: flex; gap: 6px;' },
                p.visibility === 'private'
                  ? h('span', { className: 'tb-badge tb-badge-warning' }, '🔒 Private')
                  : null,
                p.priority !== 'none'
                  ? h('span', { className: `tb-badge tb-badge-priority-${p.priority}` }, p.priority)
                  : null
              )
            ),
            h('p', { className: 'tb-project-desc tb-text-muted' }, p.description || 'No description provided.'),
            h(
              'div',
              { className: 'tb-project-meta', style: 'margin-top: var(--space-4);' },
              h(
                'div',
                { style: 'display: flex; justify-content: space-between; font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: 4px;' },
                h('span', {}, 'Progress'),
                h('span', {}, `${stats.progress}%`)
              ),
              h(
                'div',
                { className: 'tb-progress-bar-track' },
                h('div', {
                  className: 'tb-progress-bar-fill',
                  style: `width: ${stats.progress}%;`,
                })
              ),
              h(
                'div',
                { style: 'display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-3); font-size: var(--font-size-xs); color: var(--color-text-muted);' },
                h('span', {}, `${p.memberCount || 1} member${p.memberCount === 1 ? '' : 's'}`),
                p.deadline ? h('span', {}, `Due: ${p.deadline}`) : null
              )
            )
          );
        })
      );
    }

    container.appendChild(header);
    container.appendChild(toolbar);
    container.appendChild(content);
  }

  loadProjects();
  return container;
}
