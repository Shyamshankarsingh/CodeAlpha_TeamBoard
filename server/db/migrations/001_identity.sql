-- Migration 001: Identity schema
-- Tables: schema_migrations, users, sessions, auth_tokens

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email_verified_at TEXT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  avatar_path TEXT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  theme TEXT NOT NULL DEFAULT 'system' CHECK(theme IN ('system', 'light', 'dark')),
  notification_prefs TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(notification_prefs)),
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, -- SHA-256 hex of token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT NULL,
  user_agent TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('email_verify', 'password_reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_type ON auth_tokens(user_id, type);
