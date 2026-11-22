import { projectsRepo } from '../projects/repo.js';
import { workspacesRepo } from '../workspaces/repo.js';
import { tasksRepo } from '../tasks/repo.js';
import { permissions } from '../../lib/permissions.js';
import { AppError } from '../../lib/errors.js';

export const exportService = {
  exportProjectData({ projectId, format = 'json', user }) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const workspaceId = project.workspace_id || project.workspaceId;
    const wsMembership = workspacesRepo.findMembership(workspaceId, user.id);
    if (!wsMembership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projMember = projectsRepo.findProjectMember(project.id, user.id);
    const canView = permissions.canViewProject(wsMembership.role, project.visibility, projMember);
    if (!canView) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const { tasks } = tasksRepo.listFilteredProjectTasks(projectId, { limit: 10000, includeArchived: true });

    if (format === 'csv') {
      return {
        contentType: 'text/csv; charset=utf-8',
        fileName: `${slugify(project.name)}-tasks.csv`,
        data: tasksToCsv(tasks),
      };
    }

    return {
      contentType: 'application/json; charset=utf-8',
      fileName: `${slugify(project.name)}-tasks.json`,
      data: JSON.stringify({ project: { id: project.id, name: project.name }, tasks }, null, 2),
    };
  },
};

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function tasksToCsv(tasks) {
  const headers = ['ID', 'Title', 'Description', 'Column', 'Priority', 'Status', 'Due Date', 'Created At'];
  const rows = tasks.map(t => [
    csvEscape(t.id),
    csvEscape(t.title),
    csvEscape(t.description || ''),
    csvEscape(t.columnName || t.columnId),
    csvEscape(t.priority),
    csvEscape(t.status),
    csvEscape(t.dueDate || ''),
    csvEscape(t.createdAt),
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
}
