import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { permissions } from '../../server/lib/permissions.js';

describe('Project Permissions Matrix Unit Tests (SECURITY section 2 & ADR-021)', () => {
  test('canCreateProject: Owner, Admin, and Member can create; Viewer cannot', () => {
    assert.equal(permissions.canCreateProject('owner'), true);
    assert.equal(permissions.canCreateProject('admin'), true);
    assert.equal(permissions.canCreateProject('member'), true);
    assert.equal(permissions.canCreateProject('viewer'), false);
    assert.equal(permissions.canCreateProject(null), false);
  });

  test('canViewProject: Workspace visibility allowed for all workspace roles', () => {
    assert.equal(permissions.canViewProject('owner', 'workspace', false), true);
    assert.equal(permissions.canViewProject('admin', 'workspace', false), true);
    assert.equal(permissions.canViewProject('member', 'workspace', false), true);
    assert.equal(permissions.canViewProject('viewer', 'workspace', false), true);
    assert.equal(permissions.canViewProject(null, 'workspace', false), false);
  });

  test('canViewProject: Private visibility (ADR-021)', () => {
    // Owners and Admins always have access to private projects
    assert.equal(permissions.canViewProject('owner', 'private', false), true);
    assert.equal(permissions.canViewProject('admin', 'private', false), true);

    // Members and Viewers can only view if they are project members
    assert.equal(permissions.canViewProject('member', 'private', true), true);
    assert.equal(permissions.canViewProject('member', 'private', false), false);
    assert.equal(permissions.canViewProject('viewer', 'private', true), true);
    assert.equal(permissions.canViewProject('viewer', 'private', false), false);
  });

  test('canEditProject: Owner, Admin, or project Lead can edit', () => {
    assert.equal(permissions.canEditProject('owner', null), true);
    assert.equal(permissions.canEditProject('admin', null), true);
    assert.equal(permissions.canEditProject('member', 'lead'), true);
    assert.equal(permissions.canEditProject('member', 'member'), false);
    assert.equal(permissions.canEditProject('viewer', 'member'), false);
  });

  test('canDeleteProject: Owner and Admin only', () => {
    assert.equal(permissions.canDeleteProject('owner'), true);
    assert.equal(permissions.canDeleteProject('admin'), true);
    assert.equal(permissions.canDeleteProject('member'), false);
    assert.equal(permissions.canDeleteProject('viewer'), false);
  });

  test('canManageProjectMembers: Owner, Admin, or Lead only', () => {
    assert.equal(permissions.canManageProjectMembers('owner', null), true);
    assert.equal(permissions.canManageProjectMembers('admin', null), true);
    assert.equal(permissions.canManageProjectMembers('member', 'lead'), true);
    assert.equal(permissions.canManageProjectMembers('member', 'member'), false);
  });
});
