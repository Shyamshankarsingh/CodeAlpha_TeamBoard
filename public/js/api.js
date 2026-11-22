import { store } from './store.js';
import { getClientId } from './lib/socket.js';

export class ApiError extends Error {
  constructor(code, status, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function api(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});

  // Send JSON by default unless FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach CSRF token and Client ID on state-changing requests
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = store.getState().csrfToken;
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    if (!headers.has('X-Client-Id')) {
      headers.set('X-Client-Id', getClientId());
    }
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (response.status === 204) {
    return null;
  }

  let json = null;
  try {
    json = await response.json();
  } catch (e) {
    // Non-JSON response
  }

  if (!response.ok) {
    const errorData = json && json.error ? json.error : {};
    const err = new ApiError(
      errorData.code || 'UNKNOWN_ERROR',
      response.status,
      errorData.message || response.statusText,
      errorData.details || []
    );

    // If unauthenticated, clear session state and redirect
    if (response.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/me')) {
      store.setUser(null, null);
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.history.pushState(null, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }

    throw err;
  }

  return json ? json.data : null;
}
