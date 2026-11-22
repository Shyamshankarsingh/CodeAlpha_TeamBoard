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

  // Project Permissions
  canCreateProject(workspaceRole) {
    return ['owner', 'admin', 'member'].includes(workspaceRole);
  },

  canViewProject(workspaceRole, projectVisibility, isProjectMember) {
    if (!workspaceRole) return false;
    if (['owner', 'admin'].includes(workspaceRole)) return true;
    if (projectVisibility === 'workspace') {
      return ['member', 'viewer'].includes(workspaceRole);
    }
    // private: only project members (and owners/admins handled above)
    return Boolean(isProjectMember) && ['member', 'viewer'].includes(workspaceRole);
  },

  canEditProject(workspaceRole, projectRole) {
    if (['owner', 'admin'].includes(workspaceRole)) return true;
    return projectRole === 'lead';
  },

  canDeleteProject(workspaceRole) {
    return ['owner', 'admin'].includes(workspaceRole);
  },

  canManageProjectMembers(workspaceRole, projectRole) {
    if (['owner', 'admin'].includes(workspaceRole)) return true;
    return projectRole === 'lead';
  },

  // Board & Column Permissions
  canManageBoards(workspaceRole, projectRole) {
    if (['owner', 'admin'].includes(workspaceRole)) return true;
    return projectRole === 'lead';
  },

  canViewBoard(workspaceRole, projectVisibility, isProjectMember) {
    return this.canViewProject(workspaceRole, projectVisibility, isProjectMember);
  },

  // Task Permissions
  canCreateTask(workspaceRole) {
    return ['owner', 'admin', 'member'].includes(workspaceRole);
  },

  canEditTask(workspaceRole) {
    return ['owner', 'admin', 'member'].includes(workspaceRole);
  },

  canDeleteTask(workspaceRole, projectRole, reporterId, userId) {
    if (['owner', 'admin'].includes(workspaceRole)) return true;
    if (projectRole === 'lead') return true;
    if (reporterId === userId && workspaceRole === 'member') return true;
    return false;
  },

  // Comment Permissions
  canCreateComment(workspaceRole) {
    return ['owner', 'admin', 'member'].includes(workspaceRole);
  },

  canEditComment(workspaceRole, authorId, userId) {
    return authorId === userId && ['owner', 'admin', 'member'].includes(workspaceRole);
  },

  canDeleteComment(workspaceRole, projectRole, authorId, userId) {
    if (['owner', 'admin'].includes(workspaceRole)) return true;
    if (projectRole === 'lead') return true;
    if (authorId === userId && ['owner', 'admin', 'member'].includes(workspaceRole)) return true;
    return false;
  },

  // Attachment Permissions
  canUploadAttachment(workspaceRole) {
    return ['owner', 'admin', 'member'].includes(workspaceRole);
  },

  canDeleteAttachment(workspaceRole, projectRole, uploaderId, userId) {
    if (['owner', 'admin'].includes(workspaceRole)) return true;
    if (projectRole === 'lead') return true;
    if (uploaderId === userId && ['owner', 'admin', 'member'].includes(workspaceRole)) return true;
    return false;
  },
};
