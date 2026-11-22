import { h } from '../lib/dom.js';
import { api } from '../api.js';
import { router } from '../router.js';
import { input } from '../components/input.js';
import { button } from '../components/button.js';

export function ResetPasswordPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || '';

  let message = '';
  let isSuccess = false;
  let isLoading = false;

  const form = h('form', {
    className: 'tb-auth-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const newPassword = form.querySelector('#newPassword').value;

      isLoading = true;
      message = '';
      rerender();

      try {
        await api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, newPassword }),
        });

        isSuccess = true;
        message = 'Password has been successfully reset! You can now log in.';
      } catch (err) {
        isSuccess = false;
        message = err.message || 'Password reset failed';
      } finally {
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
        h('h1', { className: 'tb-auth-title' }, 'Set New Password'),
        message &&
          h(
            'div',
            { className: `tb-alert ${isSuccess ? 'tb-alert-success' : 'tb-alert-error'}` },
            message
          ),
        !token &&
          h('div', { className: 'tb-alert tb-alert-error' }, 'Missing or invalid reset token.'),
        token &&
          !isSuccess &&
          input({
            label: 'New Password (min 10 characters)',
            id: 'newPassword',
            type: 'password',
            required: true,
            minlength: 10,
          }),
        token &&
          !isSuccess &&
          h(
            'div',
            { className: 'tb-form-actions' },
            button({ type: 'submit', loading: isLoading }, 'Reset Password')
          ),
        h(
          'div',
          { className: 'tb-auth-links' },
          h('a', { href: '/login' }, 'Back to login')
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
