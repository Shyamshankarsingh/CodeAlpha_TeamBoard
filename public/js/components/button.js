import { h } from '../lib/dom.js';

export function button(props = {}, text) {
  const { variant = 'primary', loading = false, disabled = false, ...rest } = props;
  const className = `tb-btn tb-btn-${variant} ${props.className || ''}`.trim();

  return h(
    'button',
    {
      ...rest,
      className,
      disabled: disabled || loading,
    },
    loading ? 'Please wait...' : text
  );
}
