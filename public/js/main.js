import { router } from './router.js';
import { store } from './store.js';
import { api } from './api.js';
import { h, clearChildren } from './lib/dom.js';
import { LoginPage } from './pages/login.js';
import { RegisterPage } from './pages/register.js';
import { ForgotPasswordPage } from './pages/forgot.js';
import { ResetPasswordPage } from './pages/reset.js';
import { VerifyPage } from './pages/verify.js';
import { SettingsPage } from './pages/settings.js';
import { WorkspaceCreatePage } from './pages/workspace-create.js';
import { WorkspaceSettingsPage } from './pages/workspace-settings.js';
import { MembersPage } from './pages/members.js';
import { InvitePage } from './pages/invite.js';
import { ProjectsPage } from './pages/projects.js';
import { ProjectDetailPage } from './pages/project-detail.js';
import { BoardPage } from './pages/board.js';
import { DashboardPage } from './pages/dashboard.js';
import { LandingPage } from './pages/landing.js';
import { sidebar, closeMobileSidebar, openMobileSidebar } from './components/sidebar.js';
import { renderToast } from './components/toast.js';
import { socketClient } from './lib/socket.js';
import { notificationsMenu } from './components/notifications-menu.js';
import { themeToggle } from './components/theme-toggle.js';
import { initGlobalShortcuts } from './lib/shortcuts.js';

let unreadCount = 0;
let activeNotificationsMenu = null;

async function loadUnreadCount() {
  try {
    const res = await api('/api/notifications/unread-count');
    unreadCount = res?.unreadCount || 0;
    updateBadge();
  } catch {}
}

function updateBadge() {
  const badges = document.querySelectorAll('.tb-unread-badge');
  badges.forEach((b) => {
    if (unreadCount > 0) {
      b.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      b.style.display = 'inline-block';
    } else {
      b.style.display = 'none';
    }
  });
}

function renderNotificationBell() {
  return h(
    'button',
    {
      className: 'tb-btn tb-btn-ghost tb-btn-sm tb-notifications-btn',
      title: 'Notifications',
      style: 'position: relative; font-size: 16px; padding: 4px 8px;',
      onclick: (e) => {
        e.stopPropagation();
        toggleNotificationsMenu();
      },
    },
    '🔔',
    h(
      'span',
      {
        className: 'tb-badge tb-unread-badge',
        style: `display: ${unreadCount > 0 ? 'inline-block' : 'none'}; background: var(--color-danger, #ef4444); color: white; border-radius: 10px; padding: 1px 5px; font-size: 10px; position: absolute; top: 0; right: 0; font-weight: bold;`,
      },
      unreadCount > 99 ? '99+' : String(unreadCount)
    )
  );
}

