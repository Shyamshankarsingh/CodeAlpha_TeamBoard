import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { config as defaultConfig } from '../config.js';
import { logger } from '../logger.js';

let dbInstance = null;

export function createDatabase(dbPath = defaultConfig.DATABASE_PATH, options = {}) {
  // Ensure parent directory exists if using a file path
  if (dbPath !== ':memory:') {
    const resolvedPath = path.resolve(dbPath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath, options);

  // Apply required connection pragmas (DATABASE.md section 1)
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  // Track transaction state and afterCommit callbacks
  let transactionDepth = 0;
  let afterCommitQueue = [];

  function transaction(fn) {
    return (...args) => {
      const isRoot = transactionDepth === 0;
      if (isRoot) {
        transactionDepth = 1;
        afterCommitQueue = [];
      } else {
        transactionDepth++;
      }

      // better-sqlite3 native transaction
      const wrapped = db.transaction((...innerArgs) => fn(...innerArgs));

      try {
        const result = wrapped(...args);

        if (isRoot) {
          // Transaction successfully committed, execute all afterCommit hooks
          const callbacks = [...afterCommitQueue];
          afterCommitQueue = [];
          transactionDepth = 0;

          for (const callback of callbacks) {
            try {
              callback();
            } catch (hookError) {
              logger.error('Error in afterCommit hook', { error: hookError.message });
            }
          }
        } else {
          transactionDepth--;
        }

        return result;
      } catch (err) {
        if (isRoot) {
          // Transaction rolled back, discard afterCommit hooks
          afterCommitQueue = [];
          transactionDepth = 0;
        } else {
          transactionDepth--;
        }
        throw err;
      }
    };
  }

  function afterCommit(fn) {
    if (transactionDepth > 0) {
      afterCommitQueue.push(fn);
    } else {
      // Not inside a transaction, run immediately
      fn();
    }
  }

  // Extend db object with helper methods
  db.transact = transaction;
  db.afterCommit = afterCommit;

  return db;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
