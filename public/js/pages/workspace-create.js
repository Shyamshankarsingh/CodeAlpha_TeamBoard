import { h } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { input } from '../components/input.js';
import { button } from '../components/button.js';

export function WorkspaceCreatePage() {
  let errorMessage = '';
  let isLoading = false;

  const form = h('form', {
    className: 'tb-auth-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const name = form.querySelector('#ws-name').value;

      isLoading = true;
      errorMessage = '';
      rerender();

      try {
        const workspace = await api('/api/workspaces', {
          method: 'POST',
          body: JSON.stringify({ name }),
        });

        // Add to store and set current
        const currentWorkspaces = store.getState().workspaces;
        store.setState({
          workspaces: [...currentWorkspaces, workspace],
          currentWorkspaceId: workspace.id,
        });

        store.showToast(`Workspace "${workspace.name}" created!`, 'success');
        router.navigate(`/w/${workspace.id}`);
      } catch (err) {
        errorMessage = err.message || 'Failed to create workspace';
        isLoading = false;
        rerender();
      }
    },
  });

  function renderContent() {
    return h(
      'div',
      { className: 'tb-auth-container' },
      h(
        'div',
        { className: 'tb-card tb-auth-card' },
        h('h1', { className: 'tb-auth-title' }, 'New Workspace'),
        h('p', { className: 'tb-auth-subtitle' }, 'Create a shared workspace for your team and projects.'),
        errorMessage && h('div', { className: 'tb-alert tb-alert-error' }, errorMessage),
        input({
          label: 'Workspace Name',
          id: 'ws-name',
          placeholder: 'e.g. Acme Corp, Engineering, Marketing',
          required: true,
          autofocus: true,
        }),
        h(
          'div',
          { className: 'tb-form-actions' },
          button({ type: 'submit', loading: isLoading }, 'Create Workspace')
        ),
        h(
          'div',
          { className: 'tb-auth-links' },
          h('a', { href: '/' }, 'Cancel')
        )
      )
    );
  }

  function rerender() {
    while (form.firstChild) {
      form.removeChild(form.firstChild);
    }
    form.appendChild(renderContent());
  }

  rerender();
  return form;
}
