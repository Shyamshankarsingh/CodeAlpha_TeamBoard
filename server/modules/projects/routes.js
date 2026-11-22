import { Router } from 'express';
import { projectsService } from './service.js';
import {
  createProjectSchema,
  updateProjectSchema,
  archiveProjectSchema,
  deleteProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberSchema,
  listProjectsQuerySchema,
  activityQuerySchema,
} from './schema.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/session.js';

export const projectsRouter = Router();
export const workspaceProjectsRouter = Router({ mergeParams: true });

// --- Workspace-scoped Project & Activity Routes ---
workspaceProjectsRouter.get('/', requireAuth, validate(listProjectsQuerySchema, 'query'), (req, res, next) => {
  try {
    const projects = projectsService.listWorkspaceProjects(req.user.id, req.params.wid, req.query);
    res.status(200).json({ data: projects });
  } catch (err) {
    next(err);
  }
});

workspaceProjectsRouter.post('/', requireAuth, validate(createProjectSchema), (req, res, next) => {
  try {
    const project = projectsService.createProject(req.user.id, req.params.wid, req.body);
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
});

// --- Project Routes (/api/projects) ---
projectsRouter.get('/:id', requireAuth, (req, res, next) => {
  try {
    const project = projectsService.getProject(req.user.id, req.params.id);
    res.status(200).json({ data: project });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch('/:id', requireAuth, validate(updateProjectSchema), (req, res, next) => {
  try {
    const project = projectsService.updateProject(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: project });
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:id', requireAuth, validate(deleteProjectSchema), (req, res, next) => {
  try {
    const result = projectsService.deleteProject(req.user.id, req.params.id, req.body.confirmName);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:id/archive', requireAuth, validate(archiveProjectSchema), (req, res, next) => {
  try {
    const project = projectsService.archiveProject(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: project });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:id/unarchive', requireAuth, validate(archiveProjectSchema), (req, res, next) => {
  try {
    const project = projectsService.unarchiveProject(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: project });
  } catch (err) {
    next(err);
  }
});

// Members
projectsRouter.get('/:id/members', requireAuth, (req, res, next) => {
  try {
    const members = projectsService.listMembers(req.user.id, req.params.id);
    res.status(200).json({ data: members });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:id/members', requireAuth, validate(addProjectMemberSchema), (req, res, next) => {
  try {
    const member = projectsService.addMember(req.user.id, req.params.id, req.body);
    res.status(201).json({ data: member });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch('/:id/members/:userId', requireAuth, validate(updateProjectMemberSchema), (req, res, next) => {
  try {
    const member = projectsService.updateMemberRole(req.user.id, req.params.id, req.params.userId, req.body.role);
    res.status(200).json({ data: member });
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:id/members/:userId', requireAuth, (req, res, next) => {
  try {
    const result = projectsService.removeMember(req.user.id, req.params.id, req.params.userId);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Activity
projectsRouter.get('/:id/activity', requireAuth, validate(activityQuerySchema, 'query'), (req, res, next) => {
  try {
    const activity = projectsService.listProjectActivity(req.user.id, req.params.id, req.query);
    res.status(200).json({ data: activity.items, meta: { nextCursor: activity.nextCursor } });
  } catch (err) {
    next(err);
  }
});
