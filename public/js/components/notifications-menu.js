import { h, clearChildren } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { avatar } from './avatar.js';

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getTypeIcon(type) {
  switch (type) {
    case 'task_assigned':
      return '📋';
    case 'task_unassigned':
      return '📤';
    case 'comment_created':
      return '💬';
    case 'comment_mention':
      return '🔔';
    case 'task_due_soon':
      return '⏰';
    case 'task_overdue':
      return '⚠️';
    case 'project_invitation':
      return '📁';
    case 'workspace_invitation':
      return '🏢';
    case 'role_changed':
      return '🛡️';
    default:
      return 'ℹ️';
  }
}

export function notificationsMenu({ onClose, onCountChange }) {
  const container = h('div', {
    className: 'tb-notifications-menu tb-card',
    style:
      'position: absolute; right: 16px; top: 60px; width: 360px; max-height: 480px; display: flex; flex-direction: column; padding: 0; box-shadow: var(--shadow-lg); z-index: 1000; overflow: hidden;',
  });

  let items = [];
  let isLoading = true;

  async function loadNotifications() {
    isLoading = true;
    render();
    try {
      const res = await api('/api/notifications?limit=20');
      items = res?.items || [];
    } catch (err) {
      store.setToast(err.message || 'Failed to load notifications', 'error');
    } finally {
      isLoading = false;
      render();
    }
  }

  async function markAsRead(notification) {
    if (notification.readAt) return;
    try {
      await api(`/api/notifications/${notification.id}/read`, { method: 'POST' });
      notification.readAt = new Date().toISOString();
      if (onCountChange) onCountChange(-1);
      render();
    } catch (err) {
      console.error('Error marking notification read', err);
    }
  }

  async function markAllAsRead() {
    try {
      await api('/api/notifications/read-all', { method: 'POST' });
      items.forEach((item) => {
        item.readAt = item.readAt || new Date().toISOString();
      });
      if (onCountChange) onCountChange(0, true);
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to mark all as read', 'error');
    }
  }

  async function dismissNotification(notification, e) {
    e.stopPropagation();
    try {
      await api(`/api/notifications/${notification.id}`, { method: 'DELETE' });
      if (!notification.readAt && onCountChange) {
        onCountChange(-1);
      }
      items = items.filter((n) => n.id !== notification.id);
      render();
    } catch (err) {
      store.setToast(err.message || 'Failed to dismiss notification', 'error');
    }
  }

  function handleItemClick(notification) {
    markAsRead(notification);
    if (notification.projectId) {
      const wsId = notification.workspaceId || store.getState().currentWorkspaceId;
      onClose();
      router.navigate(`/w/${wsId}/p/${notification.projectId}`);
    }
  }

  function render() {
    clearChildren(container);

    // Header
    const header = h(
      'div',
      {
        style:
          'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--bg-surface);',
      },
      h('h3', { style: 'margin: 0; font-size: var(--font-size-md); font-weight: 600;' }, 'Notifications'),
      h(
        'button',
        {
          className: 'tb-btn tb-btn-ghost tb-btn-sm',
          style: 'font-size: var(--font-size-xs);',
          onclick: markAllAsRead,
        },
        'Mark all as read'
      )
    );

    // Body
    const body = h('div', {
      style: 'overflow-y: auto; flex: 1; min-height: 120px; max-height: 380px;',
    });

    if (isLoading) {
      body.appendChild(
        h('div', { className: 'tb-loading', style: 'padding: 24px; text-align: center;' }, 'Loading...')
      );
    } else if (items.length === 0) {
      body.appendChild(
        h(
          'div',
          {
            className: 'tb-empty-state',
            style: 'padding: 32px 16px; text-align: center; color: var(--color-text-muted);',
          },
          h('div', { style: 'font-size: 24px; margin-bottom: 8px;' }, '🔔'),
          h('p', { style: 'margin: 0; font-size: var(--font-size-sm);' }, 'No notifications yet.')
        )
      );
    } else {
      items.forEach((item) => {
        const isUnread = !item.readAt;
        const row = h(
          'div',
          {
            className: `tb-notification-item ${isUnread ? 'tb-notification-unread' : ''}`,
            style: `display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; background: ${
              isUnread ? 'var(--bg-hover)' : 'transparent'
            }; position: relative; transition: background 0.15s ease;`,
            onclick: () => handleItemClick(item),
          },
          h(
            'div',
            { style: 'font-size: 20px; flex-shrink: 0; line-height: 1;' },
            getTypeIcon(item.type)
          ),
          h(
            'div',
            { style: 'flex: 1; min-width: 0;' },
            h(
              'div',
              {
                style: `font-size: var(--font-size-sm); font-weight: ${isUnread ? '600' : '500'}; color: var(--color-text-main); margin-bottom: 2px;`,
              },
              item.title
            ),
            h(
              'div',
              {
                style: 'font-size: var(--font-size-xs); color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;',
              },
              item.body
            ),
            h(
              'div',
              { style: 'font-size: var(--font-size-xs); color: var(--color-text-dim);' },
              formatRelativeTime(item.createdAt)
            )
          ),
          h(
            'button',
            {
              className: 'tb-btn tb-btn-ghost tb-btn-sm',
              title: 'Dismiss',
              style: 'padding: 2px 6px; font-size: 12px; height: 24px; align-self: flex-start;',
              onclick: (e) => dismissNotification(item, e),
            },
            '✕'
          )
        );

        body.appendChild(row);
      });
    }

    container.appendChild(header);
    container.appendChild(body);
  }

  loadNotifications();
  return container;
}
