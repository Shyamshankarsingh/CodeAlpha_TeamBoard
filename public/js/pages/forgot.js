import { h } from '../lib/dom.js';
import { api } from '../api.js';
import { input } from '../components/input.js';
import { button } from '../components/button.js';

export function ForgotPasswordPage() {
  let message = '';
  let isSuccess = false;
  let isLoading = false;

  const form = h('form', {
    className: 'tb-auth-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const email = form.querySelector('#email').value;

      isLoading = true;
      message = '';
      rerender();

      try {
        await api('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });

        isSuccess = true;
        message = 'If an account with that email exists, a reset link has been sent.';
      } catch (err) {
        isSuccess = false;
        message = err.message || 'Request failed';
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
        h('h1', { className: 'tb-auth-title' }, 'Reset Password'),
        h('p', { className: 'tb-auth-subtitle' }, "Enter your email and we'll send you a link to reset your password."),
        message &&
          h(
            'div',
            { className: `tb-alert ${isSuccess ? 'tb-alert-success' : 'tb-alert-error'}` },
            message
          ),
        !isSuccess &&
          input({
            label: 'Email',
            id: 'email',
            type: 'email',
            required: true,
          }),
        !isSuccess &&
          h(
            'div',
            { className: 'tb-form-actions' },
            button({ type: 'submit', loading: isLoading }, 'Send Reset Link')
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
