import { h } from '../lib/dom.js';
import { store } from '../store.js';

export function renderToast() {
  const { toast } = store.getState();
  if (!toast) return null;

  return h(
    'div',
    {
      className: `tb-toast tb-toast-${toast.type}`,
      role: 'status',
      'aria-live': 'polite',
    },
    toast.message
  );
}
