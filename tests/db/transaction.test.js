import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDatabase } from '../../server/db/index.js';
import { runMigrations } from '../../server/db/migrate.js';
import { generateId } from '../../server/lib/ids.js';

describe('Database Transactions and afterCommit', () => {
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

  test('transaction helper rolls back on error', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-tx-'));
    dbPath = path.join(tempDir, 'teamboard.db');
    db = createDatabase(dbPath);
    runMigrations(db);

    const userId = generateId();

    const failingTx = db.transact(() => {
      db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
        userId,
        'tx_user@example.com',
        'hash',
        'Tx User'
      );
      throw new Error('Forced transaction failure');
    });

    assert.throws(() => failingTx(), /Forced transaction failure/);

    // Assert row was rolled back
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    assert.equal(row, undefined);
  });

  test('afterCommit runs only after successful commit, never on rollback', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-tx-'));
    dbPath = path.join(tempDir, 'teamboard.db');
    db = createDatabase(dbPath);
    runMigrations(db);

    let committedHookRan = false;
    let failedHookRan = false;

    // Successful transaction
    const successfulTx = db.transact(() => {
      db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
        generateId(),
        'success@example.com',
        'hash',
        'Success'
      );
      db.afterCommit(() => {
        committedHookRan = true;
      });
    });

    successfulTx();
    assert.equal(committedHookRan, true, 'afterCommit should run after successful commit');

    // Failing transaction
    const failingTx = db.transact(() => {
      db.afterCommit(() => {
        failedHookRan = true;
      });
      throw new Error('Rollback error');
    });

    assert.throws(() => failingTx(), /Rollback error/);
    assert.equal(failedHookRan, false, 'afterCommit must NOT run after rollback');
  });

  test('afterCommit runs immediately when called outside transaction', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-tx-'));
    dbPath = path.join(tempDir, 'teamboard.db');
    db = createDatabase(dbPath);

    let ran = false;
    db.afterCommit(() => {
      ran = true;
    });

    assert.equal(ran, true);
  });
});
