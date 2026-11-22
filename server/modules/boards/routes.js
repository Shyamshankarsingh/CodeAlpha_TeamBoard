import { Router } from 'express';
import { boardsService } from './service.js';
import {
  createBoardSchema,
  updateBoardSchema,
  createColumnSchema,
  updateColumnSchema,
  moveColumnSchema,
  deleteColumnSchema,
} from './schema.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/session.js';

export const projectBoardsRouter = Router({ mergeParams: true });
export const boardsRouter = Router();
export const columnsRouter = Router();

// --- Project-Scoped Boards (/api/projects/:pid/boards) ---
projectBoardsRouter.get('/', requireAuth, (req, res, next) => {
  try {
    const boards = boardsService.listProjectBoards(req.user.id, req.params.pid);
    res.status(200).json({ data: boards });
  } catch (err) {
    next(err);
  }
});

projectBoardsRouter.post('/', requireAuth, validate(createBoardSchema), (req, res, next) => {
  try {
    const board = boardsService.createBoard(req.user.id, req.params.pid, req.body);
    res.status(201).json({ data: board });
  } catch (err) {
    next(err);
  }
});

// --- Boards Endpoints (/api/boards) ---
boardsRouter.get('/:id', requireAuth, (req, res, next) => {
  try {
    const board = boardsService.getBoard(req.user.id, req.params.id);
    res.status(200).json({ data: board });
  } catch (err) {
    next(err);
  }
});

boardsRouter.patch('/:id', requireAuth, validate(updateBoardSchema), (req, res, next) => {
  try {
    const board = boardsService.updateBoard(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: board });
  } catch (err) {
    next(err);
  }
});

boardsRouter.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const result = boardsService.deleteBoard(req.user.id, req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});

boardsRouter.post('/:id/columns', requireAuth, validate(createColumnSchema), (req, res, next) => {
  try {
    const column = boardsService.createColumn(req.user.id, req.params.id, req.body);
    res.status(201).json({ data: column });
  } catch (err) {
    next(err);
  }
});

// --- Columns Endpoints (/api/columns) ---
columnsRouter.patch('/:id', requireAuth, validate(updateColumnSchema), (req, res, next) => {
  try {
    const column = boardsService.updateColumn(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: column });
  } catch (err) {
    next(err);
  }
});

columnsRouter.post('/:id/move', requireAuth, validate(moveColumnSchema), (req, res, next) => {
  try {
    const column = boardsService.moveColumn(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: column });
  } catch (err) {
    next(err);
  }
});

columnsRouter.delete('/:id', requireAuth, validate(deleteColumnSchema), (req, res, next) => {
  try {
    const result = boardsService.deleteColumn(req.user.id, req.params.id, req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
});