function toggleNotificationsMenu() {
  if (activeNotificationsMenu) {
    activeNotificationsMenu.remove();
    activeNotificationsMenu = null;
    return;
  }

  const menu = notificationsMenu({
    onClose: () => {
      if (activeNotificationsMenu) {
        activeNotificationsMenu.remove();
        activeNotificationsMenu = null;
      }
    },
    onCountChange: (delta, reset = false) => {
      if (reset) {
        unreadCount = 0;
      } else {
        unreadCount = Math.max(0, unreadCount + delta);
      }
      updateBadge();
    },
  });

  activeNotificationsMenu = menu;
  document.body.appendChild(menu);

  const closeOnClickOutside = (e) => {
    if (activeNotificationsMenu && !activeNotificationsMenu.contains(e.target) && !e.target.closest('.tb-notifications-btn')) {
      activeNotificationsMenu.remove();
      activeNotificationsMenu = null;
      document.removeEventListener('click', closeOnClickOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnClickOutside), 10);
}

function AppShell(content, showSidebar = true) {
  const { user, workspaces } = store.getState();

  if (!user || !showSidebar || workspaces.length === 0) {
    return h(
      'div',
      { className: 'tb-app-shell' },
      h(
        'header',
        { className: 'tb-header' },
        h(
          'div',
          { className: 'tb-header-inner' },
          h('h1', { className: 'tb-logo' }, h('a', { href: '/' }, 'TeamBoard')),
          h(
            'nav',
            { className: 'tb-nav' },
            themeToggle(),
            user
              ? [
                  renderNotificationBell(),
                  h('span', { className: 'tb-user-name' }, user.name),
                  h('a', { href: '/settings', className: 'tb-btn tb-btn-ghost' }, 'Settings'),
                  h(
                    'button',
                    {
                      className: 'tb-btn tb-btn-secondary',
                      onclick: async () => {
                        try {
                          await api('/api/auth/logout', { method: 'POST' });
                        } catch (e) {}
                        socketClient.disconnect();
                        store.setUser(null, null);
                        router.navigate('/login');
                      },
                    },
                    'Sign Out'
                  ),
                ]
              : [
                  h('a', { href: '/login', className: 'tb-btn tb-btn-ghost' }, 'Sign In'),
                  h('a', { href: '/register', className: 'tb-btn tb-btn-primary' }, 'Get Started'),
                ]
          )
        )
      ),
      h('main', { className: 'tb-main' }, content)
    );
  }

  // App shell with Sidebar (and mobile drawer backdrop)
  return h(
    'div',
    { className: 'tb-app-shell tb-with-sidebar' },
    h('div', {
      className: 'tb-sidebar-backdrop',
      onclick: closeMobileSidebar,
    }),
    sidebar(),
    h(
      'div',
      { className: 'tb-content-area' },
      h(
        'header',
        { className: 'tb-topbar' },
        h(
          'div',
          { className: 'tb-topbar-left' },
          h(
            'button',
            {
              type: 'button',
              className: 'tb-btn tb-btn-ghost tb-menu-toggle',
              'aria-label': 'Open navigation drawer',
              onclick: openMobileSidebar,
            },
            '☰'
          ),
          h('div', { className: 'tb-topbar-title' }, 'TeamBoard')
        ),
        h(
          'div',
          { className: 'tb-topbar-actions' },
          themeToggle(),
          renderNotificationBell(),
          h('a', { href: '/settings', className: 'tb-btn tb-btn-ghost tb-btn-sm' }, 'Profile & Sessions'),
          h(
            'button',
            {
              className: 'tb-btn tb-btn-secondary tb-btn-sm',
              onclick: async () => {
                try {
                  await api('/api/auth/logout', { method: 'POST' });
                } catch (e) {}
                store.setUser(null, null);
                router.navigate('/login');
              },
            },
            'Sign Out'
          )
        )
      ),
      h('main', { className: 'tb-main-content' }, content)
    )
  );
}

function WorkspaceOverview(params = {}) {
  const wsId = params.workspaceId || store.getState().currentWorkspaceId;
  const { workspaces } = store.getState();
  const current = workspaces.find((w) => w.id === wsId) || workspaces[0];

  return h(
    'div',
    { className: 'tb-overview' },
    h(
      'div',
      { className: 'tb-overview-header' },
      h('h1', {}, current ? current.name : 'Workspace Overview'),
      h('p', { className: 'tb-text-muted' }, 'Projects and Kanban boards will appear here in Phase 4 & 5.')
    ),
    h(
      'div',
      { className: 'tb-card', style: 'margin-top: var(--space-6);' },
      h('h3', {}, 'Getting Started with Your Workspace'),
      h(
        'ul',
        { style: 'margin: var(--space-4) 0 var(--space-4) var(--space-6); display: flex; flex-direction: column; gap: 8px;' },
        h('li', {}, h('a', { href: `/w/${wsId}/members` }, 'Invite team members'), ' to collaborate'),
        h('li', {}, 'Customize roles and permissions in workspace settings'),
        h('li', {}, 'Projects and Kanban boards coming in the next phases!')
      )
    )
  );
}

function NoWorkspacePage() {
  return h(
    'div',
    { className: 'tb-auth-container' },
    h(
      'div',
      { className: 'tb-card tb-auth-card' },
      h('h1', { className: 'tb-auth-title' }, 'Create Your First Workspace'),
      h(
        'p',
        { className: 'tb-auth-subtitle' },
        'Workspaces keep your projects, tasks, and team members organized in one place.'
      ),
      h(
        'div',
        { className: 'tb-form-actions' },
        h('a', { href: '/workspaces/new', className: 'tb-btn tb-btn-primary' }, '+ Create Workspace')
      )
    )
  );
}

// Toast listener
store.subscribe(() => {
  const toastContainer = document.getElementById('toast-container');
  if (toastContainer) {
    clearChildren(toastContainer);
    const toastEl = renderToast();
    if (toastEl) {
      toastContainer.appendChild(toastEl);
    }
  }
});

// Configure client routes
router
  .on('/', () => {
    const { user, workspaces, currentWorkspaceId } = store.getState();
    if (!user) {
      return LandingPage();
    }
    if (workspaces.length > 0) {
      const targetId = currentWorkspaceId || workspaces[0].id;
      return AppShell(DashboardPage({ workspaceId: targetId }));
    }
    return AppShell(NoWorkspacePage(), false);
  }, { requiresAuth: false })
  .on('/w/:workspaceId', (params) => AppShell(DashboardPage(params)), { requiresAuth: true })
  .on('/w/:workspaceId/dashboard', (params) => AppShell(DashboardPage(params)), { requiresAuth: true })
  .on('/w/:workspaceId/projects', (params) => AppShell(ProjectsPage(params)), { requiresAuth: true })
  .on('/w/:workspaceId/p/:projectId', (params) => AppShell(ProjectDetailPage(params)), { requiresAuth: true })
  .on('/w/:workspaceId/p/:projectId/board', (params) => AppShell(BoardPage(params)), { requiresAuth: true })
  .on('/w/:workspaceId/p/:projectId/b/:boardId', (params) => AppShell(BoardPage(params)), { requiresAuth: true })
  .on('/w/:workspaceId/members', (params) => AppShell(MembersPage(params)), { requiresAuth: true })
  .on('/w/:workspaceId/settings', (params) => AppShell(WorkspaceSettingsPage(params)), { requiresAuth: true })
  .on('/workspaces/new', () => AppShell(WorkspaceCreatePage(), false), { requiresAuth: true })
  .on('/invite/:token', (params) => AppShell(InvitePage(params), false), { requiresAuth: false })
  .on('/login', () => AppShell(LoginPage(), false), { requiresAuth: false, guestOnly: true })
  .on('/register', () => AppShell(RegisterPage(), false), { requiresAuth: false, guestOnly: true })
  .on('/forgot-password', () => AppShell(ForgotPasswordPage(), false), { requiresAuth: false, guestOnly: true })
  .on('/reset-password', () => AppShell(ResetPasswordPage(), false), { requiresAuth: false })
  .on('/verify', () => AppShell(VerifyPage(), false), { requiresAuth: false })
  .on('/settings', () => AppShell(SettingsPage(), false), { requiresAuth: true })
  .notFound(() =>
    AppShell(
      h(
        'div',
        { className: 'tb-card', style: 'text-align: center;' },
        h('h2', {}, '404 - Page Not Found'),
        h('p', { className: 'tb-text-muted' }, 'The page you requested could not be found.'),
        h('a', { href: '/', className: 'tb-btn tb-btn-primary', style: 'margin-top: 16px;' }, 'Go to Home')
      ),
      false
    )
  );

async function init() {
  try {
    const data = await api('/api/auth/me');
    if (data && data.user) {
      store.setUser(data.user, data.csrfToken);
      const socket = socketClient.connect();
      loadUnreadCount();

      if (socket) {
        socket.on('notification:new', (envelope) => {
          unreadCount += 1;
          updateBadge();
          store.setToast(envelope.data?.title || 'New notification', 'info');
        });
        socket.on('notification:read', () => {
          unreadCount = Math.max(0, unreadCount - 1);
          updateBadge();
        });
        socket.on('notification:read_all', () => {
          unreadCount = 0;
          updateBadge();
        });
      }

      // Load workspaces
      try {
        const wsList = await api('/api/workspaces');
        store.setState({ workspaces: wsList || [] });
        if (wsList && wsList.length > 0 && !store.getState().currentWorkspaceId) {
          store.setCurrentWorkspace(wsList[0].id);
        }
      } catch (e) {}
    }
  } catch (e) {
    store.setUser(null, null);
  }

  router.init();
  initGlobalShortcuts();
}

document.addEventListener('DOMContentLoaded', init);
