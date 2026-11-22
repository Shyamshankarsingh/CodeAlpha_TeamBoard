import { h } from '../lib/dom.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { avatar } from '../components/avatar.js';
import { button } from '../components/button.js';
import { input } from '../components/input.js';

export function MembersPage(params = {}) {
  const container = h('div', { className: 'tb-members-page' });
  const workspaceId = params.workspaceId || store.getState().currentWorkspaceId;

  let members = [];
  let invitations = [];
  let myRole = 'member';
  let isInviting = false;
  let inviteError = '';

  async function loadData() {
    if (!workspaceId) return;

    try {
      const wsData = await api(`/api/workspaces/${workspaceId}`);
      myRole = wsData.role;

      const mData = await api(`/api/workspaces/${workspaceId}/members?pageSize=100`);
      members = mData || [];

      if (['owner', 'admin'].includes(myRole)) {
        const iData = await api(`/api/workspaces/${workspaceId}/invitations`);
        invitations = iData || [];
      }

      render();
    } catch (e) {
      console.error(e);
    }
  }

  function render() {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const canInvite = ['owner', 'admin'].includes(myRole);
    const isOwner = myRole === 'owner';

    container.appendChild(
      h(
        'div',
        { className: 'tb-members-layout' },
        h(
          'header',
          { className: 'tb-members-header' },
          h(
            'div',
            {},
            h('h1', {}, 'Members'),
            h('p', { className: 'tb-text-muted' }, 'Manage team members and workspace access permissions')
          ),
          canInvite &&
            button(
              {
                variant: 'primary',
                onclick: () => {
                  isInviting = !isInviting;
                  inviteError = '';
                  render();
                },
              },
              isInviting ? 'Cancel Invite' : '+ Invite Member'
            )
        ),

        // Invite Form Modal/Banner
        isInviting &&
          h(
            'div',
            { className: 'tb-card tb-invite-box' },
            h('h3', {}, 'Invite New Member'),
            inviteError && h('div', { className: 'tb-alert tb-alert-error' }, inviteError),
            h(
              'form',
              {
                onsubmit: async (e) => {
                  e.preventDefault();
                  const email = e.target.querySelector('#invite-email').value;
                  const role = e.target.querySelector('#invite-role').value;
                  try {
                    await api(`/api/workspaces/${workspaceId}/invitations`, {
                      method: 'POST',
                      body: JSON.stringify({ email, role }),
                    });
                    store.showToast(`Invitation sent to ${email}`, 'success');
                    isInviting = false;
                    loadData();
                  } catch (err) {
                    inviteError = err.message || 'Invitation failed';
                    render();
                  }
                },
              },
              h(
                'div',
                { className: 'tb-invite-inputs' },
                input({
                  label: 'Email Address',
                  id: 'invite-email',
                  type: 'email',
                  required: true,
                  placeholder: 'colleague@example.com',
                }),
                h(
                  'div',
                  { className: 'tb-form-group' },
                  h('label', { className: 'tb-label', htmlFor: 'invite-role' }, 'Role'),
                  h(
                    'select',
                    { id: 'invite-role', className: 'tb-select' },
                    isOwner && h('option', { value: 'admin' }, 'Admin (can manage settings and invite)'),
                    h('option', { value: 'member', selected: true }, 'Member (can create tasks and projects)'),
                    h('option', { value: 'viewer' }, 'Viewer (read-only access)')
                  )
                )
              ),
              h('div', { className: 'tb-form-actions' }, button({ type: 'submit' }, 'Send Invitation'))
            )
          ),

        // Members Table
        h(
          'div',
          { className: 'tb-card tb-table-card' },
          h(
            'table',
            { className: 'tb-table' },
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                h('th', {}, 'Member'),
                h('th', {}, 'Email'),
                h('th', {}, 'Role'),
                h('th', {}, 'Joined'),
                h('th', { style: 'text-align: right;' }, 'Actions')
              )
            ),
            h(
              'tbody',
              {},
              ...members.map((member) => {
                const isTargetOwner = member.role === 'owner';
                const isTargetSelf = member.userId === store.getState().user?.id;
                const canChangeRole =
                  (isOwner && !isTargetOwner) ||
                  (myRole === 'admin' && ['member', 'viewer'].includes(member.role));
                const canRemove =
                  isTargetSelf ||
                  (isOwner && !isTargetOwner) ||
                  (myRole === 'admin' && ['member', 'viewer'].includes(member.role));

                return h(
                  'tr',
                  {},
                  h(
                    'td',
                    { className: 'tb-member-cell' },
                    avatar({ name: member.name, avatarUrl: member.avatarUrl, size: 32 }),
                    h('span', { className: 'tb-member-name' }, member.name),
                    isTargetSelf ? h('span', { className: 'tb-badge' }, 'You') : null
                  ),
                  h('td', { className: 'tb-text-muted' }, member.email || '—'),
                  h(
                    'td',
                    {},
                    canChangeRole
                      ? h(
                          'select',
                          {
                            className: 'tb-select tb-select-sm',
                            value: member.role,
                            onchange: async (e) => {
                              try {
                                await api(`/api/workspaces/${workspaceId}/members/${member.userId}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ role: e.target.value }),
                                });
                                store.showToast('Role updated', 'success');
                                loadData();
                              } catch (err) {
                                store.showToast(err.message || 'Failed to update role', 'error');
                                e.target.value = member.role;
                              }
                            },
                          },
                          isOwner && h('option', { value: 'admin' }, 'Admin'),
                          h('option', { value: 'member' }, 'Member'),
                          h('option', { value: 'viewer' }, 'Viewer')
                        )
                      : h('span', { className: 'tb-badge' }, member.role)
                  ),
                  h('td', { className: 'tb-text-muted tb-text-sm' }, new Date(member.joinedAt).toLocaleDateString()),
                  h(
                    'td',
                    { style: 'text-align: right;' },
                    canRemove
                      ? button(
                          {
                            variant: 'ghost',
                            onclick: async () => {
                              const actionText = isTargetSelf ? 'leave this workspace' : `remove ${member.name}`;
                              if (!confirm(`Are you sure you want to ${actionText}?`)) return;

                              try {
                                await api(`/api/workspaces/${workspaceId}/members/${member.userId}`, {
                                  method: 'DELETE',
                                });
                                store.showToast(isTargetSelf ? 'Left workspace' : 'Member removed', 'info');
                                if (isTargetSelf) {
                                  router.navigate('/');
                                } else {
                                  loadData();
                                }
                              } catch (err) {
                                store.showToast(err.message || 'Operation failed', 'error');
                              }
                            },
                          },
                          isTargetSelf ? 'Leave' : 'Remove'
                        )
                      : null
                  )
                );
              })
            )
          )
        ),

        // Pending Invitations
        invitations.length > 0 &&
          h(
            'div',
            { className: 'tb-card', style: 'margin-top: var(--space-6);' },
            h('h3', {}, 'Pending Invitations'),
            h(
              'div',
              { className: 'tb-sessions-list', style: 'margin-top: var(--space-3);' },
              ...invitations.map((inv) =>
                h(
                  'div',
                  { className: 'tb-session-item' },
                  h(
                    'div',
                    {},
                    h('strong', {}, inv.email),
                    h(
                      'div',
                      { className: 'tb-text-muted tb-text-sm' },
                      `Invited as ${inv.role} • Expires: ${new Date(inv.expires_at).toLocaleDateString()}`
                    )
                  ),
                  button(
                    {
                      variant: 'ghost',
                      onclick: async () => {
                        await api(`/api/workspaces/${workspaceId}/invitations/${inv.id}`, { method: 'DELETE' });
                        store.showToast('Invitation revoked', 'info');
                        loadData();
                      },
                    },
                    'Revoke'
                  )
                )
              )
            )
          )
      )
    );
  }

  loadData();
  return container;
}
