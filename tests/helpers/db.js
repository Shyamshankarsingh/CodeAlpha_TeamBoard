import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createDatabase } from '../../server/db/index.js';
import { runMigrations } from '../../server/db/migrate.js';

export function createTestDatabase(options = {}) {
  const isMemory = options.memory === true;
  let dbPath;
  let cleanup = () => {};

  if (isMemory) {
    dbPath = ':memory:';
  } else {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamboard-test-'));
    dbPath = path.join(tempDir, `test-${crypto.randomUUID()}.db`);
    cleanup = () => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors on busy files in Windows
      }
    };
  }

  const db = createDatabase(dbPath);
  runMigrations(db);

  return {
    db,
    dbPath,
    cleanup: () => {
      try {
        db.close();
      } catch (e) {}
      cleanup();
    },
  };
}
