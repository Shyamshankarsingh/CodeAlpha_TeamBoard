/**
 * Server-side authorization rules for workspaces and projects.
 * Enforces the permission matrix in SECURITY.md section 4.
 */

export const permissions = {
  // Workspace Access
  canViewWorkspace(role) {
    return ['owner', 'admin', 'member', 'viewer'].includes(role);
  },

  canEditWorkspace(role) {
    return ['owner', 'admin'].includes(role);
  },

  canDeleteWorkspace(role) {
    return role === 'owner';
  },

  canTransferOwnership(role) {
    return role === 'owner';
  },

  canInviteMembers(actorRole, targetRole) {
    if (actorRole === 'owner') {
      return ['admin', 'member', 'viewer'].includes(targetRole);
    }
    if (actorRole === 'admin') {
      // Admin cannot invite admin or owner
      return ['member', 'viewer'].includes(targetRole);
    }
    return false;
  },

  canChangeMemberRole(actorRole, targetCurrentRole, targetNewRole) {
    if (actorRole === 'owner') {
      // Owner can change any member below owner to any role below owner
      return targetCurrentRole !== 'owner' && targetNewRole !== 'owner';
    }
    if (actorRole === 'admin') {
      // Admin can only modify member and viewer roles
      const isTargetManageable = ['member', 'viewer'].includes(targetCurrentRole);
      const isNewRoleAllowed = ['member', 'viewer'].includes(targetNewRole);
      return isTargetManageable && isNewRoleAllowed;
    }
    return false;
  },

  canRemoveMember(actorRole, targetRole, isSelf = false) {
    if (isSelf) {
      // Any member can leave (checked separately for last owner)
      return true;
    }
    if (actorRole === 'owner') {
      return true;
    }
    if (actorRole === 'admin') {
      // Admin cannot remove owners or other admins
      return ['member', 'viewer'].includes(targetRole);
    }
    return false;
  },
};
