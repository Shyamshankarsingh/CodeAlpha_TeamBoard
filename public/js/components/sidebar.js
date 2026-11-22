import { h } from '../lib/dom.js';
import { store } from '../store.js';
import { router } from '../router.js';

export function closeMobileSidebar() {
  const sidebarEl = document.querySelector('.tb-sidebar');
  const backdropEl = document.querySelector('.tb-sidebar-backdrop');
  if (sidebarEl) sidebarEl.classList.remove('is-open');
  if (backdropEl) backdropEl.classList.remove('is-open');
}

export function openMobileSidebar() {
  const sidebarEl = document.querySelector('.tb-sidebar');
  const backdropEl = document.querySelector('.tb-sidebar-backdrop');
  if (sidebarEl) sidebarEl.classList.add('is-open');
  if (backdropEl) backdropEl.classList.add('is-open');
}

export function sidebar() {
  const { workspaces, currentWorkspaceId, user } = store.getState();
  const currentWs = workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  const wsSelect = h(
    'select',
    {
      className: 'tb-select tb-ws-switcher',
      'aria-label': 'Select Workspace',
      onchange: (e) => {
        const selectedId = e.target.value;
        closeMobileSidebar();
        if (selectedId === '__create__') {
          router.navigate('/workspaces/new');
        } else {
          store.setCurrentWorkspace(selectedId);
          router.navigate(`/w/${selectedId}`);
        }
      },
    },
    ...workspaces.map((w) =>
      h('option', { value: w.id, selected: currentWs && w.id === currentWs.id }, w.name)
    ),
    h('option', { value: '__create__' }, '+ Create Workspace...')
  );

  const activePath = window.location.pathname;

  function navItem(href, label, icon) {
    const isActive = activePath === href || (href !== '/' && activePath.startsWith(href));
    return h(
      'a',
      {
        href,
        className: `tb-sidebar-link ${isActive ? 'active' : ''}`,
        onclick: () => closeMobileSidebar(),
      },
      h('span', { className: 'tb-sidebar-icon', 'aria-hidden': 'true' }, icon),
      h('span', { className: 'tb-sidebar-label' }, label)
    );
  }

  const wsId = currentWs ? currentWs.id : '';

  return h(
    'aside',
    { className: 'tb-sidebar', 'aria-label': 'Sidebar Navigation' },
    h(
      'div',
      { className: 'tb-sidebar-header' },
      h(
        'div',
        { style: 'display: flex; justify-content: space-between; align-items: center;' },
        h('div', { className: 'tb-sidebar-ws-label' }, 'WORKSPACE'),
        h(
          'button',
          {
            type: 'button',
            className: 'tb-sidebar-mobile-close tb-btn tb-btn-ghost tb-btn-sm',
            'aria-label': 'Close sidebar drawer',
            onclick: closeMobileSidebar,
          },
          '✕'
        )
      ),
      wsSelect
    ),
    h(
      'nav',
      { className: 'tb-sidebar-nav' },
      navItem(wsId ? `/w/${wsId}` : '/', 'Dashboard', '📊'),
      navItem(wsId ? `/w/${wsId}/projects` : '/projects', 'Projects', '📁'),
      navItem(wsId ? `/w/${wsId}/members` : '/members', 'Members', '👥'),
      navItem(wsId ? `/w/${wsId}/settings` : '/settings', 'Workspace Settings', '⚙️')
    ),
    h(
      'div',
      { className: 'tb-sidebar-footer' },
      h(
        'div',
        { className: 'tb-sidebar-user' },
        h('span', { className: 'tb-sidebar-user-name' }, user ? user.name : ''),
        h('span', { className: 'tb-sidebar-user-role' }, currentWs ? currentWs.role : '')
      )
    )
  );
}
