import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateId, isValidId } from '../../server/lib/ids.js';

describe('ID Helpers', () => {
  test('generates a valid UUID v4', () => {
    const id = generateId();
    assert.equal(typeof id, 'string');
    assert.ok(isValidId(id), `ID "${id}" should be a valid UUID v4`);
  });

  test('generates unique IDs across successive calls', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId());
    }
    assert.equal(ids.size, 1000);
  });

  test('isValidId rejects malformed IDs', () => {
    assert.equal(isValidId(null), false);
    assert.equal(isValidId(undefined), false);
    assert.equal(isValidId(''), false);
    assert.equal(isValidId('12345'), false);
    assert.equal(isValidId('not-a-uuid'), false);
    // Invalid UUID version
    assert.equal(isValidId('00000000-0000-1000-8000-000000000000'), false);
  });
});
