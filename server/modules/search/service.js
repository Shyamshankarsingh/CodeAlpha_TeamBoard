import { searchRepo } from './repo.js';
import { workspacesRepo } from '../workspaces/repo.js';
import { projectsRepo } from '../projects/repo.js';
import { permissions } from '../../lib/permissions.js';
import { AppError } from '../../lib/errors.js';

export const searchService = {
  search({ workspaceId, query, user }) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return { tasks: [] };
    }

    const wsMembership = workspacesRepo.findMembership(workspaceId, user.id);
    if (!wsMembership) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    const results = searchRepo.searchTasks({
      workspaceId,
      query: query.trim(),
    });

    // Enforce private project visibility
    const visibleTasks = results.filter(task => {
      const projMember = projectsRepo.findProjectMember(task.projectId, user.id);
      return permissions.canViewProject(wsMembership.role, task.projectVisibility, projMember);
    });

    return { tasks: visibleTasks };
  },
};
