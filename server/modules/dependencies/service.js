import { dependenciesRepo } from './repo.js';
import { tasksRepo } from '../tasks/repo.js';
import { projectsRepo } from '../projects/repo.js';
import { workspacesRepo } from '../workspaces/repo.js';
import { permissions } from '../../lib/permissions.js';
import { AppError } from '../../lib/errors.js';

export const dependenciesService = {
  addDependency({ taskId, dependsOnTaskId, user }) {
    if (!dependsOnTaskId || taskId === dependsOnTaskId) {
      throw new AppError('VALIDATION_ERROR', 400, 'A task cannot depend on itself');
    }

    const task = tasksRepo.findTaskById(taskId);
    if (!task) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const targetTask = tasksRepo.findTaskById(dependsOnTaskId);
    if (!targetTask) {
      throw new AppError('NOT_FOUND', 404, 'Target dependency task not found');
    }

    if (task.projectId !== targetTask.projectId) {
      throw new AppError('VALIDATION_ERROR', 400, 'Dependencies must be within the same project');
    }

    const project = projectsRepo.findProjectById(task.projectId);
    const workspaceId = project.workspace_id || project.workspaceId;
    const wsMembership = workspacesRepo.findMembership(workspaceId, user.id);
    if (!wsMembership) {
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }

    const projMember = projectsRepo.findProjectMember(project.id, user.id);
    const canView = permissions.canViewProject(wsMembership.role, project.visibility, projMember);
    if (!canView) {
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }

    if (!permissions.canEditTask(wsMembership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // Check if dependency already exists
    const existing = dependenciesRepo.findExistingDependency(taskId, dependsOnTaskId);
    if (existing) {
      throw new AppError('CONFLICT', 409, 'Dependency already exists');
    }

    // Cycle detection: Does dependsOnTaskId transitively depend on taskId?
    const edges = dependenciesRepo.getAllDependenciesForProject(project.id);
    const adj = new Map();
    for (const edge of edges) {
      if (!adj.has(edge.task_id)) adj.set(edge.task_id, []);
      adj.get(edge.task_id).push(edge.depends_on_task_id);
    }

    const visited = new Set();
    const queue = [dependsOnTaskId];
    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr === taskId) {
        throw new AppError('CIRCULAR_DEPENDENCY', 400, 'Adding this dependency would create a cycle');
      }
      if (!visited.has(curr)) {
        visited.add(curr);
        const neighbors = adj.get(curr) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
    }

    return dependenciesRepo.createDependency({
      taskId,
      dependsOnTaskId,
    });
  },

  listDependencies({ taskId, user }) {
    const task = tasksRepo.findTaskById(taskId);
    if (!task) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const project = projectsRepo.findProjectById(task.projectId);
    const workspaceId = project.workspace_id || project.workspaceId;
    const wsMembership = workspacesRepo.findMembership(workspaceId, user.id);
    if (!wsMembership) {
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }

    const projMember = projectsRepo.findProjectMember(project.id, user.id);
    const canView = permissions.canViewProject(wsMembership.role, project.visibility, projMember);
    if (!canView) {
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }

    return dependenciesRepo.listDependenciesForTask(taskId);
  },

  removeDependency({ dependencyId, user }) {
    const dep = dependenciesRepo.findDependencyById(dependencyId);
    if (!dep) {
      throw new AppError('NOT_FOUND', 404, 'Dependency not found');
    }

    const wsMembership = workspacesRepo.findMembership(dep.workspaceId, user.id);
    if (!wsMembership) {
      throw new AppError('NOT_FOUND', 404, 'Dependency not found');
    }

    const projMember = projectsRepo.findProjectMember(dep.projectId, user.id);
    const canView = permissions.canViewProject(wsMembership.role, dep.projectVisibility, projMember);
    if (!canView) {
      throw new AppError('NOT_FOUND', 404, 'Dependency not found');
    }

    if (!permissions.canEditTask(wsMembership.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    dependenciesRepo.deleteDependency(dependencyId);
    return { success: true };
  },
};
