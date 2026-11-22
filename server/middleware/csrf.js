import { timingSafeEqual } from '../lib/tokens.js';
import { AppError } from '../lib/errors.js';

export function csrf(req, res, next) {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isMutation) {
    return next();
  }

  // CSRF token is required for authenticated sessions
  if (req.session) {
    const clientToken = req.headers['x-csrf-token'];
    if (!clientToken || typeof clientToken !== 'string') {
      throw new AppError('CSRF_INVALID', 403, 'Missing X-CSRF-Token header');
    }

    if (!timingSafeEqual(clientToken, req.session.csrfToken)) {
      throw new AppError('CSRF_INVALID', 403, 'Invalid CSRF token');
    }
  }

  next();
}
