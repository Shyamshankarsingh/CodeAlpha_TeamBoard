import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  between,
  generateInitialPositions,
  needsRebalance,
  rebalance,
} from '../../server/lib/position.js';

describe('Fractional Positioning Math Unit Tests (ADR-005)', () => {
  test('between(null, null) returns valid midpoint', () => {
    const pos = between(null, null);
    assert.equal(typeof pos, 'string');
    assert.ok(pos.length > 0);
  });

  test('between(null, next) returns key strictly smaller than next', () => {
    const next = 'V';
    const before = between(null, next);
    assert.ok(before < next, `Expected "${before}" < "${next}"`);
  });

  test('between(prev, null) returns key strictly greater than prev', () => {
    const prev = 'V';
    const after = between(prev, null);
    assert.ok(prev < after, `Expected "${prev}" < "${after}"`);
  });

  test('between(prev, next) returns key strictly between prev and next', () => {
    const prev = 'A';
    const next = 'Z';
    const mid = between(prev, next);
    assert.ok(prev < mid, `Expected "${prev}" < "${mid}"`);
    assert.ok(mid < next, `Expected "${mid}" < "${next}"`);
  });

  test('generates strictly ordered sequence under repeated mid-insertions', () => {
    let prev = 'A';
    let next = 'B';
    const inserted = [];

    for (let i = 0; i < 20; i++) {
      const mid = between(prev, next);
      assert.ok(prev < mid, `Iteration ${i}: Expected "${prev}" < "${mid}"`);
      assert.ok(mid < next, `Iteration ${i}: Expected "${mid}" < "${next}"`);
      inserted.push(mid);
      // Next iteration inserts between new key and upper bound
      prev = mid;
    }

    // Verify entire sequence is strictly monotonic
    for (let i = 0; i < inserted.length - 1; i++) {
      assert.ok(inserted[i] < inserted[i + 1]);
    }
  });

  test('generateInitialPositions produces N strictly increasing keys', () => {
    const count = 5;
    const positions = generateInitialPositions(count);
    assert.equal(positions.length, count);

    for (let i = 0; i < positions.length - 1; i++) {
      assert.ok(positions[i] < positions[i + 1], `Expected "${positions[i]}" < "${positions[i + 1]}"`);
    }
  });

  test('needsRebalance detects positions exceeding threshold', () => {
    const normal = ['a', 'b', 'c'];
    assert.equal(needsRebalance(normal, 48), false);

    const longKey = 'a'.repeat(50);
    assert.equal(needsRebalance(['a', longKey], 48), true);
  });

  test('rebalance returns evenly spaced fresh keys', () => {
    const fresh = rebalance(5);
    assert.equal(fresh.length, 5);
    for (let i = 0; i < fresh.length - 1; i++) {
      assert.ok(fresh[i] < fresh[i + 1]);
    }
  });
});
