import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, needsRehash, dummyVerify } from '../../server/lib/passwords.js';

describe('Password Hashing & Verification (Argon2id)', () => {
  test('hashes password to a valid Argon2id PHC string', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hashPassword(password);

    assert.equal(typeof hash, 'string');
    assert.ok(hash.startsWith('$argon2id$'), 'Hash should be an argon2id hash');
  });

  test('verifies correct password against hash', async () => {
    const password = 'CorrectPassword99#';
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(hash, password);
    assert.equal(isMatch, true);
  });

  test('rejects incorrect password against hash', async () => {
    const password = 'CorrectPassword99#';
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(hash, 'WrongPassword123!');
    assert.equal(isMatch, false);
  });

  test('needsRehash returns false for fresh hash with current options', async () => {
    const hash = await hashPassword('FreshPassword123!');
    assert.equal(needsRehash(hash), false);
  });

  test('dummyVerify executes without throwing', async () => {
    await dummyVerify();
    assert.ok(true);
  });
});
