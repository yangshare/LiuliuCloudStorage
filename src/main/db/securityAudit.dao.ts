/**
 * 安全审计日志数据访问层
 */

import { randomUUID } from 'crypto';
import { ISecurityAuditLog, SecurityEventType } from '@shared/types/multi-tenant.types';
import { dbManager } from './index';

/**
 * 安全审计日志 DAO 类
 */
export class SecurityAuditDAO {
  /**
   * 初始化数据库表
   */
  public static initializeTable(): void {
    const db = dbManager.getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        username TEXT NOT NULL,
        path TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        details TEXT
      );
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_username ON security_audit_logs(username);
      CREATE INDEX IF NOT EXISTS idx_audit_event_type ON security_audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON security_audit_logs(timestamp);
    `);
  }

  /**
   * 记录安全事件
   */
  public static log(event: ISecurityAuditLog): void {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      INSERT INTO security_audit_logs
      (id, event_type, username, path, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.id,
      event.eventType,
      event.username,
      event.path,
      event.timestamp,
      event.details || null
    );
  }

  /**
   * 记录路径穿越攻击
   */
  public static logPathTraversalAttempt(username: string, path: string): void {
    this.log({
      id: randomUUID(),
      eventType: SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
      username,
      path,
      timestamp: new Date().toISOString(),
      details: '检测到路径穿越攻击尝试'
    });
  }

  /**
   * 记录未授权访问
   */
  public static logUnauthorizedAccess(username: string, path: string): void {
    this.log({
      id: randomUUID(),
      eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
      username,
      path,
      timestamp: new Date().toISOString(),
      details: '尝试访问未授权路径'
    });
  }

  /**
   * 记录权限拒绝
   */
  public static logPermissionDenied(username: string, path: string): void {
    this.log({
      id: randomUUID(),
      eventType: SecurityEventType.PERMISSION_DENIED,
      username,
      path,
      timestamp: new Date().toISOString(),
      details: '权限不足，访问被拒绝'
    });
  }

  /**
   * 查询用户的审计日志
   */
  public static findByUsername(username: string, limit: number = 100): ISecurityAuditLog[] {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM security_audit_logs
      WHERE username = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(username, limit) as any[];
    return rows.map(row => this.mapToAuditLog(row));
  }

  /**
   * 查询特定类型的审计日志
   */
  public static findByEventType(eventType: SecurityEventType, limit: number = 100): ISecurityAuditLog[] {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM security_audit_logs
      WHERE event_type = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(eventType, limit) as any[];
    return rows.map(row => this.mapToAuditLog(row));
  }

  /**
   * 查询时间范围内的日志
   */
  public static findByTimeRange(startTime: string, endTime: string): ISecurityAuditLog[] {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM security_audit_logs
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
    `);
    const rows = stmt.all(startTime, endTime) as any[];
    return rows.map(row => this.mapToAuditLog(row));
  }

  /**
   * 清除过期日志（默认保留 90 天）
   */
  public static cleanExpiredLogs(daysToKeep: number = 90): void {
    const db = dbManager.getDatabase();
    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare('DELETE FROM security_audit_logs WHERE timestamp < ?');
    stmt.run(cutoffTime);
  }

  /**
   * 映射数据库行到审计日志对象
   */
  private static mapToAuditLog(row: any): ISecurityAuditLog {
    return {
      id: row.id,
      eventType: row.event_type as SecurityEventType,
      username: row.username,
      path: row.path,
      timestamp: row.timestamp,
      details: row.details
    };
  }
}
