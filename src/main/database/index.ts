import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

export * from './schema'

let db: Database.Database | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  quota_total INTEGER DEFAULT 10737418240,
  quota_used INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  onboarding_completed INTEGER DEFAULT 0,
  alist_token TEXT,
  token_expires_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_encrypted TEXT NOT NULL,
  base_path TEXT DEFAULT '/',
  expires_at INTEGER NOT NULL,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_encrypted);

CREATE TABLE IF NOT EXISTS file_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  cached_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_file_cache_user_path ON file_cache(user_id, path);

CREATE TABLE IF NOT EXISTS transfer_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  remote_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  transferred_size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  task_id TEXT,
  error_message TEXT,
  resumable INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_transfer_queue_user_id ON transfer_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_queue_status ON transfer_queue(status);
CREATE INDEX IF NOT EXISTS idx_transfer_queue_task_type ON transfer_queue(task_type);
CREATE INDEX IF NOT EXISTS idx_transfer_queue_user_status ON transfer_queue(user_id, status);

CREATE TRIGGER IF NOT EXISTS update_transfer_queue_timestamp
AFTER UPDATE ON transfer_queue
FOR EACH ROW
BEGIN
  UPDATE transfer_queue SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;
`

// 迁移：添加 base_path 字段到旧数据库
const MIGRATIONS = `
ALTER TABLE sessions ADD COLUMN base_path TEXT DEFAULT '/';
`

export function initDatabase(): Database.Database {
  if (db) return db

  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  const dbPath = join(userDataPath, 'liuliu.db')
  db = new Database(dbPath)

  db.exec(SCHEMA)

  // 运行迁移（忽略已存在的列错误）
  try {
    db.exec(MIGRATIONS)
  } catch {
    // 列已存在，忽略
  }

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
