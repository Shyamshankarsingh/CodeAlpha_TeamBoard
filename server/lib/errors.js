export class AppError extends Error {
  constructor(code, status, message, details = []) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function formatErrorEnvelope(code, message, details = [], requestId = null) {
  return {
    error: {
      code,
      message,
      details,
      requestId,
    },
  };
}
