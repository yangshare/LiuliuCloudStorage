/**
 * 用户会话数据访问层 (DAO)
 */

import { IUserSession } from '@shared/types/auth.types';
import { dbManager } from './index';

/**
 * 会话 DAO 类
 */
export class SessionDAO {
  /**
   * 保存会话
   */
  public static save(session: IUserSession): void {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_sessions
      (id, username, token, created_at, last_active_at, device_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      session.id,
      session.username,
      session.token,
      session.createdAt,
      session.lastActiveAt,
      session.deviceId
    );
  }

  /**
   * 根据 ID 获取会话
   */
  public static findById(id: string): IUserSession | null {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM user_sessions WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapToSession(row) : null;
  }

  /**
   * 获取所有会话
   */
  public static findAll(): IUserSession[] {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM user_sessions ORDER BY last_active_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapToSession(row));
  }

  /**
   * 根据用户名获取会话
   */
  public static findByUsername(username: string): IUserSession[] {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM user_sessions WHERE username = ? ORDER BY last_active_at DESC');
    const rows = stmt.all(username) as any[];
    return rows.map(row => this.mapToSession(row));
  }

  /**
   * 更新会话最后活跃时间
   */
  public static updateLastActive(id: string): void {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('UPDATE user_sessions SET last_active_at = ? WHERE id = ?');
    stmt.run(new Date().toISOString(), id);
  }

  /**
   * 删除会话
   */
  public static delete(id: string): void {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM user_sessions WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 删除用户的所有会话
   */
  public static deleteByUsername(username: string): void {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM user_sessions WHERE username = ?');
    stmt.run(username);
  }

  /**
   * 清除所有会话
   */
  public static deleteAll(): void {
    const db = dbManager.getDatabase();
    db.prepare('DELETE FROM user_sessions').run();
  }

  /**
   * 映射数据库行到会话对象
   */
  private static mapToSession(row: any): IUserSession {
    return {
      id: row.id,
      username: row.username,
      token: row.token,
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at,
      deviceId: row.device_id
    };
  }
}
