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
