import rateLimit from 'express-rate-limit';
import { formatErrorEnvelope } from '../lib/errors.js';
import { config } from '../config.js';

function createLimiter({ windowMs, max, message, code = 'RATE_LIMITED' }) {
  return rateLimit({
    windowMs,
    max: (req) => {
      // In test mode, allow high volume unless explicitly testing rate limits
      if (req.app.get('env') === 'test' || process.env.NODE_ENV === 'test') {
        if (req.headers['x-test-rate-limit'] === 'true') {
          return max;
        }
        return 100000;
      }
      return max;
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json(
        formatErrorEnvelope(code, message, [], req.id || null)
      );
    },
  });
}

// 10 attempts per 15 minutes
export const loginRateLimit = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

// 5 attempts per hour for registration, password reset, etc.
export const authRateLimit = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many requests. Please try again later.',
});

// 300 requests per minute general API limit
export const apiRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'API rate limit exceeded. Please slow down.',
});
