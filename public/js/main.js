import { router } from './router.js';
import { store } from './store.js';
import { api } from './api.js';
import { h, clearChildren } from './lib/dom.js';
import { LoginPage } from './pages/login.js';
import { RegisterPage } from './pages/register.js';
import { ForgotPasswordPage } from './pages/forgot.js';
import { ResetPasswordPage } from './pages/reset.js';
import { VerifyPage } from './pages/verify.js';
import { SettingsPage } from './pages/settings.js';
import { renderToast } from './components/toast.js';

function AppShell(content) {
  const { user } = store.getState();

  return h(
    'div',
    { className: 'tb-app-shell' },
    h(
      'header',
      { className: 'tb-header' },
      h(
        'div',
        { className: 'tb-header-inner' },
        h('h1', { className: 'tb-logo' }, h('a', { href: '/' }, 'TeamBoard')),
        h(
          'nav',
          { className: 'tb-nav' },
          user
            ? [
                h('span', { className: 'tb-user-name' }, user.name),
                h('a', { href: '/settings', className: 'tb-btn tb-btn-ghost' }, 'Settings'),
                h(
                  'button',
                  {
                    className: 'tb-btn tb-btn-secondary',
                    onclick: async () => {
                      try {
                        await api('/api/auth/logout', { method: 'POST' });
                      } catch (e) {}
                      store.setUser(null, null);
                      router.navigate('/login');
                    },
                  },
                  'Sign Out'
                ),
              ]
            : [
                h('a', { href: '/login', className: 'tb-btn tb-btn-ghost' }, 'Sign In'),
                h('a', { href: '/register', className: 'tb-btn tb-btn-primary' }, 'Get Started'),
              ]
        )
      )
    ),
    h('main', { className: 'tb-main' }, content)
  );
}

function HomePage() {
  const { user } = store.getState();

  return h(
    'div',
    { className: 'tb-home' },
    h(
      'div',
      { className: 'tb-card' },
      h('h2', {}, `Welcome to TeamBoard, ${user ? user.name : 'Guest'}!`),
      h(
        'p',
        { className: 'tb-text-muted', style: 'margin-top: 8px;' },
        'Your workspaces and Kanban boards will appear here in Phase 3.'
      ),
      h(
        'div',
        { style: 'margin-top: 16px;' },
        h('a', { href: '/settings', className: 'tb-btn tb-btn-secondary' }, 'Manage Profile & Sessions')
      )
    )
  );
}

// Toast listener
store.subscribe(() => {
  const toastContainer = document.getElementById('toast-container');
  if (toastContainer) {
    clearChildren(toastContainer);
    const toastEl = renderToast();
    if (toastEl) {
      toastContainer.appendChild(toastEl);
    }
  }
});

// Configure client routes
router
  .on('/', () => AppShell(HomePage()), { requiresAuth: true })
  .on('/login', () => AppShell(LoginPage()), { requiresAuth: false, guestOnly: true })
  .on('/register', () => AppShell(RegisterPage()), { requiresAuth: false, guestOnly: true })
  .on('/forgot-password', () => AppShell(ForgotPasswordPage()), { requiresAuth: false, guestOnly: true })
  .on('/reset-password', () => AppShell(ResetPasswordPage()), { requiresAuth: false })
  .on('/verify', () => AppShell(VerifyPage()), { requiresAuth: false })
  .on('/settings', () => AppShell(SettingsPage()), { requiresAuth: true })
  .notFound(() =>
    AppShell(
      h(
        'div',
        { className: 'tb-card', style: 'text-align: center;' },
        h('h2', {}, '404 - Page Not Found'),
        h('p', { className: 'tb-text-muted' }, 'The page you requested could not be found.'),
        h('a', { href: '/', className: 'tb-btn tb-btn-primary', style: 'margin-top: 16px;' }, 'Go to Home')
      )
    )
  );

// Check current session on initial page load
async function init() {
  try {
    const data = await api('/api/auth/me');
    if (data && data.user) {
      store.setUser(data.user, data.csrfToken);
    }
  } catch (e) {
    // Session is unauthenticated or expired
    store.setUser(null, null);
  }

  router.init();
}

document.addEventListener('DOMContentLoaded', init);
