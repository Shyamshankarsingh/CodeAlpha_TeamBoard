import { AppError, formatErrorEnvelope } from '../lib/errors.js';
import { logger } from '../logger.js';

export function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.id || null;

  // Handle JSON syntax parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn('Malformed JSON in request body', { requestId, path: req.path });
    return res.status(400).json(
      formatErrorEnvelope('BAD_REQUEST', 'Malformed JSON in request body', [], requestId)
    );
  }

  // Handle payload too large
  if (err.type === 'entity.too.large' || err.status === 413) {
    logger.warn('Request payload too large', { requestId, path: req.path });
    return res.status(413).json(
      formatErrorEnvelope('PAYLOAD_TOO_LARGE', 'Payload too large, maximum size is 100KB', [], requestId)
    );
  }

  // Handle domain AppError
  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, {
      code: err.code,
      status: err.status,
      requestId,
      path: req.path,
    });
    return res.status(err.status).json(
      formatErrorEnvelope(err.code, err.message, err.details, requestId)
    );
  }

  // Unexpected internal errors
  logger.error(`Internal Error: ${err.message}`, {
    stack: err.stack,
    requestId,
    path: req.path,
  });

  return res.status(500).json(
    formatErrorEnvelope('INTERNAL', 'Internal server error', [], requestId)
  );
}
