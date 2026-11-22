-- Migration 008: Extras (Post-MVP)
-- Attachments, Task Dependencies, and FTS5 Full-Text Search

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
  file_size INTEGER NOT NULL CHECK(file_size > 0),
  mime_type TEXT NOT NULL CHECK(length(mime_type) BETWEEN 1 AND 100),
  storage_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader_id ON attachments(uploader_id);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(task_id != depends_on_task_id),
  UNIQUE(task_id, depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

-- FTS5 Full-Text Search Virtual Table for Tasks
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  task_id UNINDEXED,
  project_id UNINDEXED,
  title,
  description
);

-- Triggers to synchronize tasks with tasks_fts
CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(task_id, project_id, title, description)
  VALUES (new.id, new.project_id, new.title, coalesce(new.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_ad AFTER DELETE ON tasks BEGIN
  DELETE FROM tasks_fts WHERE task_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_au AFTER UPDATE OF title, description ON tasks BEGIN
  DELETE FROM tasks_fts WHERE task_id = old.id;
  INSERT INTO tasks_fts(task_id, project_id, title, description)
  VALUES (new.id, new.project_id, new.title, coalesce(new.description, ''));
END;

-- Backfill tasks_fts from any existing tasks
INSERT INTO tasks_fts(task_id, project_id, title, description)
SELECT id, project_id, title, coalesce(description, '') FROM tasks
WHERE id NOT IN (SELECT task_id FROM tasks_fts);
