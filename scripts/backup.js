import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../server/db/index.js';
import { config } from '../server/config.js';
import { logger } from '../server/logger.js';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export async function createBackup({
  backupDir = path.join(projectRoot, 'backups'),
  maxBackups = 10,
  db = null,
} = {}) {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const database = db || getDb();

  // Timestamp format: YYYY-MM-DDTHH-mm-ss
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupFileName = `teamboard-backup-${timestamp}.db`;
  const backupFilePath = path.join(backupDir, backupFileName);

  logger.info(`Starting database backup to ${backupFilePath}...`);

  // Execute online non-blocking SQLite backup
  await database.backup(backupFilePath);

  // Integrity verification
  const verifyDb = new Database(backupFilePath, { readonly: true });
  try {
    const result = verifyDb.prepare('PRAGMA integrity_check').get();
    if (!result || result.integrity_check !== 'ok') {
      throw new Error(`Backup integrity check failed: ${JSON.stringify(result)}`);
    }
    logger.info(`Backup integrity verified successfully: ${backupFileName}`);
  } finally {
    verifyDb.close();
  }

  // Retention pruning: keep only latest maxBackups
  pruneOldBackups(backupDir, maxBackups);

  return {
    filePath: backupFilePath,
    fileName: backupFileName,
    sizeBytes: fs.statSync(backupFilePath).size,
    createdAt: now.toISOString(),
  };
}

function pruneOldBackups(backupDir, maxBackups) {
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('teamboard-backup-') && f.endsWith('.db'))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > maxBackups) {
      const toDelete = files.slice(maxBackups);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
        logger.info(`Pruned old backup: ${item.name}`);
      }
    }
  } catch (err) {
    logger.warn('Failed to prune old backups', { error: err.message });
  }
}

// CLI execution if run directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  createBackup()
    .then((info) => {
      console.log(`Backup completed: ${info.filePath} (${info.sizeBytes} bytes)`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}
