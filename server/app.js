import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestId } from './middleware/requestId.js';
import { contextMiddleware } from './lib/context.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { originCheck } from './middleware/originCheck.js';
import { sessionMiddleware } from './middleware/session.js';
import { csrf } from './middleware/csrf.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config as defaultConfig } from './config.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { workspacesRouter, invitationsRouter } from './modules/workspaces/routes.js';
import { projectsRouter } from './modules/projects/routes.js';
import { projectBoardsRouter, boardsRouter, columnsRouter } from './modules/boards/routes.js';
import {
  tasksRouter,
  columnTasksRouter,
  projectLabelsRouter,
  labelsRouter,
  subtasksRouter,
  projectTasksRouter,
} from './modules/tasks/routes.js';
import { taskCommentsRouter, commentsRouter } from './modules/comments/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { workspaceDashboardRouter } from './modules/dashboard/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPublicDir = path.resolve(__dirname, '../public');

export function createApp(appConfig = defaultConfig, publicDir = defaultPublicDir) {
  const app = express();
  app.set('env', appConfig.NODE_ENV);

  // 1. Request ID & Context
  app.use(requestId);
  app.use(contextMiddleware);

  // 2. Security Headers (Helmet + strict CSP)
  app.use(securityHeaders());

  // 3. Body parser with 100kb limit
  app.use(express.json({ limit: '100kb' }));

  // 4. Origin check on state-changing methods
  app.use(originCheck);

  // 5. Static files serving
  app.use(express.static(publicDir));

  // 6. Session loader
  app.use(sessionMiddleware);

  // 7. CSRF validation on mutations
  app.use(csrf);

  // 8. Rate limit on /api
  app.use('/api', apiRateLimit);

  // 9. API Routes
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/workspaces/:wid/dashboard', workspaceDashboardRouter);
  app.use('/api/invitations', invitationsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:pid/boards', projectBoardsRouter);
  app.use('/api/projects/:pid/tasks', projectTasksRouter);
  app.use('/api/boards', boardsRouter);
  app.use('/api/columns', columnsRouter);
  app.use('/api/columns/:cid/tasks', columnTasksRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/projects/:pid/labels', projectLabelsRouter);
  app.use('/api/labels', labelsRouter);
  app.use('/api/subtasks', subtasksRouter);
  app.use('/api/tasks/:taskId/comments', taskCommentsRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/notifications', notificationsRouter);

  // 10. 404 & SPA fallback
  app.use(notFound(publicDir));

  // 11. Error handling
  app.use(errorHandler);

  return app;
}
