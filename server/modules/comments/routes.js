import { Router } from 'express';
import { commentsService } from './service.js';
import { createCommentSchema, updateCommentSchema } from './schema.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/session.js';

export const taskCommentsRouter = Router({ mergeParams: true });
export const commentsRouter = Router();

// Task-scoped comments (/api/tasks/:taskId/comments)
taskCommentsRouter.get('/', requireAuth, (req, res, next) => {
  try {
    const comments = commentsService.listComments(req.user.id, req.params.taskId);
    res.status(200).json({ data: comments });
  } catch (err) {
    next(err);
  }
});

taskCommentsRouter.post('/', requireAuth, validate(createCommentSchema), (req, res, next) => {
  try {
    const comment = commentsService.createComment(req.user.id, req.params.taskId, req.body);
    res.status(201).json({ data: comment });
  } catch (err) {
    next(err);
  }
});

// Comments Endpoints (/api/comments)
commentsRouter.patch('/:id', requireAuth, validate(updateCommentSchema), (req, res, next) => {
  try {
    const comment = commentsService.updateComment(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: comment });
  } catch (err) {
    next(err);
  }
});

commentsRouter.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const result = commentsService.deleteComment(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});
