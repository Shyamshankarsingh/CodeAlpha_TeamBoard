import express from 'express';
import { requireAuth } from '../../middleware/session.js';
import { exportService } from './service.js';

const router = express.Router();

router.get('/projects/:projectId/export', requireAuth, (req, res, next) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const { contentType, fileName, data } = exportService.exportProjectData({
      projectId: req.params.projectId,
      format,
      user: req.user,
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(data);
  } catch (err) {
    next(err);
  }
});

export const exportRouter = router;
