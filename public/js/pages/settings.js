import { h } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { input } from '../components/input.js';
import { button } from '../components/button.js';

export function SettingsPage() {
  const container = h('div', { className: 'tb-settings-container' });

  let sessions = [];
  let passwordMessage = '';
  let passwordSuccess = false;
  let profileMessage = '';
  let profileSuccess = false;

  async function loadSessions() {
    try {
      const data = await api('/api/auth/sessions');
      sessions = data || [];
      render();
    } catch (e) {}
  }

  function render() {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const { user } = store.getState();
    if (!user) return;

    container.appendChild(
      h(
        'div',
        { className: 'tb-settings-layout' },
        h(
          'header',
          { className: 'tb-settings-header' },
          h('h1', {}, 'Account Settings'),
          h('p', { className: 'tb-text-muted' }, 'Manage your profile, password, and active sessions')
        ),

        // Profile Section
        h(
          'section',
          { className: 'tb-card tb-settings-section' },
          h('h2', {}, 'Profile'),
          profileMessage &&
            h(
              'div',
              { className: `tb-alert ${profileSuccess ? 'tb-alert-success' : 'tb-alert-error'}` },
              profileMessage
            ),
          h(
            'form',
            {
              onsubmit: async (e) => {
                e.preventDefault();
                const name = e.target.querySelector('#profile-name').value;
                const timezone = e.target.querySelector('#profile-timezone').value;
                const theme = e.target.querySelector('#profile-theme').value;

                try {
                  const data = await api('/api/users/me', {
                    method: 'PATCH',
                    body: JSON.stringify({ name, timezone, theme }),
                  });
                  store.setState({ user: data.user });
                  store.setTheme(theme);
                  profileSuccess = true;
                  profileMessage = 'Profile updated successfully!';
                } catch (err) {
                  profileSuccess = false;
                  profileMessage = err.message || 'Failed to update profile';
                }
                render();
              },
            },
            input({
              label: 'Full Name',
              id: 'profile-name',
              value: user.name,
              required: true,
            }),
            input({
              label: 'Email (Read only)',
              id: 'profile-email',
              value: user.email,
              disabled: true,
            }),
            h(
              'div',
              { className: 'tb-form-group' },
              h('label', { className: 'tb-label', htmlFor: 'profile-timezone' }, 'Timezone'),
              h(
                'input',
                {
                  id: 'profile-timezone',
                  className: 'tb-input',
                  value: user.timezone || 'UTC',
                  required: true,
                }
              )
            ),
            h(
              'div',
              { className: 'tb-form-group' },
              h('label', { className: 'tb-label', htmlFor: 'profile-theme' }, 'Theme'),
              h(
                'select',
                {
                  id: 'profile-theme',
                  className: 'tb-select',
                  value: user.theme || 'system',
                },
                h('option', { value: 'system' }, 'System default'),
                h('option', { value: 'light' }, 'Light mode'),
                h('option', { value: 'dark' }, 'Dark mode')
              )
            ),
            h('div', { className: 'tb-form-actions' }, button({ type: 'submit' }, 'Save Profile'))
          )
        ),

        // Password Section
        h(
          'section',
          { className: 'tb-card tb-settings-section' },
          h('h2', {}, 'Change Password'),
          passwordMessage &&
            h(
              'div',
              { className: `tb-alert ${passwordSuccess ? 'tb-alert-success' : 'tb-alert-error'}` },
              passwordMessage
            ),
          h(
            'form',
            {
              onsubmit: async (e) => {
                e.preventDefault();
                const currentPassword = e.target.querySelector('#current-pw').value;
                const newPassword = e.target.querySelector('#new-pw').value;

                try {
                  await api('/api/auth/change-password', {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword, newPassword }),
                  });
                  passwordSuccess = true;
                  passwordMessage = 'Password changed successfully! Other sessions revoked.';
                  e.target.reset();
                  loadSessions();
                } catch (err) {
                  passwordSuccess = false;
                  passwordMessage = err.message || 'Failed to change password';
                }
                render();
              },
            },
            input({
              label: 'Current Password',
              id: 'current-pw',
              type: 'password',
              required: true,
            }),
            input({
              label: 'New Password (min 10 characters)',
              id: 'new-pw',
              type: 'password',
              required: true,
              minlength: 10,
            }),
            h('div', { className: 'tb-form-actions' }, button({ type: 'submit' }, 'Update Password'))
          )
        ),

        // Active Sessions Section
        h(
          'section',
          { className: 'tb-card tb-settings-section' },
          h(
            'div',
            { className: 'tb-section-header' },
            h('h2', {}, 'Active Sessions'),
            button(
              {
                variant: 'secondary',
                onclick: async () => {
                  await api('/api/auth/sessions/revoke-others', { method: 'POST' });
                  store.showToast('Other sessions revoked', 'success');
                  loadSessions();
                },
              },
              'Revoke Other Sessions'
            )
          ),
          h(
            'div',
            { className: 'tb-sessions-list' },
            ...sessions.map((sess) =>
              h(
                'div',
                { className: 'tb-session-item' },
                h(
                  'div',
                  {},
                  h(
                    'strong',
                    {},
                    sess.current ? 'Current Session' : (sess.userAgent || 'Unknown Device').slice(0, 50)
                  ),
                  h(
                    'div',
                    { className: 'tb-text-muted tb-text-sm' },
                    `Last seen: ${new Date(sess.lastSeenAt).toLocaleString()}`
                  )
                ),
                !sess.current &&
                  button(
                    {
                      variant: 'danger',
                      onclick: async () => {
                        await api(`/api/auth/sessions/${sess.id}`, { method: 'DELETE' });
                        loadSessions();
                      },
                    },
                    'Revoke'
                  )
              )
            )
          )
        )
      )
    );
  }

  render();
  loadSessions();
  return container;
}
