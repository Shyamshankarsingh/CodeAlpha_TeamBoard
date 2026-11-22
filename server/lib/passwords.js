import argon2 from 'argon2';

// OWASP Recommended Argon2id parameters
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

// Pre-computed dummy hash to mitigate timing attacks on unknown emails
let dummyHash = null;

export async function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
}

export function needsRehash(hash) {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}

export async function dummyVerify() {
  if (!dummyHash) {
    dummyHash = await hashPassword('dummy-password-for-timing-mitigation');
  }
  await verifyPassword(dummyHash, 'wrong-password');
}
