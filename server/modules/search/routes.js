import express from 'express';
import { requireAuth } from '../../middleware/session.js';
import { searchService } from './service.js';

const router = express.Router();

router.get('/workspaces/:workspaceId/search', requireAuth, (req, res, next) => {
  try {
    const results = searchService.search({
      workspaceId: req.params.workspaceId,
      query: req.query.q,
      user: req.user,
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export const searchRouter = router;
