import { Router } from 'express';
import { usersService } from './service.js';
import { updateMeSchema, searchUsersSchema } from './schema.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/session.js';

export const usersRouter = Router();

usersRouter.patch('/me', requireAuth, validate(updateMeSchema), (req, res, next) => {
  try {
    const user = usersService.updateMe(req.user.id, req.body);
    res.status(200).json({ data: { user } });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/search', requireAuth, validate(searchUsersSchema, 'query'), (req, res, next) => {
  try {
    const { q, limit } = req.query;
    const users = usersService.searchUsers(q, limit);
    res.status(200).json({ data: users });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/:id', requireAuth, (req, res, next) => {
  try {
    const user = usersService.getUser(req.params.id);
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
});
