import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, formatErrorEnvelope } from '../../server/lib/errors.js';

describe('AppError & Error Envelope', () => {
  test('creates AppError with correct properties', () => {
    const err = new AppError('NOT_FOUND', 404, 'Task not found', [{ path: 'id', message: 'Missing' }]);
    assert.equal(err.code, 'NOT_FOUND');
    assert.equal(err.status, 404);
    assert.equal(err.message, 'Task not found');
    assert.deepEqual(err.details, [{ path: 'id', message: 'Missing' }]);
    assert.equal(err.name, 'AppError');
    assert.ok(err instanceof Error);
  });

  test('formats error envelope matching API specification', () => {
    const envelope = formatErrorEnvelope(
      'VALIDATION_ERROR',
      'Validation failed',
      [{ path: 'title', message: 'Required' }],
      'req-uuid-1234'
    );

    assert.deepEqual(envelope, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ path: 'title', message: 'Required' }],
        requestId: 'req-uuid-1234',
      },
    });
  });
});
