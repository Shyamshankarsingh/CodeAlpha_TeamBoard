import { h } from '../lib/dom.js';
import { dialog } from './dialog.js';

export function openShortcutsDialog() {
  const shortcutList = [
    { section: 'Navigation', items: [
      { keys: ['g', 'b'], desc: 'Go to Board view' },
      { keys: ['g', 'l'], desc: 'Go to List view' },
      { keys: ['g', 'i'], desc: 'Open notifications inbox' },
    ]},
    { section: 'Actions', items: [
      { keys: ['/'], desc: 'Focus task search input' },
      { keys: ['c'], desc: 'Create new task' },
      { keys: ['?'], desc: 'Show this shortcuts help dialog' },
      { keys: ['Esc'], desc: 'Close open dialog or panel' },
    ]},
  ];

  const content = h(
    'div',
    { className: 'tb-shortcuts-dialog-content' },
    ...shortcutList.map((sec) =>
      h(
        'div',
        { className: 'tb-shortcuts-section', style: 'margin-bottom: var(--space-4);' },
        h(
          'h4',
          { style: 'margin: 0 0 var(--space-2) 0; font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted);' },
          sec.section
        ),
        h(
          'ul',
          { style: 'list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;' },
          ...sec.items.map((item) =>
            h(
              'li',
              { style: 'display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem;' },
              h('span', { style: 'color: var(--text);' }, item.desc),
              h(
                'div',
                { style: 'display: flex; gap: 4px;' },
                ...item.keys.map((k) =>
                  h('kbd', { className: 'tb-kbd' }, k)
                )
              )
            )
          )
        )
      )
    )
  );

  return dialog({
    title: 'Keyboard Shortcuts',
    content,
  });
}
