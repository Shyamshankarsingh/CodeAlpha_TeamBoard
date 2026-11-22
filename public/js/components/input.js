import { h } from '../lib/dom.js';

export function input(props = {}) {
  const { label, error, id, ...rest } = props;
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

  return h(
    'div',
    { className: 'tb-form-group' },
    label && h('label', { htmlFor: inputId, className: 'tb-label' }, label),
    h('input', {
      id: inputId,
      className: `tb-input ${error ? 'tb-input-error' : ''}`,
      ...rest,
    }),
    error && h('span', { className: 'tb-error-text' }, error)
  );
}
