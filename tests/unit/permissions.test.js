import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { permissions } from '../../server/lib/permissions.js';

describe('Permissions Matrix Unit Tests (SECURITY section 4)', () => {
  test('canViewWorkspace: any member can view workspace', () => {
    assert.equal(permissions.canViewWorkspace('owner'), true);
    assert.equal(permissions.canViewWorkspace('admin'), true);
    assert.equal(permissions.canViewWorkspace('member'), true);
    assert.equal(permissions.canViewWorkspace('viewer'), true);
    assert.equal(permissions.canViewWorkspace('anonymous'), false);
  });

  test('canEditWorkspace: owner and admin only', () => {
    assert.equal(permissions.canEditWorkspace('owner'), true);
    assert.equal(permissions.canEditWorkspace('admin'), true);
    assert.equal(permissions.canEditWorkspace('member'), false);
    assert.equal(permissions.canEditWorkspace('viewer'), false);
  });

  test('canDeleteWorkspace and canTransferOwnership: owner only', () => {
    assert.equal(permissions.canDeleteWorkspace('owner'), true);
    assert.equal(permissions.canDeleteWorkspace('admin'), false);
    assert.equal(permissions.canDeleteWorkspace('member'), false);
    assert.equal(permissions.canDeleteWorkspace('viewer'), false);

    assert.equal(permissions.canTransferOwnership('owner'), true);
    assert.equal(permissions.canTransferOwnership('admin'), false);
    assert.equal(permissions.canTransferOwnership('member'), false);
  });

  test('canInviteMembers: owner can invite admin/member/viewer, admin can invite member/viewer', () => {
    // Owner
    assert.equal(permissions.canInviteMembers('owner', 'admin'), true);
    assert.equal(permissions.canInviteMembers('owner', 'member'), true);
    assert.equal(permissions.canInviteMembers('owner', 'viewer'), true);
    assert.equal(permissions.canInviteMembers('owner', 'owner'), false);

    // Admin
    assert.equal(permissions.canInviteMembers('admin', 'admin'), false);
    assert.equal(permissions.canInviteMembers('admin', 'member'), true);
    assert.equal(permissions.canInviteMembers('admin', 'viewer'), true);

    // Member / Viewer
    assert.equal(permissions.canInviteMembers('member', 'viewer'), false);
    assert.equal(permissions.canInviteMembers('viewer', 'viewer'), false);
  });

  test('canChangeMemberRole: strictly enforces hierarchy', () => {
    // Owner can change any non-owner role to another non-owner role
    assert.equal(permissions.canChangeMemberRole('owner', 'admin', 'member'), true);
    assert.equal(permissions.canChangeMemberRole('owner', 'member', 'admin'), true);
    assert.equal(permissions.canChangeMemberRole('owner', 'viewer', 'member'), true);
    assert.equal(permissions.canChangeMemberRole('owner', 'owner', 'member'), false); // Transfer ownership endpoint is required

    // Admin can only change member <-> viewer
    assert.equal(permissions.canChangeMemberRole('admin', 'member', 'viewer'), true);
    assert.equal(permissions.canChangeMemberRole('admin', 'viewer', 'member'), true);
    assert.equal(permissions.canChangeMemberRole('admin', 'member', 'admin'), false);
    assert.equal(permissions.canChangeMemberRole('admin', 'admin', 'member'), false);
    assert.equal(permissions.canChangeMemberRole('admin', 'owner', 'member'), false);

    // Member / Viewer
    assert.equal(permissions.canChangeMemberRole('member', 'viewer', 'member'), false);
    assert.equal(permissions.canChangeMemberRole('viewer', 'member', 'viewer'), false);
  });

  test('canRemoveMember: enforces hierarchy and self-leave', () => {
    // Leaving self
    assert.equal(permissions.canRemoveMember('viewer', 'viewer', true), true);
    assert.equal(permissions.canRemoveMember('member', 'member', true), true);
    assert.equal(permissions.canRemoveMember('admin', 'admin', true), true);
    assert.equal(permissions.canRemoveMember('owner', 'owner', true), true);

    // Removing others
    assert.equal(permissions.canRemoveMember('owner', 'admin', false), true);
    assert.equal(permissions.canRemoveMember('owner', 'member', false), true);
    assert.equal(permissions.canRemoveMember('admin', 'member', false), true);
    assert.equal(permissions.canRemoveMember('admin', 'viewer', false), true);
    assert.equal(permissions.canRemoveMember('admin', 'admin', false), false);
    assert.equal(permissions.canRemoveMember('admin', 'owner', false), false);
    assert.equal(permissions.canRemoveMember('member', 'viewer', false), false);
  });
});
