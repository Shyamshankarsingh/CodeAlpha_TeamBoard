/**
 * Server-computed fractional string ordering (ADR-005).
 * Base-62 character set ordered: 0-9, A-Z, a-z.
 * Lexicographical string comparison matches ASCII order.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length; // 62
const MIDPOINT_CHAR = DIGITS[Math.floor(BASE / 2)]; // 'V' (index 31)

const CHAR_TO_INDEX = new Map();
for (let i = 0; i < DIGITS.length; i++) {
  CHAR_TO_INDEX.set(DIGITS[i], i);
}

function getIndex(char) {
  const idx = CHAR_TO_INDEX.get(char);
  return idx !== undefined ? idx : -1;
}

/**
 * Generate a position key strictly between `prev` and `next`.
 * If `prev` is null/empty, returns a key strictly before `next`.
 * If `next` is null/empty, returns a key strictly after `prev`.
 * If both are null/empty, returns the default midpoint key.
 */
export function between(prev = null, next = null) {
  const p = prev || '';
  const n = next || '';

  if (!p && !n) {
    return MIDPOINT_CHAR;
  }

  if (!p && n) {
    // Generate key strictly before n
    for (let i = 0; i < n.length; i++) {
      const nIdx = getIndex(n[i]);
      if (nIdx > 0) {
        // We can pick a character between 0 and nIdx
        const mid = Math.floor(nIdx / 2);
        return n.slice(0, i) + DIGITS[mid];
      }
    }
    // If all characters of n are '0', prepend '0' followed by midpoint
    return '0' + MIDPOINT_CHAR;
  }

  if (p && !n) {
    // Generate key strictly after p
    for (let i = 0; i < p.length; i++) {
      const pIdx = getIndex(p[i]);
      if (pIdx < BASE - 1) {
        // Pick character between pIdx and BASE
        const mid = Math.floor((pIdx + BASE) / 2);
        return p.slice(0, i) + DIGITS[mid];
      }
    }
    // All characters are max 'z', append midpoint
    return p + MIDPOINT_CHAR;
  }

  // Both prev and next are provided. Ensure prev < next
  if (p >= n) {
    throw new Error(`Invalid bounds: prev ("${p}") must be less than next ("${n}")`);
  }

  // Find common prefix
  let commonLen = 0;
  while (commonLen < p.length && commonLen < n.length && p[commonLen] === n[commonLen]) {
    commonLen++;
  }

  const prefix = p.slice(0, commonLen);
  const pChar = p[commonLen];
  const nChar = n[commonLen];

  const pIdx = pChar !== undefined ? getIndex(pChar) : 0;
  const nIdx = nChar !== undefined ? getIndex(nChar) : BASE;

  if (nIdx - pIdx > 1) {
    const mid = Math.floor((pIdx + nIdx) / 2);
    return prefix + DIGITS[mid];
  }

  // Difference is 1 (or pChar is prefix of n)
  // Append a character greater than remaining p suffix
  return prefix + p[commonLen] + between(p.slice(commonLen + 1), null);
}

/**
 * Generate N evenly spaced initial position keys.
 */
export function generateInitialPositions(count) {
  if (count <= 0) return [];
  if (count === 1) return [MIDPOINT_CHAR];

  const step = Math.floor(BASE / (count + 1));
  const positions = [];
  for (let i = 1; i <= count; i++) {
    const idx = Math.min(i * step, BASE - 1);
    positions.push(DIGITS[idx]);
  }
  return positions;
}

/**
 * Check if keys require rebalancing (ADR-005: threshold 48 chars).
 */
export function needsRebalance(positions, threshold = 48) {
  return positions.some((pos) => pos.length > threshold);
}

/**
 * Rebalance an array of entities by assigning fresh evenly spaced position keys.
 */
export function rebalance(count) {
  return generateInitialPositions(count);
}
