import { AppError } from '../lib/errors.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    if (source === 'body' && ['POST', 'PATCH', 'PUT'].includes(req.method)) {
      const contentLength = req.headers['content-length'];
      const transferEncoding = req.headers['transfer-encoding'];
      const hasBody = (contentLength && parseInt(contentLength, 10) > 0) || Boolean(transferEncoding);
      if (hasBody && !req.is('json')) {
        throw new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Content-Type must be application/json');
      }
    }

    const dataToValidate = req[source];
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError('VALIDATION_ERROR', 400, 'Validation failed', details);
    }

    if (source === 'query') {
      req.validatedQuery = result.data;
      Object.assign(req.query, result.data);
    } else {
      req[source] = result.data;
    }
    next();
  };
}
