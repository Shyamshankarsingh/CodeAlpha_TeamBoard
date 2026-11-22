import { h } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { input } from '../components/input.js';
import { button } from '../components/button.js';

export function LoginPage() {
  let errorMessage = '';
  let isLoading = false;

  const form = h('form', {
    className: 'tb-auth-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const email = form.querySelector('#email').value;
      const password = form.querySelector('#password').value;

      isLoading = true;
      errorMessage = '';
      rerender();

      try {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        store.setUser(data.user, data.csrfToken);
        store.showToast('Logged in successfully', 'success');
        router.navigate('/');
      } catch (err) {
        errorMessage = err.message || 'Login failed';
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
        h('h1', { className: 'tb-auth-title' }, 'Sign In'),
        h('p', { className: 'tb-auth-subtitle' }, 'Welcome back to TeamBoard'),
        errorMessage && h('div', { className: 'tb-alert tb-alert-error' }, errorMessage),
        input({
          label: 'Email',
          id: 'email',
          type: 'email',
          required: true,
          autocomplete: 'email',
        }),
        input({
          label: 'Password',
          id: 'password',
          type: 'password',
          required: true,
          autocomplete: 'current-password',
        }),
        h(
          'div',
          { className: 'tb-form-actions' },
          button({ type: 'submit', loading: isLoading }, 'Sign In')
        ),
        h(
          'div',
          { className: 'tb-auth-links' },
          h('a', { href: '/forgot-password' }, 'Forgot password?'),
          h('span', {}, "Don't have an account? "),
          h('a', { href: '/register' }, 'Sign up')
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
