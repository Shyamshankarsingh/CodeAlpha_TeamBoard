import { h } from '../lib/dom.js';

const COLORS = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#D97706',
  '#059669', '#2563EB', '#0D9488', '#4B5563'
];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function avatar({ name = '', avatarUrl = null, size = 32 }) {
  if (avatarUrl) {
    return h('img', {
      src: avatarUrl,
      alt: name,
      className: 'tb-avatar',
      style: `width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover;`,
    });
  }

  const bg = getColor(name);
  return h(
    'div',
    {
      className: 'tb-avatar tb-avatar-initials',
      style: `width: ${size}px; height: ${size}px; border-radius: 50%; background-color: ${bg}; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; font-size: ${Math.round(size * 0.42)}px; font-weight: 600; text-transform: uppercase; user-select: none; flex-shrink: 0;`,
      title: name,
    },
    getInitials(name)
  );
}
