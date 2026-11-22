import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nowIso, toDateOnly, addDays, isExpired } from '../../server/lib/time.js';

describe('Time Helpers', () => {
  test('nowIso returns a valid ISO-8601 UTC string', () => {
    const iso = nowIso();
    assert.ok(typeof iso === 'string');
    assert.ok(iso.endsWith('Z'), 'Timestamp should end with Z (UTC)');
    const parsed = new Date(iso);
    assert.ok(!isNaN(parsed.getTime()));
  });

  test('toDateOnly formats date as YYYY-MM-DD', () => {
    const d = new Date('2026-11-22T14:30:00.000Z');
    assert.equal(toDateOnly(d), '2026-11-22');
    assert.equal(toDateOnly('2026-12-31T23:59:59.999Z'), '2026-12-31');
  });

  test('addDays calculates correct future date', () => {
    const start = '2026-01-01T00:00:00.000Z';
    const future = addDays(start, 7);
    assert.ok(future.startsWith('2026-01-08'));
  });

  test('isExpired detects expired timestamps', () => {
    const past = '2020-01-01T00:00:00.000Z';
    const future = '2099-01-01T00:00:00.000Z';
    assert.equal(isExpired(past), true);
    assert.equal(isExpired(future), false);
  });
});
