import { h } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { input } from '../components/input.js';
import { button } from '../components/button.js';

export function WorkspaceSettingsPage(params = {}) {
  const container = h('div', { className: 'tb-settings-container' });
  const workspaceId = params.workspaceId || store.getState().currentWorkspaceId;

  let workspace = null;
  let role = null;
  let message = '';
  let isSuccess = false;
  let members = [];

  async function loadData() {
    try {
      const data = await api(`/api/workspaces/${workspaceId}`);
      workspace = data.workspace;
      role = data.role;

      if (role === 'owner') {
        const mData = await api(`/api/workspaces/${workspaceId}/members?pageSize=100`);
        members = mData || [];
      }

      render();
    } catch (err) {
      message = err.message || 'Failed to load workspace';
      render();
    }
  }

  function render() {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (!workspace) {
      container.appendChild(
        h('div', { className: 'tb-card' }, message || 'Loading workspace settings...')
      );
      return;
    }

    const isOwner = role === 'owner';
    const isAdmin = role === 'admin' || isOwner;

    container.appendChild(
      h(
        'div',
        { className: 'tb-settings-layout' },
        h(
          'header',
          { className: 'tb-settings-header' },
          h('h1', {}, `${workspace.name} Settings`),
          h('p', { className: 'tb-text-muted' }, `Role: ${role.toUpperCase()}`)
        ),
        message &&
          h(
            'div',
            { className: `tb-alert ${isSuccess ? 'tb-alert-success' : 'tb-alert-error'}` },
            message
          ),

        // General settings (Rename)
        isAdmin &&
          h(
            'section',
            { className: 'tb-card tb-settings-section' },
            h('h2', {}, 'General'),
            h(
              'form',
              {
                onsubmit: async (e) => {
                  e.preventDefault();
                  const name = e.target.querySelector('#ws-name').value;
                  try {
                    const updated = await api(`/api/workspaces/${workspaceId}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ name }),
                    });
                    workspace.name = updated.name;
                    store.showToast('Workspace updated', 'success');
                    // Refresh store list
                    const wList = await api('/api/workspaces');
                    store.setState({ workspaces: wList });
                    render();
                  } catch (err) {
                    message = err.message || 'Failed to update';
                    isSuccess = false;
                    render();
                  }
                },
              },
              input({
                label: 'Workspace Name',
                id: 'ws-name',
                value: workspace.name,
                required: true,
              }),
              h('div', { className: 'tb-form-actions' }, button({ type: 'submit' }, 'Save Changes'))
            )
          ),

        // Transfer Ownership (Owner only)
        isOwner &&
          h(
            'section',
            { className: 'tb-card tb-settings-section' },
            h('h2', {}, 'Transfer Ownership'),
            h('p', { className: 'tb-text-muted' }, 'Transfer ownership to another member. You will become an Admin.'),
            h(
              'form',
              {
                onsubmit: async (e) => {
                  e.preventDefault();
                  const targetUserId = e.target.querySelector('#new-owner').value;
                  if (!targetUserId) return;
                  if (!confirm('Are you sure you want to transfer ownership? This cannot be undone.')) return;

                  try {
                    await api(`/api/workspaces/${workspaceId}/transfer-ownership`, {
                      method: 'POST',
                      body: JSON.stringify({ userId: targetUserId }),
                    });
                    store.showToast('Ownership transferred', 'success');
                    loadData();
                  } catch (err) {
                    message = err.message || 'Failed to transfer';
                    isSuccess = false;
                    render();
                  }
                },
              },
              h(
                'div',
                { className: 'tb-form-group' },
                h('label', { className: 'tb-label', htmlFor: 'new-owner' }, 'Select Member'),
                h(
                  'select',
                  { id: 'new-owner', className: 'tb-select', required: true },
                  h('option', { value: '' }, '-- Select member --'),
                  ...members
                    .filter((m) => m.role !== 'owner')
                    .map((m) => h('option', { value: m.userId }, `${m.name} (${m.role})`))
                )
              ),
              h('div', { className: 'tb-form-actions' }, button({ type: 'submit', variant: 'secondary' }, 'Transfer Ownership'))
            )
          ),

        // Danger Zone: Delete Workspace (Owner only)
        isOwner &&
          h(
            'section',
            { className: 'tb-card tb-settings-section tb-danger-zone' },
            h('h2', { className: 'tb-danger-title' }, 'Danger Zone'),
            h(
              'p',
              { className: 'tb-text-muted' },
              `Permanently delete ${workspace.name} and all projects, boards, and tasks. This action cannot be reversed.`
            ),
            h(
              'form',
              {
                onsubmit: async (e) => {
                  e.preventDefault();
                  const confirmName = e.target.querySelector('#confirm-delete-name').value;
                  try {
                    await api(`/api/workspaces/${workspaceId}`, {
                      method: 'DELETE',
                      body: JSON.stringify({ confirmName }),
                    });
                    store.showToast('Workspace deleted', 'info');
                    const wList = await api('/api/workspaces');
                    store.setState({
                      workspaces: wList,
                      currentWorkspaceId: wList.length > 0 ? wList[0].id : null,
                    });
                    router.navigate('/');
                  } catch (err) {
                    message = err.message || 'Deletion failed';
                    isSuccess = false;
                    render();
                  }
                },
              },
              input({
                label: `Type "${workspace.name}" to confirm`,
                id: 'confirm-delete-name',
                required: true,
              }),
              h('div', { className: 'tb-form-actions' }, button({ type: 'submit', variant: 'danger' }, 'Delete Workspace'))
            )
          )
      )
    );
  }

  loadData();
  return container;
}
