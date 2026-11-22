import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, createDatabase } from './index.js';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultMigrationsDir = path.resolve(__dirname, 'migrations');

export function runMigrations(db = getDb(), migrationsDir = defaultMigrationsDir) {
  // Ensure schema_migrations exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
  const appliedSet = new Set(appliedRows.map((r) => r.version));

  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const appliedNow = [];

  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    if (appliedSet.has(version)) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    // Execute migration and record in schema_migrations atomically
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, file);
    });

    applyMigration();
    appliedNow.push({ version, name: file });
    logger.info(`Applied migration: ${file}`);
  }

  return appliedNow;
}

// Allow direct CLI execution: node server/db/migrate.js
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const db = getDb();
  const applied = runMigrations(db);
  console.log(`Migrations complete. Applied ${applied.length} new migration(s).`);
  process.exit(0);
}
