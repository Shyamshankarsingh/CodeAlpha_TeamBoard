import { Router } from 'express';
import { tasksService } from './service.js';
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  archiveTaskSchema,
  updateAssigneesSchema,
  updateLabelsSchema,
  createLabelSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  moveSubtaskSchema,
  listProjectTasksQuerySchema,
  bulkTaskActionSchema,
} from './schema.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/session.js';

export const projectTasksRouter = Router({ mergeParams: true });
export const columnTasksRouter = Router({ mergeParams: true });
export const tasksRouter = Router();
export const projectLabelsRouter = Router({ mergeParams: true });
export const labelsRouter = Router();
export const subtasksRouter = Router();

// Project-scoped tasks (/api/projects/:pid/tasks)
projectTasksRouter.post('/bulk', requireAuth, validate(bulkTaskActionSchema), (req, res, next) => {
  try {
    const result = tasksService.bulkAction(req.user.id, req.params.pid, req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

projectTasksRouter.get('/', requireAuth, validate(listProjectTasksQuerySchema, 'query'), (req, res, next) => {
  try {
    const result = tasksService.listProjectTasks(req.user.id, req.params.pid, req.query);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Column-scoped tasks (/api/columns/:cid/tasks)
columnTasksRouter.post('/', requireAuth, validate(createTaskSchema), (req, res, next) => {
  try {
    const task = tasksService.createTask(req.user.id, req.params.cid, req.body);
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
});

// Tasks Endpoints (/api/tasks)
tasksRouter.get('/:id', requireAuth, (req, res, next) => {
  try {
    const task = tasksService.getTask(req.user.id, req.params.id);
    res.status(200).json({ data: task });
  } catch (err) {
    next(err);
  }
});

tasksRouter.patch('/:id', requireAuth, validate(updateTaskSchema), (req, res, next) => {
  try {
    const task = tasksService.updateTask(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: task });
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/:id/move', requireAuth, validate(moveTaskSchema), (req, res, next) => {
  try {
    const task = tasksService.moveTask(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: task });
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/:id/duplicate', requireAuth, (req, res, next) => {
  try {
    const task = tasksService.duplicateTask(req.user.id, req.params.id);
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/:id/archive', requireAuth, validate(archiveTaskSchema), (req, res, next) => {
  try {
    const task = tasksService.archiveTask(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: task });
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/:id/unarchive', requireAuth, validate(archiveTaskSchema), (req, res, next) => {
  try {
    const task = tasksService.unarchiveTask(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: task });
  } catch (err) {
    next(err);
  }
});

tasksRouter.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const result = tasksService.deleteTask(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

tasksRouter.put('/:id/assignees', requireAuth, validate(updateAssigneesSchema), (req, res, next) => {
  try {
    const assignees = tasksService.updateAssignees(req.user.id, req.params.id, req.body.userIds);
    res.status(200).json({ data: assignees });
  } catch (err) {
    next(err);
  }
});

tasksRouter.put('/:id/labels', requireAuth, validate(updateLabelsSchema), (req, res, next) => {
  try {
    const labels = tasksService.updateLabels(req.user.id, req.params.id, req.body.labelIds);
    res.status(200).json({ data: labels });
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/:id/watchers', requireAuth, (req, res, next) => {
  try {
    const result = tasksService.watchTask(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

tasksRouter.delete('/:id/watchers', requireAuth, (req, res, next) => {
  try {
    const result = tasksService.unwatchTask(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/:id/subtasks', requireAuth, validate(createSubtaskSchema), (req, res, next) => {
  try {
    const subtask = tasksService.createSubtask(req.user.id, req.params.id, req.body);
    res.status(201).json({ data: subtask });
  } catch (err) {
    next(err);
  }
});

// Project Labels (/api/projects/:pid/labels)
projectLabelsRouter.get('/', requireAuth, (req, res, next) => {
  try {
    const labels = tasksService.listProjectLabels(req.user.id, req.params.pid);
    res.status(200).json({ data: labels });
  } catch (err) {
    next(err);
  }
});

projectLabelsRouter.post('/', requireAuth, validate(createLabelSchema), (req, res, next) => {
  try {
    const label = tasksService.createLabel(req.user.id, req.params.pid, req.body);
    res.status(201).json({ data: label });
  } catch (err) {
    next(err);
  }
});

// Labels (/api/labels)
labelsRouter.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const result = tasksService.deleteLabel(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Subtasks (/api/subtasks)
subtasksRouter.patch('/:id', requireAuth, validate(updateSubtaskSchema), (req, res, next) => {
  try {
    const subtask = tasksService.updateSubtask(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: subtask });
  } catch (err) {
    next(err);
  }
});

subtasksRouter.post('/:id/move', requireAuth, validate(moveSubtaskSchema), (req, res, next) => {
  try {
    const subtask = tasksService.moveSubtask(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: subtask });
  } catch (err) {
    next(err);
  }
});

subtasksRouter.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const result = tasksService.deleteSubtask(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});
