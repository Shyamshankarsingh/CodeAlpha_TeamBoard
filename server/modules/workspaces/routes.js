import { Router } from 'express';
import { workspacesService } from './service.js';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  deleteWorkspaceSchema,
  transferOwnershipSchema,
  inviteMemberSchema,
  changeRoleSchema,
  acceptInviteSchema,
  listMembersSchema,
} from './schema.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/session.js';
import { authRateLimit } from '../../middleware/rateLimit.js';

export const workspacesRouter = Router();
export const invitationsRouter = Router();

// --- Workspaces Endpoints (/api/workspaces) ---

workspacesRouter.get('/', requireAuth, (req, res, next) => {
  try {
    const workspaces = workspacesService.listUserWorkspaces(req.user.id);
    res.status(200).json({ data: workspaces });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.post('/', requireAuth, validate(createWorkspaceSchema), (req, res, next) => {
  try {
    const workspace = workspacesService.createWorkspace(req.user.id, req.body.name);
    res.status(201).json({ data: workspace });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.get('/:id', requireAuth, (req, res, next) => {
  try {
    const result = workspacesService.getWorkspace(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.patch('/:id', requireAuth, validate(updateWorkspaceSchema), (req, res, next) => {
  try {
    const workspace = workspacesService.updateWorkspace(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: workspace });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.delete('/:id', requireAuth, validate(deleteWorkspaceSchema), (req, res, next) => {
  try {
    workspacesService.deleteWorkspace(req.user.id, req.params.id, req.body.confirmName);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

workspacesRouter.post('/:id/transfer-ownership', requireAuth, validate(transferOwnershipSchema), (req, res, next) => {
  try {
    workspacesService.transferOwnership(req.user.id, req.params.id, req.body.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

workspacesRouter.get('/:id/members', requireAuth, validate(listMembersSchema, 'query'), (req, res, next) => {
  try {
    const { page, pageSize, q } = req.query;
    const result = workspacesService.listMembers(req.user.id, req.params.id, { page, pageSize, q });
    res.status(200).json({ data: result.members, meta: result.meta });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.patch('/:id/members/:userId', requireAuth, validate(changeRoleSchema), (req, res, next) => {
  try {
    const result = workspacesService.changeMemberRole(req.user.id, req.params.id, req.params.userId, req.body.role);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.delete('/:id/members/:userId', requireAuth, (req, res, next) => {
  try {
    workspacesService.removeMember(req.user.id, req.params.id, req.params.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

workspacesRouter.get('/:id/invitations', requireAuth, (req, res, next) => {
  try {
    const invitations = workspacesService.listInvitations(req.user.id, req.params.id);
    res.status(200).json({ data: invitations });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.post('/:id/invitations', requireAuth, authRateLimit, validate(inviteMemberSchema), async (req, res, next) => {
  try {
    const invitation = await workspacesService.createInvitation(req.user.id, req.params.id, req.body);
    res.status(201).json({ data: invitation });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.delete('/:id/invitations/:invId', requireAuth, (req, res, next) => {
  try {
    workspacesService.revokeInvitation(req.user.id, req.params.id, req.params.invId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- Public / Member Invitations Endpoints (/api/invitations) ---

invitationsRouter.post('/preview', authRateLimit, (req, res, next) => {
  try {
    const token = req.body.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Token required' } });
    }
    const preview = workspacesService.previewInvitation(token);
    res.status(200).json({ data: preview });
  } catch (err) {
    next(err);
  }
});

invitationsRouter.post('/accept', requireAuth, validate(acceptInviteSchema), (req, res, next) => {
  try {
    const result = workspacesService.acceptInvitation(req.user.id, req.user.email, req.body.token);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

invitationsRouter.get('/mine', requireAuth, (req, res, next) => {
  try {
    const invitations = workspacesService.getMyInvitations(req.user.email);
    res.status(200).json({ data: invitations });
  } catch (err) {
    next(err);
  }
});
