/**
 * 会话存储数据访问对象
 * 用于持久化用户会话信息
 */

import { randomUUID } from 'crypto';
import { ISession, IDeviceInfo } from '@shared/types/security.types';
import { dbManager } from './index';

export class SessionStorageDAO {
  private static instance: SessionStorageDAO;

  private constructor() {
    this.initializeTable();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SessionStorageDAO {
    if (!SessionStorageDAO.instance) {
      SessionStorageDAO.instance = new SessionStorageDAO();
    }
    return SessionStorageDAO.instance;
  }

  /**
   * 初始化会话表
   */
  public initializeTable(): void {
    const db = dbManager.getDatabase();

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        device_name TEXT,
        platform TEXT,
        arch TEXT,
        os_version TEXT,
        app_version TEXT,
        browser TEXT,
        ip_address TEXT,
        login_time TEXT NOT NULL,
        last_active_time TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        is_current INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_session_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_session_session_id ON user_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_expires_at ON user_sessions(expires_at);
    `);
  }

  /**
   * 保存会话
   */
  public saveSession(session: ISession): void {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_sessions
      (id, user_id, username, session_id, device_name, platform, arch, os_version, app_version, browser,
       ip_address, login_time, last_active_time, expires_at, is_current)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.userId,
      session.username,
      session.sessionId,
      session.deviceInfo.deviceName,
      session.deviceInfo.platform,
      session.deviceInfo.arch,
      session.deviceInfo.osVersion,
      session.deviceInfo.appVersion,
      session.deviceInfo.browser || null,
      session.ipAddress || null,
      session.loginTime,
      session.lastActiveTime,
      session.expiresAt,
      session.isCurrent ? 1 : 0
    );
  }

  /**
   * 获取会话
   */
  public getSession(sessionId: string): ISession | null {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM user_sessions WHERE session_id = ?');
    const row = stmt.get(sessionId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToSession(row);
  }

  /**
   * 获取用户的所有会话
   */
  public getUserSessions(userId: number): ISession[] {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM user_sessions
      WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY login_time DESC
    `);

    const rows = stmt.all(userId) as any[];
    return rows.map(row => this.mapRowToSession(row));
  }

  /**
   * 获取所有活跃会话
   */
  public getActiveSessions(): ISession[] {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM user_sessions
      WHERE expires_at > datetime('now')
      ORDER BY last_active_time DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToSession(row));
  }

  /**
   * 删除会话
   */
  public deleteSession(sessionId: string): boolean {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM user_sessions WHERE session_id = ?');
    const result = stmt.run(sessionId);
    return result.changes > 0;
  }

  /**
   * 删除用户的所有会话（除了当前会话）
   */
  public deleteUserSessions(userId: number, excludeSessionId?: string): number {
    let query = 'DELETE FROM user_sessions WHERE user_id = ?';
    const params: any[] = [userId];

    if (excludeSessionId) {
      query += ' AND session_id != ?';
      params.push(excludeSessionId);
    }

    const db = dbManager.getDatabase();
    const stmt = db.prepare(query);
    const result = stmt.run(...params);
    return result.changes;
  }

  /**
   * 更新会话活跃时间
   */
  public updateLastActiveTime(sessionId: string): void {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      UPDATE user_sessions
      SET last_active_time = datetime('now')
      WHERE session_id = ?
    `);
    stmt.run(sessionId);
  }

  /**
   * 清理过期会话
   */
  public cleanExpiredSessions(): number {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM user_sessions WHERE expires_at <= datetime("now")');
    const result = stmt.run();
    return result.changes;
  }

  /**
   * 设置当前会话
   */
  public setCurrentSession(userId: number, sessionId: string): void {
    const db = dbManager.getDatabase();

    // 取消其他会话的当前标记
    db.prepare('UPDATE user_sessions SET is_current = 0 WHERE user_id = ?').run(userId);

    // 设置当前会话
    db.prepare('UPDATE user_sessions SET is_current = 1 WHERE session_id = ?').run(sessionId);
  }

  /**
   * 获取当前会话
   */
  public getCurrentSession(userId: number): ISession | null {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM user_sessions
      WHERE user_id = ? AND is_current = 1 AND expires_at > datetime('now')
    `);

    const row = stmt.get(userId) as any;
    if (!row) {
      return null;
    }

    return this.mapRowToSession(row);
  }

  /**
   * 映射数据库行到会话对象
   */
  private mapRowToSession(row: any): ISession {
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username,
      sessionId: row.session_id,
      deviceInfo: {
        deviceName: row.device_name,
        platform: row.platform,
        arch: row.arch,
        osVersion: row.os_version,
        appVersion: row.app_version,
        browser: row.browser
      },
      ipAddress: row.ip_address,
      loginTime: row.login_time,
      lastActiveTime: row.last_active_time,
      expiresAt: row.expires_at,
      isCurrent: row.is_current === 1
    };
  }
}

// 导出单例实例
export const sessionStorageDAO = SessionStorageDAO.getInstance();
