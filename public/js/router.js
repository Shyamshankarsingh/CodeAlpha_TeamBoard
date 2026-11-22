import { store } from './store.js';
import { clearChildren } from './lib/dom.js';

const routes = [];
let notFoundHandler = null;
let activeView = null;

export const router = {
  on(pathPattern, handler, options = {}) {
    routes.push({
      pattern: pathPattern,
      handler,
      requiresAuth: options.requiresAuth ?? true,
      guestOnly: options.guestOnly ?? false,
    });
    return this;
  },

  notFound(handler) {
    notFoundHandler = handler;
    return this;
  },

  navigate(path) {
    window.history.pushState(null, '', path);
    this.resolve();
  },

  resolve() {
    const currentPath = window.location.pathname;
    const { user } = store.getState();

    for (const route of routes) {
      const match = matchPath(route.pattern, currentPath);
      if (match) {
        // Guard: requires logged-in user
        if (route.requiresAuth && !user) {
          this.navigate('/login');
          return;
        }

        // Guard: guest-only page (login, register) when user already logged in
        if (route.guestOnly && user) {
          this.navigate('/');
          return;
        }

        const appEl = document.getElementById('app');
        if (appEl) {
          if (activeView && typeof activeView.destroy === 'function') {
            try {
              activeView.destroy();
            } catch (err) {
              console.error('Error destroying previous view', err);
            }
          }
          clearChildren(appEl);
          const view = route.handler(match.params);
          activeView = view;
          if (view) {
            appEl.appendChild(view);
          }
        }
        return;
      }
    }

    if (notFoundHandler) {
      const appEl = document.getElementById('app');
      if (appEl) {
        clearChildren(appEl);
        appEl.appendChild(notFoundHandler());
      }
    }
  },

  init() {
    window.addEventListener('popstate', () => this.resolve());

    // Intercept client links
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (
        anchor &&
        anchor.getAttribute('href')?.startsWith('/') &&
        !anchor.getAttribute('target') &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        this.navigate(anchor.getAttribute('href'));
      }
    });

    this.resolve();
  },
};

function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].slice(1);
      params[paramName] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return { params };
}
