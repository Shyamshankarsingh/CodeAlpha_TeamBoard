import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createDatabase } from '../../server/db/index.js';
import { runMigrations } from '../../server/db/migrate.js';
import { generateId } from '../../server/lib/ids.js';

describe('Database Migrations & Schema (001_identity)', () => {
  let tempDir;
  let dbPath;
  let db;

  afterEach(() => {
    if (db) {
      try {
        db.close();
      } catch (e) {}
    }
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  test('migrations apply to an empty database file and activate WAL mode', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-mig-'));
    dbPath = path.join(tempDir, 'teamboard.db');

    db = createDatabase(dbPath);
    const applied = runMigrations(db);

    assert.equal(applied.length, 1);
    assert.equal(applied[0].name, '001_identity.sql');

    // Verify WAL mode
    const journalMode = db.pragma('journal_mode', { simple: true });
    assert.equal(journalMode.toLowerCase(), 'wal');

    // Verify foreign keys are on
    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    assert.equal(foreignKeys, 1);

    // Verify schema_migrations has the record
    const rows = db.prepare('SELECT * FROM schema_migrations WHERE version = 1').all();
    assert.equal(rows.length, 1);
  });

  test('second migration run is a no-op', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-mig-'));
    dbPath = path.join(tempDir, 'teamboard.db');

    db = createDatabase(dbPath);
    const firstRun = runMigrations(db);
    assert.equal(firstRun.length, 1);

    const secondRun = runMigrations(db);
    assert.equal(secondRun.length, 0);
  });

  test('foreign key constraints cascade on user deletion', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-mig-'));
    dbPath = path.join(tempDir, 'teamboard.db');
    db = createDatabase(dbPath);
    runMigrations(db);

    const userId = generateId();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name)
      VALUES (?, ?, ?, ?)
    `).run(userId, 'user@example.com', 'hashed_pw', 'Alice');

    const sessionId = generateId();
    db.prepare(`
      INSERT INTO sessions (id, user_id, csrf_token, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now', '+7 days'))
    `).run(sessionId, userId, 'csrf-123');

    const tokenId = generateId();
    db.prepare(`
      INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at)
      VALUES (?, ?, 'email_verify', 'hash-123', datetime('now', '+1 day'))
    `).run(tokenId, userId);

    // Verify records exist
    assert.equal(db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get(userId).count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) as count FROM auth_tokens WHERE user_id = ?').get(userId).count, 1);

    // Delete user and verify cascade
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    assert.equal(db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get(userId).count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) as count FROM auth_tokens WHERE user_id = ?').get(userId).count, 0);
  });

  test('CHECK constraints reject invalid user rows', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-mig-'));
    dbPath = path.join(tempDir, 'teamboard.db');
    db = createDatabase(dbPath);
    runMigrations(db);

    // Name empty
    assert.throws(() => {
      db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
        generateId(),
        'test@test.com',
        'hash',
        ''
      );
    }, /CHECK constraint failed/);

    // Name too long (>80 chars)
    assert.throws(() => {
      db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
        generateId(),
        'test@test.com',
        'hash',
        'A'.repeat(81)
      );
    }, /CHECK constraint failed/);

    // Invalid theme
    assert.throws(() => {
      db.prepare(`INSERT INTO users (id, email, password_hash, name, theme) VALUES (?, ?, ?, ?, ?)`).run(
        generateId(),
        'test@test.com',
        'hash',
        'Alice',
        'blue'
      );
    }, /CHECK constraint failed/);

    // Invalid JSON in notification_prefs
    assert.throws(() => {
      db.prepare(`INSERT INTO users (id, email, password_hash, name, notification_prefs) VALUES (?, ?, ?, ?, ?)`).run(
        generateId(),
        'test@test.com',
        'hash',
        'Alice',
        'not-json'
      );
    }, /CHECK constraint failed/);
  });

  test('UNIQUE constraints reject duplicate email and duplicate token_hash', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-mig-'));
    dbPath = path.join(tempDir, 'teamboard.db');
    db = createDatabase(dbPath);
    runMigrations(db);

    const userId1 = generateId();
    const userId2 = generateId();

    db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
      userId1,
      'alice@example.com',
      'hash1',
      'Alice'
    );

    // Case-insensitive duplicate email
    assert.throws(() => {
      db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
        userId2,
        'ALICE@EXAMPLE.COM',
        'hash2',
        'Alice 2'
      );
    }, /UNIQUE constraint failed/);

    // Duplicate token_hash
    db.prepare(`
      INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at)
      VALUES (?, ?, 'email_verify', 'hash-xyz', datetime('now', '+1 day'))
    `).run(generateId(), userId1);

    assert.throws(() => {
      db.prepare(`
        INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at)
        VALUES (?, ?, 'password_reset', 'hash-xyz', datetime('now', '+1 day'))
      `).run(generateId(), userId1);
    }, /UNIQUE constraint failed/);
  });
});
