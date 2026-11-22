import { h } from '../lib/dom.js';

export function themeToggle() {
  let btn = null;

  function getPreferredTheme() {
    const saved = localStorage.getItem('tb_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tb_theme', theme);
    if (btn) {
      updateIcon();
    }
  }

  let currentTheme = getPreferredTheme();
  document.documentElement.setAttribute('data-theme', currentTheme);

  btn = h(
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
    if (!btn) return;
    btn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`);
    btn.setAttribute('title', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`);
  }

  return btn;
}
