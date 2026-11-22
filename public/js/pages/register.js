import { h } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { input } from '../components/input.js';
import { button } from '../components/button.js';

export function RegisterPage() {
  let errorMessage = '';
  let successMessage = '';
  let isLoading = false;

  const form = h('form', {
    className: 'tb-auth-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const name = form.querySelector('#name').value;
      const email = form.querySelector('#email').value;
      const password = form.querySelector('#password').value;

      isLoading = true;
      errorMessage = '';
      successMessage = '';
      rerender();

      try {
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });

        if (data && data.user) {
          store.setUser(data.user, data.csrfToken);
          store.showToast('Account created successfully!', 'success');
          router.navigate('/');
        } else {
          successMessage = 'Registration received! Please check your email for a verification link.';
          isLoading = false;
          rerender();
        }
      } catch (err) {
        errorMessage = err.message || 'Registration failed';
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
        h('h1', { className: 'tb-auth-title' }, 'Create Account'),
        h('p', { className: 'tb-auth-subtitle' }, 'Get started with TeamBoard'),
        errorMessage && h('div', { className: 'tb-alert tb-alert-error' }, errorMessage),
        successMessage && h('div', { className: 'tb-alert tb-alert-success' }, successMessage),
        input({
          label: 'Full Name',
          id: 'name',
          type: 'text',
          required: true,
          autocomplete: 'name',
        }),
        input({
          label: 'Email',
          id: 'email',
          type: 'email',
          required: true,
          autocomplete: 'email',
        }),
        input({
          label: 'Password (min 10 characters)',
          id: 'password',
          type: 'password',
          required: true,
          minlength: 10,
          autocomplete: 'new-password',
        }),
        h(
          'div',
          { className: 'tb-form-actions' },
          button({ type: 'submit', loading: isLoading }, 'Sign Up')
        ),
        h(
          'div',
          { className: 'tb-auth-links' },
          h('span', {}, 'Already have an account? '),
          h('a', { href: '/login' }, 'Sign in')
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
