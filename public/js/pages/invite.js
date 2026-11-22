import { h } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { button } from '../components/button.js';

export function InvitePage(params = {}) {
  const token = params.token || window.location.pathname.split('/invite/')[1] || '';
  const container = h('div', { className: 'tb-auth-container' });

  let preview = null;
  let message = '';
  let isSuccess = false;
  let isLoading = false;

  async function loadPreview() {
    if (!token) {
      message = 'Invalid invitation link.';
      render();
      return;
    }

    try {
      const data = await api('/api/invitations/preview', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      preview = data;
      render();
    } catch (err) {
      message = err.message || 'Invitation is invalid or has expired.';
      render();
    }
  }

  function render() {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const { user } = store.getState();

    container.appendChild(
      h(
        'div',
        { className: 'tb-card tb-auth-card' },
        h('h1', { className: 'tb-auth-title' }, 'Workspace Invitation'),
        message &&
          h(
            'div',
            { className: `tb-alert ${isSuccess ? 'tb-alert-success' : 'tb-alert-error'}` },
            message
          ),
        preview &&
          h(
            'div',
            { className: 'tb-invite-preview' },
            h(
              'p',
              { className: 'tb-auth-subtitle' },
              `You have been invited to join `,
              h('strong', {}, preview.workspaceName),
              ` as a `,
              h('strong', {}, preview.role)
            ),
            h(
              'p',
              { className: 'tb-text-muted tb-text-sm', style: 'margin-bottom: var(--space-4);' },
              `Invitation sent to: ${preview.email}`
            ),
            user
              ? button(
                  {
                    variant: 'primary',
                    loading: isLoading,
                    onclick: async () => {
                      isLoading = true;
                      message = '';
                      render();
                      try {
                        const result = await api('/api/invitations/accept', {
                          method: 'POST',
                          body: JSON.stringify({ token }),
                        });
                        isSuccess = true;
                        store.showToast('Joined workspace successfully!', 'success');
                        router.navigate(`/w/${result.workspaceId}`);
                      } catch (err) {
                        isSuccess = false;
                        message = err.message || 'Failed to accept invitation';
                        isLoading = false;
                        render();
                      }
                    },
                  },
                  'Accept & Join Workspace'
                )
              : h(
                  'div',
                  { className: 'tb-auth-links' },
                  h(
                    'a',
                    { href: `/login?redirect=/invite/${token}`, className: 'tb-btn tb-btn-primary' },
                    'Sign In to Accept'
                  ),
                  h('span', {}, "Don't have an account yet? "),
                  h('a', { href: `/register?email=${encodeURIComponent(preview.email)}` }, 'Create an Account')
                )
          )
      )
    );
  }

  render();
  loadPreview();
  return container;
}
