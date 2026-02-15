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

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  file_size INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at);

CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  upload_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  delete_count INTEGER NOT NULL DEFAULT 0,
  folder_create_count INTEGER NOT NULL DEFAULT 0,
  total_files INTEGER NOT NULL DEFAULT 0,
  total_size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_id ON daily_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_stats(user_id, date);

CREATE TABLE IF NOT EXISTS download_config (
  id INTEGER PRIMARY KEY NOT NULL,
  default_path TEXT NOT NULL,
  auto_create_date_folder INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 分享转存记录表：记录百度网盘分享链接的转存历史
CREATE TABLE IF NOT EXISTS share_transfer_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),      -- 执行转存操作的用户ID
  share_url TEXT NOT NULL,                            -- 分享链接地址
  share_code TEXT,                                    -- 分享提取码（如有）
  receiver TEXT,                                      -- 接收转存的百度账号名
  alist_path TEXT,                                    -- Alist 目标存储路径
  status TEXT NOT NULL DEFAULT 'pending',             -- 状态: pending/success/failed
  error_message TEXT,                                 -- 失败时的错误信息
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_share_transfer_user_id ON share_transfer_records(user_id);
CREATE INDEX IF NOT EXISTS idx_share_transfer_status ON share_transfer_records(status);
CREATE INDEX IF NOT EXISTS idx_share_transfer_created_at ON share_transfer_records(created_at);
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

  // 启用 WAL 模式以支持并发读写
  db.pragma('journal_mode = WAL')
  // 设置繁忙超时（5秒）
  db.pragma('busy_timeout = 5000')
  // 启用外键约束
  db.pragma('foreign_keys = ON')

  db.exec(SCHEMA)

  // 运行迁移（忽略已存在的列错误）
  try {
    db.exec(MIGRATIONS)
  } catch {
    // 列已存在，忽略
  }

  // 初始化默认下载配置
  try {
    const configExists = db.prepare('SELECT COUNT(*) as count FROM download_config WHERE id = 1').get() as { count: number }
    if (configExists.count === 0) {
      const downloadsPath = app.getPath('downloads')
      const defaultPath = join(downloadsPath, '溜溜网盘')

      // 确保默认下载目录存在
      if (!existsSync(defaultPath)) {
        mkdirSync(defaultPath, { recursive: true })
      }

      const now = Math.floor(Date.now() / 1000)

      db.prepare(`
        INSERT INTO download_config (id, default_path, auto_create_date_folder, created_at, updated_at)
        VALUES (1, ?, 0, ?, ?)
      `).run(defaultPath, now, now)
    }
  } catch (error) {
    console.error('Failed to initialize download config:', error)
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
