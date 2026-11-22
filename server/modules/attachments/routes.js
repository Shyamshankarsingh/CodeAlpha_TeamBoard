import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { requireAuth } from '../../middleware/session.js';
import { attachmentsService } from './service.js';
import { generateId } from '../../lib/ids.js';

const router = express.Router();
const UPLOAD_DIR = path.resolve('uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate safe random stored name
    cb(null, `${generateId()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// List attachments for task
router.get('/tasks/:taskId/attachments', requireAuth, (req, res, next) => {
  try {
    const attachments = attachmentsService.listAttachments({
      taskId: req.params.taskId,
      user: req.user,
    });
    res.json({ attachments });
  } catch (err) {
    next(err);
  }
});

// Upload attachment
router.post('/tasks/:taskId/attachments', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const attachment = await attachmentsService.uploadAttachment({
      taskId: req.params.taskId,
      user: req.user,
      file: req.file,
    });
    res.status(201).json({ attachment });
  } catch (err) {
    next(err);
  }
});

// Download attachment
router.get('/attachments/:id/download', requireAuth, (req, res, next) => {
  try {
    const { attachment, fullPath } = attachmentsService.getAttachmentForDownload({
      attachmentId: req.params.id,
      user: req.user,
    });

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(fullPath);
  } catch (err) {
    next(err);
  }
});

// Delete attachment
router.delete('/attachments/:id', requireAuth, (req, res, next) => {
  try {
    attachmentsService.deleteAttachment({
      attachmentId: req.params.id,
      user: req.user,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export const attachmentsRouter = router;
