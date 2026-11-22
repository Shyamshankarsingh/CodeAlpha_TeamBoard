import { workspacesRepo } from '../workspaces/repo.js';
import { projectsService } from '../projects/service.js';
import { dashboardRepo } from './repo.js';
import { AppError } from '../../lib/errors.js';

function getVisibleProjectIds(userId, workspaceId) {
  const membership = workspacesRepo.findMembership(workspaceId, userId);
  if (!membership) {
    throw new AppError('NOT_FOUND', 404, 'Workspace not found');
  }

  // listWorkspaceProjects applies full permission matrix (including private project isolation)
  const visibleProjects = projectsService.listWorkspaceProjects(userId, workspaceId, {
    archived: 'false',
  });

  return {
    membership,
    visibleProjectIds: visibleProjects.map((p) => p.id),
  };
}

export const dashboardService = {
  getOverview(userId, workspaceId) {
    const { visibleProjectIds } = getVisibleProjectIds(userId, workspaceId);
    const stats = dashboardRepo.getWorkspaceTaskStats(visibleProjectIds);
    const projects = dashboardRepo.getProjectProgress(visibleProjectIds);

    return {
      stats,
      projects,
    };
  },

  getMyTasks(userId, workspaceId, query = {}) {
    const { visibleProjectIds } = getVisibleProjectIds(userId, workspaceId);
    return dashboardRepo.getMyTasks(userId, visibleProjectIds, query);
  },

  getUpcoming(userId, workspaceId) {
    const { visibleProjectIds } = getVisibleProjectIds(userId, workspaceId);
    return dashboardRepo.getUpcomingTasks(visibleProjectIds);
  },

  getActivity(userId, workspaceId, query = {}) {
    const { visibleProjectIds } = getVisibleProjectIds(userId, workspaceId);
    return dashboardRepo.getWorkspaceActivity(workspaceId, visibleProjectIds, query);
  },
};
