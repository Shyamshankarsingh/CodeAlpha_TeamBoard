import { Router } from 'express';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import {
  workspaceDashboardParamsSchema,
  myTasksQuerySchema,
  activityQuerySchema,
} from './schema.js';
import { dashboardService } from './service.js';

export const workspaceDashboardRouter = Router({ mergeParams: true });

workspaceDashboardRouter.get(
  '/overview',
  requireAuth,
  validate(workspaceDashboardParamsSchema, 'params'),
  (req, res, next) => {
    try {
      const data = dashboardService.getOverview(req.user.id, req.params.wid);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

workspaceDashboardRouter.get(
  '/my-tasks',
  requireAuth,
  validate(workspaceDashboardParamsSchema, 'params'),
  validate(myTasksQuerySchema, 'query'),
  (req, res, next) => {
    try {
      const data = dashboardService.getMyTasks(req.user.id, req.params.wid, req.query);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

workspaceDashboardRouter.get(
  '/upcoming',
  requireAuth,
  validate(workspaceDashboardParamsSchema, 'params'),
  (req, res, next) => {
    try {
      const data = dashboardService.getUpcoming(req.user.id, req.params.wid);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

workspaceDashboardRouter.get(
  '/activity',
  requireAuth,
  validate(workspaceDashboardParamsSchema, 'params'),
  validate(activityQuerySchema, 'query'),
  (req, res, next) => {
    try {
      const data = dashboardService.getActivity(req.user.id, req.params.wid, req.query);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
);
