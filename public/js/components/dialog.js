import { h } from '../lib/dom.js';

export function dialog({ title, content, onClose, className = '' }) {
  let backdropEl = null;
  const previouslyFocused = document.activeElement;

  function close() {
    if (backdropEl && backdropEl.parentNode) {
      document.removeEventListener('keydown', handleKeyDown);
      backdropEl.parentNode.removeChild(backdropEl);
    }
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try {
        previouslyFocused.focus();
      } catch {}
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }

    if (e.key === 'Tab') {
      const focusable = backdropEl.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  const titleId = `dialog-title-${Math.random().toString(36).slice(2, 9)}`;

  backdropEl = h(
    'div',
    {
      className: `tb-modal-backdrop ${className ? className + '-backdrop' : ''}`,
      onclick: (e) => {
        if (e.target === backdropEl) {
          close();
        }
      },
    },
    h(
      'div',
      {
        className: `tb-modal-dialog ${className}`,
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

  // Focus first interactive control or close button
  setTimeout(() => {
    const focusable = backdropEl.querySelectorAll(
      'input, select, textarea, button:not(.tb-modal-close)'
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      const closeBtn = backdropEl.querySelector('.tb-modal-close');
      if (closeBtn) closeBtn.focus();
    }
  }, 20);

  return {
    el: backdropEl,
    close,
  };
}
