import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTestApp } from '../helpers/app.js';
import { createBackup } from '../../scripts/backup.js';

describe('Phase 14: Deployment & Production Readiness Integration', () => {
  let testEnv;

  before(async () => {
    testEnv = await createTestApp({
      REQUIRE_EMAIL_VERIFICATION: 'false',
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.close();
    }
  });

  test('GET /api/health returns 200 and simple status ok', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { status: 'ok' });
  });

  test('GET /api/health/ready returns 200, database status, journal mode, and uptime', async () => {
    const res = await fetch(`${testEnv.baseUrl}/api/health/ready`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.checks);
    assert.equal(body.checks.database, 'up');
    assert.ok(['wal', 'memory'].includes(body.checks.journalMode));
    assert.ok(typeof body.uptime === 'number');
    assert.ok(body.timestamp);
  });

  test('Automated SQLite WAL backup creates verified snapshot and prunes retention', async () => {
    const tmpBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-backups-'));

    try {
      // 1. Create first backup
      const backup1 = await createBackup({
        backupDir: tmpBackupDir,
        maxBackups: 2,
        db: testEnv.db,
      });

      assert.ok(fs.existsSync(backup1.filePath));
      assert.ok(backup1.sizeBytes > 0);
      assert.ok(backup1.fileName.startsWith('teamboard-backup-'));
      assert.ok(backup1.fileName.endsWith('.db'));

      // 2. Create second and third backups to test retention pruning
      await new Promise((resolve) => setTimeout(resolve, 20));
      const backup2 = await createBackup({
        backupDir: tmpBackupDir,
        maxBackups: 2,
        db: testEnv.db,
      });

      await new Promise((resolve) => setTimeout(resolve, 20));
      const backup3 = await createBackup({
        backupDir: tmpBackupDir,
        maxBackups: 2,
        db: testEnv.db,
      });

      // Total files in tmpBackupDir should be exactly 2 (pruned oldest backup1)
      const files = fs
        .readdirSync(tmpBackupDir)
        .filter((f) => f.startsWith('teamboard-backup-') && f.endsWith('.db'));
      assert.equal(files.length, 2);
      assert.ok(!files.includes(backup1.fileName), 'Oldest backup should have been pruned');
      assert.ok(files.includes(backup2.fileName));
      assert.ok(files.includes(backup3.fileName));
    } finally {
      fs.rmSync(tmpBackupDir, { recursive: true, force: true });
    }
  });

  test('Production Dockerfile and .dockerignore files are properly configured', () => {
    const dockerfile = fs.readFileSync(path.resolve('Dockerfile'), 'utf-8');
    const dockerignore = fs.readFileSync(path.resolve('.dockerignore'), 'utf-8');

    assert.ok(dockerfile.includes('FROM node:22-alpine'), 'Dockerfile must use alpine LTS node image');
    assert.ok(dockerfile.includes('HEALTHCHECK'), 'Dockerfile must configure healthcheck');
    assert.ok(dockerfile.includes('USER node'), 'Dockerfile must use non-root user');
    assert.ok(dockerfile.includes('VOLUME ["/app/data"'), 'Dockerfile must declare persistent volumes');

    assert.ok(dockerignore.includes('node_modules'));
    assert.ok(dockerignore.includes('.env'));
    assert.ok(dockerignore.includes('data/*.db*'));
  });
});
