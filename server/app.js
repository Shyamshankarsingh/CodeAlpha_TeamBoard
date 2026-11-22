import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestId } from './middleware/requestId.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config as defaultConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPublicDir = path.resolve(__dirname, '../public');

export function createApp(appConfig = defaultConfig, publicDir = defaultPublicDir) {
  const app = express();

  // 1. Request ID
  app.use(requestId);

  // 2. Security Headers (Helmet + strict CSP)
  app.use(securityHeaders());

  // 3. Body parser with 100kb limit
  app.use(express.json({ limit: '100kb' }));

  // 4. Static files serving
  app.use(express.static(publicDir));

  // 5. Core routes
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // 6. 404 & SPA fallback
  app.use(notFound(publicDir));

  // 7. Error handling
  app.use(errorHandler);

  return app;
}
