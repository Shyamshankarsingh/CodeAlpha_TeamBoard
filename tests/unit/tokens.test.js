import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, hashToken, timingSafeEqual } from '../../server/lib/tokens.js';

describe('Token Generation & Safe Comparison', () => {
  test('generateToken produces base64url string with expected length', () => {
    const token = generateToken(32);
    assert.equal(typeof token, 'string');
    assert.ok(token.length >= 40);
    // Base64url characters only
    assert.ok(/^[A-Za-z0-9_-]+$/.test(token));
  });

  test('hashToken produces 64-character SHA-256 hex digest', () => {
    const token = 'sample-token-string';
    const hash = hashToken(token);
    assert.equal(hash.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(hash));
  });

  test('timingSafeEqual correctly matches and rejects strings', () => {
    assert.equal(timingSafeEqual('exact-match-token', 'exact-match-token'), true);
    assert.equal(timingSafeEqual('exact-match-token', 'different-token'), false);
    assert.equal(timingSafeEqual('short', 'much-longer-string'), false);
    assert.equal(timingSafeEqual(null, 'string'), false);
    assert.equal(timingSafeEqual('string', undefined), false);
  });
});
