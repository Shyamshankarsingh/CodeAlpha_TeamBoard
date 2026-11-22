import path from 'node:path';
import { formatErrorEnvelope } from '../lib/errors.js';

export function notFound(publicDir) {
  return (req, res, next) => {
    // API routes return 404 error envelope
    if (req.path.startsWith('/api')) {
      return res.status(404).json(
        formatErrorEnvelope('NOT_FOUND', `Route ${req.method} ${req.path} not found`, [], req.id || null)
      );
    }

    // SPA fallback: GET requests for HTML fallback to public/index.html
    if (req.method === 'GET' && req.accepts('html')) {
      return res.sendFile(path.join(publicDir, 'index.html'));
    }

    return res.status(404).json(
      formatErrorEnvelope('NOT_FOUND', `Resource not found`, [], req.id || null)
    );
  };
}
