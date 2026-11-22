import { Router } from 'express';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { listNotificationsQuerySchema, notificationIdParamSchema } from './schema.js';
import { notificationsService } from './service.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, validate(listNotificationsQuerySchema, 'query'), (req, res, next) => {
  try {
    const feed = notificationsService.getUserNotifications(req.user.id, req.query);
    res.status(200).json({ data: feed });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.get('/unread-count', requireAuth, (req, res, next) => {
  try {
    const data = notificationsService.getUnreadCount(req.user.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/:id/read', requireAuth, validate(notificationIdParamSchema, 'params'), (req, res, next) => {
  try {
    const result = notificationsService.markNotificationRead(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/read-all', requireAuth, (req, res, next) => {
  try {
    const result = notificationsService.markAllNotificationsRead(req.user.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.delete('/:id', requireAuth, validate(notificationIdParamSchema, 'params'), (req, res, next) => {
  try {
    const result = notificationsService.deleteNotification(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Helper endpoint for scheduled/background jobs or testing
notificationsRouter.post('/check-reminders', requireAuth, (req, res, next) => {
  try {
    const dueSoon = notificationsService.checkDueSoonTasks();
    const overdue = notificationsService.checkOverdueTasks();
    res.status(200).json({ data: { dueSoonCount: dueSoon.length, overdueCount: overdue.length } });
  } catch (err) {
    next(err);
  }
});
