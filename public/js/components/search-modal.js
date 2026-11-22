import { h } from '../lib/dom.js';
import { dialog } from './dialog.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';

export function openSearchDialog() {
  const currentWorkspace = store.get('currentWorkspace');
  if (!currentWorkspace) return;

  let debounceTimer = null;
  const resultsContainer = h('div', { class: 'tb-search-results', style: 'margin-top: 1rem; max-height: 380px; overflow-y: auto;' }, [
    h('p', { class: 'tb-search-hint', style: 'color: var(--color-text-muted); font-size: 0.9rem;' }, ['Type to search tasks across projects...'])
  ]);

  const searchInput = h('input', {
    type: 'search',
    class: 'tb-input tb-search-input',
    placeholder: 'Search tasks by title or description...',
    style: 'width: 100%; font-size: 1rem; padding: 0.75rem;',
    autocomplete: 'off',
  });

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (!q) {
      resultsContainer.replaceChildren(
        h('p', { class: 'tb-search-hint', style: 'color: var(--color-text-muted); font-size: 0.9rem;' }, ['Type to search tasks across projects...'])
      );
      return;
    }

    debounceTimer = setTimeout(async () => {
      resultsContainer.replaceChildren(
        h('p', { class: 'tb-search-loading', style: 'color: var(--color-text-muted);' }, ['Searching...'])
      );

      try {
        const res = await api.get(`/workspaces/${currentWorkspace.id}/search?q=${encodeURIComponent(q)}`);
        const tasks = res.tasks || [];

        if (tasks.length === 0) {
          resultsContainer.replaceChildren(
            h('p', { class: 'tb-search-empty', style: 'color: var(--color-text-muted); padding: 1rem 0;' }, ['No matching tasks found.'])
          );
          return;
        }

        const items = tasks.map(task => {
          const item = h('div', {
            class: 'tb-search-item',
            style: 'padding: 0.75rem; border-bottom: 1px solid var(--color-border); cursor: pointer; border-radius: 6px;',
            role: 'button',
            tabindex: '0',
          }, [
            h('div', { style: 'display: flex; justify-content: space-between; align-items: baseline;' }, [
              h('span', { style: 'font-weight: 600; color: var(--color-text-main);' }, [task.title]),
              h('span', { class: `tb-badge tb-badge-${task.priority}`, style: 'font-size: 0.75rem; text-transform: capitalize;' }, [task.priority]),
            ]),
            h('div', { style: 'display: flex; gap: 0.5rem; font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.25rem;' }, [
              h('span', {}, [task.projectName]),
              h('span', {}, ['•']),
              h('span', {}, [task.columnName]),
            ]),
          ]);

          item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = 'var(--color-bg-secondary)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'transparent';
          });

          item.addEventListener('click', () => {
            modal.close();
            router.navigate(`/projects/${task.projectId}`);
          });

          return item;
        });

        resultsContainer.replaceChildren(...items);
      } catch (err) {
        resultsContainer.replaceChildren(
          h('p', { style: 'color: var(--color-danger);' }, [err.message || 'Error executing search'])
        );
      }
    }, 250);
  });

  const content = h('div', { class: 'tb-search-dialog-body', style: 'min-width: 450px; max-width: 600px;' }, [
    searchInput,
    resultsContainer,
  ]);

  const modal = dialog({
    title: 'Global Search',
    content,
    className: 'tb-search-dialog',
  });

  setTimeout(() => searchInput.focus(), 50);
}
