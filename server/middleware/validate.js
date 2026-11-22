import { AppError } from '../lib/errors.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
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
