import { h } from '../lib/dom.js';
import { store } from '../store.js';
import { router } from '../router.js';

export function sidebar() {
  const { workspaces, currentWorkspaceId, user } = store.getState();
  const currentWs = workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  const wsSelect = h(
    'select',
    {
      className: 'tb-select tb-ws-switcher',
      onchange: (e) => {
        const selectedId = e.target.value;
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
      },
      h('span', { className: 'tb-sidebar-icon' }, icon),
      h('span', { className: 'tb-sidebar-label' }, label)
    );
  }

  const wsId = currentWs ? currentWs.id : '';

  return h(
    'aside',
    { className: 'tb-sidebar' },
    h(
      'div',
      { className: 'tb-sidebar-header' },
      h('div', { className: 'tb-sidebar-ws-label' }, 'WORKSPACE'),
      wsSelect
    ),
    h(
      'nav',
      { className: 'tb-sidebar-nav' },
      navItem(wsId ? `/w/${wsId}` : '/', 'Overview', '📊'),
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
