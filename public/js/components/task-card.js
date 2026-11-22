import { h } from '../lib/dom.js';
import { avatar } from './avatar.js';

export function taskCard({ task, onOpen, onMoveToColumn, columns = [] }) {
  const card = h(
    'div',
    {
      className: `tb-task-card tb-priority-border-${task.priority}`,
      draggable: 'true',
      tabIndex: '0',
      'aria-label': `Task: ${task.title}`,
      onclick: (e) => {
        // Prevent opening when clicking the move dropdown
        if (e.target.closest('.tb-task-move-select')) return;
        if (typeof onOpen === 'function') onOpen(task);
      },
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          if (typeof onOpen === 'function') onOpen(task);
        }
      },
      ondragstart: (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, columnId: task.columnId }));
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('is-dragging');
      },
      ondragend: () => {
        card.classList.remove('is-dragging');
      },
    },
    // Top row: Labels & Priority
    h(
      'div',
      { className: 'tb-task-card-header' },
      h(
        'div',
        { className: 'tb-task-labels' },
        ...(task.labels || []).map((l) =>
          h(
            'span',
            {
              className: 'tb-task-label-chip',
              style: `background-color: ${l.color}; color: #FFFFFF;`,
            },
            l.name
          )
        )
      ),
      task.priority !== 'none'
        ? h('span', { className: `tb-badge tb-badge-priority-${task.priority}` }, task.priority)
        : null
    ),
    // Title
    h('div', { className: 'tb-task-title' }, task.title),
    // Subtask count indicator
    task.subtasks && task.subtasks.length > 0
      ? h(
          'div',
          { className: 'tb-task-subtasks-summary' },
          h('span', {}, '☑ '),
          h(
            'span',
            {},
            `${task.subtasks.filter((s) => s.completed).length}/${task.subtasks.length}`
          )
        )
      : null,
    // Bottom row: Assignees, Due Date, and Keyboard Move Option
    h(
      'div',
      { className: 'tb-task-card-footer' },
      h(
        'div',
        { className: 'tb-task-meta-left' },
        task.dueDate
          ? h(
              'span',
              {
                className: `tb-task-due ${new Date(task.dueDate) < new Date() && !task.completedAt ? 'is-overdue' : ''}`,
              },
              task.dueDate
            )
          : null,
        h(
          'div',
          { className: 'tb-task-assignees-stack' },
          ...(task.assignees || []).map((a) => avatar(a.name || 'User', 'sm'))
        )
      ),
      // Accessible Keyboard Alternative to Drag & Drop
      columns.length > 1
        ? h(
            'select',
            {
              className: 'tb-select tb-task-move-select',
              'aria-label': 'Move task to column',
              onclick: (e) => e.stopPropagation(),
              onchange: (e) => {
                const targetColId = e.target.value;
                if (targetColId && targetColId !== task.columnId) {
                  if (typeof onMoveToColumn === 'function') {
                    onMoveToColumn(task, targetColId);
                  }
                }
              },
            },
            h('option', { value: '', disabled: true, selected: true }, 'Move to...'),
            ...columns
              .filter((c) => c.id !== task.columnId)
              .map((c) => h('option', { value: c.id }, c.name))
          )
        : null
    )
  );

  return card;
}
