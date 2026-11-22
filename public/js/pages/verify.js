import { h } from '../lib/dom.js';
import { api } from '../api.js';

export function VerifyPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || '';

  let message = 'Verifying your email...';
  let isSuccess = false;

  const container = h('div', { className: 'tb-auth-container' });

  async function performVerification() {
    if (!token) {
      message = 'Missing verification token.';
      render();
      return;
    }

    try {
      await api('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      isSuccess = true;
      message = 'Your email has been verified successfully!';
    } catch (err) {
      isSuccess = false;
      message = err.message || 'Verification failed or expired.';
    }
    render();
  }

  function render() {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    container.appendChild(
      h(
        'div',
        { className: 'tb-card tb-auth-card' },
        h('h1', { className: 'tb-auth-title' }, 'Email Verification'),
        h(
          'div',
          { className: `tb-alert ${isSuccess ? 'tb-alert-success' : 'tb-alert-error'}` },
          message
        ),
        h(
          'div',
          { className: 'tb-auth-links' },
          h('a', { href: '/' }, 'Return to TeamBoard')
        )
      )
    );
  }

  render();
  performVerification();
  return container;
}
