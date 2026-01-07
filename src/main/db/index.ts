/**
 * 数据库初始化和连接管理
 * 使用 better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

/**
 * 数据库类
 */
export class DatabaseManager {
  private db: Database.Database | null = null;
  private static instance: DatabaseManager;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * 初始化数据库
   */
  public initialize(): void {
    if (this.db) {
      return;
    }

    // 获取用户数据目录
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'database');

    // 确保目录存在
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 创建数据库连接
    const dbPath = path.join(dbDir, 'liuliu-storage.db');
    this.db = new Database(dbPath);

    // 启用外键约束
    this.db.pragma('foreign_keys = ON');

    // 创建表
    this.createTables();

    console.log('Database initialized at:', dbPath);
  }

  /**
   * 创建数据表
   */
  private createTables(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // 创建用户会话表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        device_id TEXT NOT NULL
      );
    `);

    // 创建传输历史表（用于传输管理模块）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfer_history (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_username ON user_sessions(username);
      CREATE INDEX IF NOT EXISTS idx_sessions_device ON user_sessions(device_id);
      CREATE INDEX IF NOT EXISTS idx_transfer_type ON transfer_history(type);
      CREATE INDEX IF NOT EXISTS idx_transfer_status ON transfer_history(status);
    `);
  }

  /**
   * 获取数据库实例
   */
  public getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * 关闭数据库连接
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * 导出数据库实例
 */
export const dbManager = DatabaseManager.getInstance();
