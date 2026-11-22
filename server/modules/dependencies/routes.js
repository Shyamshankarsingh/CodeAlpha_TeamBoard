import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/session.js';
import { validate } from '../../middleware/validate.js';
import { dependenciesService } from './service.js';

const router = express.Router();

const addDependencySchema = z.object({
  dependsOnTaskId: z.string().uuid(),
});

router.get('/tasks/:taskId/dependencies', requireAuth, (req, res, next) => {
  try {
    const dependencies = dependenciesService.listDependencies({
      taskId: req.params.taskId,
      user: req.user,
    });
    res.json(dependencies);
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:taskId/dependencies', requireAuth, validate(addDependencySchema), (req, res, next) => {
  try {
    const dependency = dependenciesService.addDependency({
      taskId: req.params.taskId,
      dependsOnTaskId: req.body.dependsOnTaskId,
      user: req.user,
    });
    res.status(201).json({ dependency });
  } catch (err) {
    next(err);
  }
});

router.delete('/dependencies/:id', requireAuth, (req, res, next) => {
  try {
    dependenciesService.removeDependency({
      dependencyId: req.params.id,
      user: req.user,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export const dependenciesRouter = router;
