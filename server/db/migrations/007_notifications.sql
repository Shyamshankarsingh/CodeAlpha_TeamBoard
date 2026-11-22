-- Migration 007: Notifications
-- Persistent, preference-aware in-app notifications with unread tracking

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN (
    'task_assigned',
    'task_unassigned',
    'comment_created',
    'comment_mention',
    'task_due_soon',
    'task_overdue',
    'project_invitation',
    'workspace_invitation',
    'role_changed'
  )),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
  entity_type TEXT NULL CHECK(entity_type IN ('task', 'comment', 'project', 'workspace')),
  entity_id TEXT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  read_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_feed 
  ON notifications(user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id) 
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_dedup 
  ON notifications(user_id, type, entity_id);
