import { getDb } from '../../db/index.js';
import { projectsRepo } from './repo.js';
import { boardsRepo } from '../boards/repo.js';
import { workspacesRepo } from '../workspaces/repo.js';
import { permissions } from '../../lib/permissions.js';
import { generateId } from '../../lib/ids.js';
import { AppError } from '../../lib/errors.js';
import { events } from '../../lib/events.js';
import { logActivity } from '../../lib/activity.js';

export const projectsService = {
  createProject(userId, workspaceId, data) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    if (!permissions.canCreateProject(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    const projectId = generateId();
    let project;

    const execute = db.transact(() => {
      project = projectsRepo.createProject({
        id: projectId,
        workspaceId,
        name: data.name,
        description: data.description || '',
        visibility: data.visibility || 'workspace',
        priority: data.priority || 'none',
        startDate: data.startDate || null,
        deadline: data.deadline || null,
        ownerId: userId,
      });

      projectsRepo.addProjectMember(projectId, userId, 'lead');

      boardsRepo.createDefaultBoard(db, projectId);

      logActivity(db, {
        workspaceId,
        projectId,
        actorId: userId,
        entityType: 'project',
        entityId: projectId,
        action: 'project.created',
        metadata: { name: project.name, visibility: project.visibility },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('project.created', {
        workspaceId,
        project: formatProject(project),
        actorId: userId,
      });
    });

    return formatProject(project, { role: 'lead', isMember: true });
  },

  listWorkspaceProjects(userId, workspaceId, query = {}) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    const rawProjects = projectsRepo.listProjects(workspaceId, query);

    const visibleProjects = rawProjects.filter((p) => {
      const pm = projectsRepo.findProjectMember(p.id, userId);
      return permissions.canViewProject(membership.role, p.visibility, Boolean(pm));
    });

    return visibleProjects.map((p) => {
      const pm = projectsRepo.findProjectMember(p.id, userId);
      const stats = projectsRepo.getProjectStats(p.id);
      return formatProject(p, {
        role: pm ? pm.role : null,
        isMember: Boolean(pm),
        stats,
      });
    });
  },

  getProject(userId, projectId) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    const canView = permissions.canViewProject(
      membership.role,
      project.visibility,
      Boolean(projectMembership)
    );

    if (!canView) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const stats = projectsRepo.getProjectStats(projectId);
    const members = projectsRepo.listProjectMembers(projectId);

    return formatProject(project, {
      role: projectMembership ? projectMembership.role : null,
      isMember: Boolean(projectMembership),
      stats,
      members,
      permissions: {
        canEdit: permissions.canEditProject(membership.role, projectMembership?.role) && !project.archived_at,
        canDelete: permissions.canDeleteProject(membership.role),
        canManageMembers: permissions.canManageProjectMembers(membership.role, projectMembership?.role),
        canArchive: permissions.canEditProject(membership.role, projectMembership?.role),
      },
    });
  },

  updateProject(userId, projectId, updates) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewProject(membership.role, project.visibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    if (project.archived_at) {
      throw new AppError('PROJECT_ARCHIVED', 400, 'Archived projects cannot be edited');
    }

    if (!permissions.canEditProject(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    let updatedProject;

    const execute = db.transact(() => {
      const changes = projectsRepo.updateProject(
        projectId,
        updates,
        updates.expectedVersion
      );

      if (changes === 0) {
        const current = projectsRepo.findProjectById(projectId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Project not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Project was modified by another user. Please reload.'
        );
      }

      updatedProject = projectsRepo.findProjectById(projectId);

      logActivity(db, {
        workspaceId: project.workspace_id,
        projectId,
        actorId: userId,
        entityType: 'project',
        entityId: projectId,
        action: 'project.updated',
        metadata: { updates },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('project.updated', {
        workspaceId: project.workspace_id,
        project: formatProject(updatedProject),
        actorId: userId,
      });
    });

    return formatProject(updatedProject);
  },

  archiveProject(userId, projectId, { expectedVersion }) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewProject(membership.role, project.visibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    if (!permissions.canEditProject(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    if (project.archived_at) {
      return formatProject(project);
    }

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      const now = new Date().toISOString();
      const changes = projectsRepo.setArchived(projectId, now, expectedVersion);

      if (changes === 0) {
        const current = projectsRepo.findProjectById(projectId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Project not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Project was modified by another user. Please reload.'
        );
      }

      updated = projectsRepo.findProjectById(projectId);

      logActivity(db, {
        workspaceId: project.workspace_id,
        projectId,
        actorId: userId,
        entityType: 'project',
        entityId: projectId,
        action: 'project.archived',
        metadata: {},
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('project.archived', {
        workspaceId: project.workspace_id,
        projectId,
        actorId: userId,
      });
    });

    return formatProject(updated);
  },

  unarchiveProject(userId, projectId, { expectedVersion }) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewProject(membership.role, project.visibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    if (!permissions.canEditProject(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    if (!project.archived_at) {
      return formatProject(project);
    }

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      const changes = projectsRepo.setArchived(projectId, null, expectedVersion);

      if (changes === 0) {
        const current = projectsRepo.findProjectById(projectId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Project not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Project was modified by another user. Please reload.'
        );
      }

      updated = projectsRepo.findProjectById(projectId);

      logActivity(db, {
        workspaceId: project.workspace_id,
        projectId,
        actorId: userId,
        entityType: 'project',
        entityId: projectId,
        action: 'project.unarchived',
        metadata: {},
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('project.unarchived', {
        workspaceId: project.workspace_id,
        projectId,
        actorId: userId,
      });
    });

    return formatProject(updated);
  },

  deleteProject(userId, projectId, confirmName) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewProject(membership.role, project.visibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    if (!permissions.canDeleteProject(membership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    if (confirmName !== project.name) {
      throw new AppError('NAME_MISMATCH', 400, 'Project name confirmation does not match');
    }

    const db = getDb();

    const execute = db.transact(() => {
      logActivity(db, {
        workspaceId: project.workspace_id,
        projectId: null,
        actorId: userId,
        entityType: 'project',
        entityId: projectId,
        action: 'project.deleted',
        metadata: { name: project.name },
      });

      projectsRepo.deleteProject(projectId);
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('project.deleted', {
        workspaceId: project.workspace_id,
        projectId,
        name: project.name,
        actorId: userId,
      });
    });

    return { success: true };
  },

  listMembers(userId, projectId) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewProject(membership.role, project.visibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const members = projectsRepo.listProjectMembers(projectId);
    return members.map((m) => ({
      userId: m.user_id,
      role: m.role,
      addedAt: m.added_at,
      user: {
        id: m.id,
        name: m.name,
        email: m.email,
        avatarUrl: m.avatar_url,
      },
    }));
  },

  addMember(userId, projectId, { userId: targetUserId, role = 'member' }) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canManageProjectMembers(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const targetWsMember = workspacesRepo.findMembership(project.workspace_id, targetUserId);
    if (!targetWsMember) {
      throw new AppError('INVALID_MEMBER', 400, 'User is not a member of this workspace');
    }

    const db = getDb();
    const execute = db.transact(() => {
      projectsRepo.addProjectMember(projectId, targetUserId, role);

      logActivity(db, {
        workspaceId: project.workspace_id,
        projectId,
        actorId: userId,
        entityType: 'member',
        entityId: targetUserId,
        action: 'member.added',
        metadata: { role, targetUserId },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('project.member_added', {
        workspaceId: project.workspace_id,
        projectId,
        userId: targetUserId,
        role,
        actorId: userId,
      });
    });

    return {
      projectId,
      userId: targetUserId,
      role,
    };
  },

  updateMemberRole(userId, projectId, targetUserId, role) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canManageProjectMembers(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const targetProjectMember = projectsRepo.findProjectMember(projectId, targetUserId);
    if (!targetProjectMember) {
      throw new AppError('NOT_FOUND', 404, 'Member not found in project');
    }

    const db = getDb();
    const execute = db.transact(() => {
      projectsRepo.updateProjectMemberRole(projectId, targetUserId, role);

      logActivity(db, {
        workspaceId: project.workspace_id,
        projectId,
        actorId: userId,
        entityType: 'member',
        entityId: targetUserId,
        action: 'member.updated',
        metadata: { role, targetUserId },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('project.member_updated', {
        workspaceId: project.workspace_id,
        projectId,
        userId: targetUserId,
        role,
        actorId: userId,
      });
    });

    return {
      projectId,
      userId: targetUserId,
      role,
    };
  },

  removeMember(userId, projectId, targetUserId) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    const isSelf = userId === targetUserId;

    if (!isSelf && !permissions.canManageProjectMembers(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const targetProjectMember = projectsRepo.findProjectMember(projectId, targetUserId);
    if (!targetProjectMember) {
      throw new AppError('NOT_FOUND', 404, 'Member not found in project');
    }

    const db = getDb();
    const execute = db.transact(() => {
      projectsRepo.removeProjectMember(projectId, targetUserId);

      logActivity(db, {
        workspaceId: project.workspace_id,
        projectId,
        actorId: userId,
        entityType: 'member',
        entityId: targetUserId,
        action: 'member.removed',
        metadata: { targetUserId },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('project.member_removed', {
        workspaceId: project.workspace_id,
        projectId,
        userId: targetUserId,
        actorId: userId,
      });
    });

    return { success: true };
  },

  listProjectActivity(userId, projectId, query = {}) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewProject(membership.role, project.visibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    return projectsRepo.listProjectActivity(projectId, query);
  },

  listWorkspaceActivity(userId, workspaceId, query = {}) {
    const membership = workspacesRepo.findMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    return projectsRepo.listWorkspaceActivity(workspaceId, query);
  },
};

function formatProject(p, extras = {}) {
  const formatted = {
    id: p.id,
    workspaceId: p.workspace_id,
    name: p.name,
    description: p.description,
    visibility: p.visibility,
    priority: p.priority,
    startDate: p.start_date,
    deadline: p.deadline,
    ownerId: p.owner_id,
    archivedAt: p.archived_at,
    version: p.version,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    owner: {
      id: p.owner_id,
      name: p.owner_name,
      email: p.owner_email,
      avatarUrl: p.owner_avatar_url,
    },
    memberCount: p.member_count !== undefined ? Number(p.member_count) : undefined,
  };

  if (extras.role !== undefined) formatted.role = extras.role;
  if (extras.isMember !== undefined) formatted.isMember = extras.isMember;
  if (extras.stats !== undefined) formatted.stats = extras.stats;
  if (extras.members !== undefined) formatted.members = extras.members;
  if (extras.permissions !== undefined) formatted.permissions = extras.permissions;

  return formatted;
}
