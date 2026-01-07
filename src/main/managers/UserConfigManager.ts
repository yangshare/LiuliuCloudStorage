/**
 * 用户配置管理器
 * 管理用户的 base_path 和配置信息
 */

import { IUserConfig, IUserPermissions } from '@shared/types/multi-tenant.types';
import { dbManager } from '../db/index';

/**
 * 用户配置管理器类
 */
export class UserConfigManager {
  private static instance: UserConfigManager;
  private configCache: Map<string, IUserConfig> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 小时缓存

  private constructor() {
    this.initializeDatabase();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): UserConfigManager {
    if (!UserConfigManager.instance) {
      UserConfigManager.instance = new UserConfigManager();
    }
    return UserConfigManager.instance;
  }

  /**
   * 初始化数据库表
   */
  private initializeDatabase(): void {
    const db = dbManager.getDatabase();

    // 创建用户配置表
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_configs (
        username TEXT PRIMARY KEY,
        base_path TEXT NOT NULL,
        permissions TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_configs_base_path ON user_configs(base_path);
    `);
  }

  /**
   * 保存用户配置
   */
  public saveConfig(config: IUserConfig): void {
    const db = dbManager.getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_configs
      (username, base_path, permissions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      config.username,
      config.basePath,
      JSON.stringify(config.permissions),
      config.createdAt,
      config.updatedAt
    );

    // 更新缓存
    this.configCache.set(config.username, config);
  }

  /**
   * 获取用户配置
   */
  public getConfig(username: string): IUserConfig | null {
    // 先检查缓存
    const cached = this.configCache.get(username);
    if (cached) {
      return cached;
    }

    // 从数据库读取
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM user_configs WHERE username = ?');
    const row = stmt.get(username) as any;

    if (!row) {
      return null;
    }

    const config: IUserConfig = {
      username: row.username,
      basePath: row.base_path,
      permissions: JSON.parse(row.permissions),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    // 缓存配置
    this.configCache.set(username, config);

    return config;
  }

  /**
   * 获取用户的基础路径
   */
  public getBasePath(username: string): string {
    const config = this.getConfig(username);
    return config ? config.basePath : `/root/users/${username}`;
  }

  /**
   * 创建用户配置
   */
  public createConfig(username: string): IUserConfig {
    const now = new Date().toISOString();
    const basePath = `/root/users/${username}`;

    // 默认权限
    const permissions: IUserPermissions = {
      read: true,
      write: true,
      delete: true
    };

    const config: IUserConfig = {
      username,
      basePath,
      permissions,
      createdAt: now,
      updatedAt: now
    };

    this.saveConfig(config);
    return config;
  }

  /**
   * 更新用户配置
   */
  public updateConfig(username: string, updates: Partial<IUserConfig>): void {
    const config = this.getConfig(username);
    if (!config) {
      throw new Error(`用户配置不存在: ${username}`);
    }

    const updatedConfig: IUserConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveConfig(updatedConfig);
  }

  /**
   * 删除用户配置
   */
  public deleteConfig(username: string): void {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM user_configs WHERE username = ?');
    stmt.run(username);

    // 清除缓存
    this.configCache.delete(username);
  }

  /**
   * 清除过期缓存
   */
  public clearExpiredCache(): void {
    // 简单实现：清除所有缓存
    // 实际应该根据时间戳判断
    this.configCache.clear();
  }

  /**
   * 获取所有用户配置
   */
  public getAllConfigs(): IUserConfig[] {
    const db = dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM user_configs');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      username: row.username,
      basePath: row.base_path,
      permissions: JSON.parse(row.permissions),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

/**
 * 导出用户配置管理器实例
 */
export const userConfigManager = UserConfigManager.getInstance();
