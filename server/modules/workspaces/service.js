import { getDb } from '../../db/index.js';
import { workspacesRepo } from './repo.js';
import { authRepo } from '../auth/repo.js';
import { permissions } from '../../lib/permissions.js';
import { generateId } from '../../lib/ids.js';
import { generateToken, hashToken } from '../../lib/tokens.js';
import { addDays } from '../../lib/time.js';
import { AppError } from '../../lib/errors.js';
import { mailer } from '../../lib/mailer/console.js';
import { config } from '../../config.js';

export const workspacesService = {
  createWorkspace(userId, name) {
    const db = getDb();
    const workspaceId = generateId();
    let workspace;

    const executeCreate = db.transact(() => {
      workspace = workspacesRepo.createWorkspace({
        id: workspaceId,
        name,
        createdBy: userId,
      });

      workspacesRepo.addMember({
        workspaceId,
        userId,
        role: 'owner',
      });
    });

    executeCreate();
    return {
      id: workspace.id,
      name: workspace.name,
      role: 'owner',
    };
  },

  listUserWorkspaces(userId) {
    return workspacesRepo.listUserWorkspaces(userId);
  },

  getWorkspace(userId, workspaceId) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    const workspace = workspacesRepo.findWorkspaceById(workspaceId);
    if (!workspace) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    const memberCount = workspacesRepo.listMembers(workspaceId, { pageSize: 1 }).total;

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        createdAt: workspace.created_at,
      },
      role: membership.role,
      counts: {
        members: memberCount,
      },
    };
  },

  updateWorkspace(userId, workspaceId, updates) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    if (!permissions.canEditWorkspace(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const updated = workspacesRepo.updateWorkspace(workspaceId, updates.name);
    return {
      id: updated.id,
      name: updated.name,
      role: membership.role,
    };
  },

  deleteWorkspace(userId, workspaceId, confirmName) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    if (!permissions.canDeleteWorkspace(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Only the workspace owner can delete the workspace');
    }

    const workspace = workspacesRepo.findWorkspaceById(workspaceId);
    if (confirmName !== workspace.name) {
      throw new AppError('BAD_REQUEST', 400, 'Confirmation name does not match workspace name');
    }

    workspacesRepo.deleteWorkspace(workspaceId);
  },

  transferOwnership(userId, workspaceId, targetUserId) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    if (!permissions.canTransferOwnership(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Only the owner can transfer workspace ownership');
    }

    const targetMembership = workspacesRepo.findMembership(workspaceId, targetUserId);
    if (!targetMembership) {
      throw new AppError('BAD_REQUEST', 400, 'Target user is not a member of this workspace');
    }

    const db = getDb();
    const executeTransfer = db.transact(() => {
      workspacesRepo.updateMemberRole(workspaceId, userId, 'admin');
      workspacesRepo.updateMemberRole(workspaceId, targetUserId, 'owner');
    });

    executeTransfer();
  },

  listMembers(userId, workspaceId, { page = 1, pageSize = 25, q = null }) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    const result = workspacesRepo.listMembers(workspaceId, { page, pageSize, q });
    const isElevated = ['owner', 'admin'].includes(membership.role);

    const members = result.members.map((m) => ({
      userId: m.user_id,
      name: m.name,
      email: isElevated ? m.email : undefined,
      avatarUrl: m.avatar_path,
      role: m.role,
      joinedAt: m.joined_at,
    }));

    return {
      members,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
    };
  },

  changeMemberRole(userId, workspaceId, targetUserId, newRole) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    const target = workspacesRepo.findMembership(workspaceId, targetUserId);
    if (!target) {
      throw new AppError('NOT_FOUND', 404, 'Member not found');
    }

    if (!permissions.canChangeMemberRole(membership.role, target.role, newRole)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // Invariant: cannot demote the last owner
    if (target.role === 'owner' && newRole !== 'owner') {
      const ownerCount = workspacesRepo.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new AppError('LAST_OWNER', 409, 'Cannot demote the last owner of the workspace');
      }
    }

    workspacesRepo.updateMemberRole(workspaceId, targetUserId, newRole);
    return {
      userId: targetUserId,
      role: newRole,
    };
  },

  removeMember(userId, workspaceId, targetUserId) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    const target = workspacesRepo.findMembership(workspaceId, targetUserId);
    if (!target) {
      throw new AppError('NOT_FOUND', 404, 'Member not found');
    }

    const isSelf = userId === targetUserId;
    if (!permissions.canRemoveMember(membership.role, target.role, isSelf)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // Invariant: last owner cannot leave or be removed
    if (target.role === 'owner') {
      const ownerCount = workspacesRepo.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new AppError('LAST_OWNER', 409, 'The last owner cannot leave or be removed from the workspace');
      }
    }

    workspacesRepo.removeMember(workspaceId, targetUserId);
  },

  async createInvitation(userId, workspaceId, { email, role }) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    if (!permissions.canInviteMembers(membership.role, role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // Check if target email is already a member
    const existingUser = authRepo.findUserByEmail(email);
    if (existingUser) {
      const existingMember = workspacesRepo.findMembership(workspaceId, existingUser.id);
      if (existingMember) {
        throw new AppError('ALREADY_EXISTS', 409, 'User is already a member of this workspace');
      }
    }

    // Check if pending invitation exists
    const pending = workspacesRepo.findPendingInvitationByEmail(workspaceId, email);
    if (pending) {
      throw new AppError('ALREADY_EXISTS', 409, 'An active invitation is already pending for this email');
    }

    const invitationId = generateId();
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = addDays(new Date(), 7); // 7-day expiration per PRD

    const workspace = workspacesRepo.findWorkspaceById(workspaceId);

    workspacesRepo.createInvitation({
      id: invitationId,
      workspaceId,
      email,
      role,
      tokenHash,
      invitedBy: userId,
      expiresAt,
    });

    await mailer.sendEmail({
      to: email,
      subject: `Invitation to join ${workspace.name} on TeamBoard`,
      text: `You have been invited to join ${workspace.name} as a ${role}. Accept your invitation: ${config.APP_ORIGIN}/invite/${rawToken}`,
    });

    return {
      id: invitationId,
      email,
      role,
      expiresAt,
    };
  },

  listInvitations(userId, workspaceId) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    return workspacesRepo.listPendingInvitations(workspaceId);
  },

  revokeInvitation(userId, workspaceId, invitationId) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    workspacesRepo.revokeInvitation(invitationId, workspaceId);
  },

  previewInvitation(rawToken) {
    const tokenHash = hashToken(rawToken);
    const invitation = workspacesRepo.findActiveInvitationByHash(tokenHash);

    if (!invitation) {
      throw new AppError('NOT_FOUND', 404, 'Invitation not found or expired');
    }

    const workspace = workspacesRepo.findWorkspaceById(invitation.workspace_id);
    return {
      workspaceName: workspace.name,
      role: invitation.role,
      email: invitation.email,
    };
  },

  acceptInvitation(userId, userEmail, rawToken) {
    const tokenHash = hashToken(rawToken);
    const invitation = workspacesRepo.findActiveInvitationByHash(tokenHash);

    if (!invitation) {
      throw new AppError('BAD_REQUEST', 400, 'Invalid or expired invitation');
    }

    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new AppError('FORBIDDEN', 403, 'Signed-in email does not match invitation recipient');
    }

    // Check if already a member
    const existing = workspacesRepo.findMembership(invitation.workspace_id, userId);
    if (existing) {
      workspacesRepo.markInvitationAccepted(invitation.id);
      return {
        workspaceId: invitation.workspace_id,
        role: existing.role,
      };
    }

    const db = getDb();
    const executeAccept = db.transact(() => {
      workspacesRepo.markInvitationAccepted(invitation.id);
      workspacesRepo.addMember({
        workspaceId: invitation.workspace_id,
        userId,
        role: invitation.role,
      });
    });

    executeAccept();

    return {
      workspaceId: invitation.workspace_id,
      role: invitation.role,
    };
  },

  getMyInvitations(userEmail) {
    return workspacesRepo.listMyPendingInvitations(userEmail);
  },
};
