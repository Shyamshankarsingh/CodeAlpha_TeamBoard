import { h } from '../lib/dom.js';

export function dialog({ title, content, onClose }) {
  let backdropEl = null;

  function close() {
    if (backdropEl && backdropEl.parentNode) {
      document.removeEventListener('keydown', handleKeyDown);
      backdropEl.parentNode.removeChild(backdropEl);
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      close();
    }
  }

  const titleId = `dialog-title-${Math.random().toString(36).slice(2, 9)}`;

  backdropEl = h(
    'div',
    {
      className: 'tb-modal-backdrop',
      onclick: (e) => {
        if (e.target === backdropEl) {
          close();
        }
      },
    },
    h(
      'div',
      {
        className: 'tb-modal-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
      },
      h(
        'div',
        { className: 'tb-modal-header' },
        h('h2', { id: titleId, className: 'tb-modal-title' }, title),
        h(
          'button',
          {
            type: 'button',
            className: 'tb-modal-close',
            'aria-label': 'Close dialog',
            onclick: close,
          },
          '✕'
        )
      ),
      h('div', { className: 'tb-modal-body' }, content)
    )
  );

  document.addEventListener('keydown', handleKeyDown);
  document.body.appendChild(backdropEl);

  return {
    el: backdropEl,
    close,
  };
}
