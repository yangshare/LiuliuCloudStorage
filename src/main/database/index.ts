import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { sql } from 'drizzle-orm'
import * as schema from './schema'

export * from './schema'

let sqlite: Database.Database | null = null
let db: ReturnType<typeof drizzle<typeof schema>> | null = null

function runMigrations(database: Database.Database) {
  database.exec(`
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
      expires_at INTEGER NOT NULL,
      created_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_encrypted);
  `)
}

export function initDatabase() {
  if (db) return db

  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  const dbPath = join(userDataPath, 'liuliu.db')
  sqlite = new Database(dbPath)
  runMigrations(sqlite)
  db = drizzle(sqlite, { schema })
  return db
}

export function getDatabase() {
  if (!db) {
    return initDatabase()
  }
  return db
}

export function closeDatabase() {
  if (sqlite) {
    sqlite.close()
    sqlite = null
  }
  db = null
}
