import { h } from '../lib/dom.js';

export function themeToggle() {
  function getPreferredTheme() {
    const saved = localStorage.getItem('tb_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tb_theme', theme);
    updateIcon();
  }

  let currentTheme = getPreferredTheme();
  applyTheme(currentTheme);

  const btn = h(
    'button',
    {
      type: 'button',
      className: 'tb-btn tb-btn-ghost tb-btn-sm tb-theme-toggle',
      'aria-label': `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`,
      title: `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`,
      onclick: () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
      },
    },
    currentTheme === 'dark' ? '☀️' : '🌙'
  );

  function updateIcon() {
    btn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`);
    btn.setAttribute('title', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`);
  }

  return btn;
}
