import { AppError } from '../lib/errors.js';
import { config } from '../config.js';

export function originCheck(req, res, next) {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isMutation) {
    return next();
  }

  const origin = req.headers.origin;

  // If Origin header is provided, it must match APP_ORIGIN
  if (origin) {
    // In test environment, allow matching port/host or localhost
    const allowed = new URL(config.APP_ORIGIN);
    let requestOrigin;
    try {
      requestOrigin = new URL(origin);
    } catch {
      throw new AppError('ORIGIN_NOT_ALLOWED', 403, 'Invalid Origin header');
    }

    if (config.NODE_ENV !== 'test') {
      if (requestOrigin.origin !== allowed.origin) {
        throw new AppError('ORIGIN_NOT_ALLOWED', 403, 'Cross-origin request blocked');
      }
    } else {
      // Test environment flexibility for ephemeral ports
      if (
        requestOrigin.hostname !== allowed.hostname &&
        requestOrigin.hostname !== '127.0.0.1' &&
        requestOrigin.hostname !== 'localhost'
      ) {
        throw new AppError('ORIGIN_NOT_ALLOWED', 403, 'Cross-origin request blocked');
      }
    }
  }

  next();
}
