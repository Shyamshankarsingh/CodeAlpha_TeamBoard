import { getDb } from '../../db/index.js';

export const authRepo = {
  findUserByEmail(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  },

  findUserById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  createUser({ id, email, passwordHash, name, timezone = 'UTC', theme = 'system' }) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, timezone, theme, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, email, passwordHash, name, timezone, theme, now, now);
    return this.findUserById(id);
  },

  updatePasswordHash(userId, passwordHash) {
    const db = getDb();
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(passwordHash, userId);
  },

  recordFailedLogin(userId, count, lockedUntil = null) {
    const db = getDb();
    db.prepare(`
      UPDATE users 
      SET failed_login_count = ?, locked_until = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(count, lockedUntil, userId);
  },

  resetFailedLogin(userId) {
    const db = getDb();
    db.prepare(`
      UPDATE users 
      SET failed_login_count = 0, locked_until = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(userId);
  },

  setEmailVerified(userId) {
    const db = getDb();
    db.prepare(`
      UPDATE users 
      SET email_verified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(userId);
  },

  // Sessions
  createSession({ id, userId, csrfToken, expiresAt, ip = null, userAgent = null }) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO sessions (id, user_id, csrf_token, created_at, last_seen_at, expires_at, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, csrfToken, now, now, expiresAt, ip, userAgent ? userAgent.substring(0, 255) : null);
  },

  findSessionById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  },

  deleteSession(id) {
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  },

  deleteOtherSessions(userId, currentSessionId) {
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(userId, currentSessionId);
  },

  deleteAllSessions(userId) {
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  },

  listUserSessions(userId) {
    const db = getDb();
    return db.prepare(`
      SELECT id, created_at, last_seen_at, expires_at, ip, user_agent
      FROM sessions
      WHERE user_id = ?
      ORDER BY last_seen_at DESC
    `).all(userId);
  },

  // Auth tokens
  createAuthToken({ id, userId, type, tokenHash, expiresAt }) {
    const db = getDb();
    db.prepare(`
      INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, type, tokenHash, expiresAt);
  },

  findActiveAuthToken(tokenHash, type) {
    const db = getDb();
    const now = new Date().toISOString();
    return db.prepare(`
      SELECT * FROM auth_tokens
      WHERE token_hash = ? AND type = ? AND used_at IS NULL AND expires_at > ?
    `).get(tokenHash, type, now);
  },

  markAuthTokenUsed(id) {
    const db = getDb();
    db.prepare(`
      UPDATE auth_tokens
      SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).run(id);
  },
};
