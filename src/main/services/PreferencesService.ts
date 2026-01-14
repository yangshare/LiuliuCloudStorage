import Database from 'better-sqlite3'
import * as path from 'path'
import { app } from 'electron'

/**
 * 用户偏好设置服务
 * 用于存储用户级别的偏好设置，如最后下载路径等
 */
export class PreferencesService {
  private db: Database.Database | null = null

  constructor() {
    this.initDatabase()
  }

  /**
   * 初始化偏好设置数据库
   */
  private initDatabase(): void {
    try {
      const userDataPath = app.getPath('userData')
      const dbPath = path.join(userDataPath, 'preferences.db')

      this.db = new Database(dbPath)

      // 创建用户偏好表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `)
    } catch (error: any) {
      console.error('[PreferencesService] 数据库初始化失败:', error)
      // 降级处理: 设置为 null，后续操作会检查并抛出错误
      this.db = null
    }
  }

  /**
   * 保存最后下载路径
   * @param userId 用户ID
   * @param dirPath 下载目录路径
   */
  saveLastDownloadPath(userId: number, dirPath: string): void {
    if (!this.db) {
      throw new Error('PreferencesService database not initialized')
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_preferences (key, value, updated_at)
      VALUES (?, ?, ?)
    `)

    stmt.run(
      `last_download_path_${userId}`,
      dirPath,
      Date.now()
    )
  }

  /**
   * 获取最后下载路径
   * @param userId 用户ID
   * @returns 最后下载路径，如果不存在则返回 null
   */
  getLastDownloadPath(userId: number): string | null {
    if (!this.db) {
      throw new Error('PreferencesService database not initialized')
    }

    const stmt = this.db.prepare(`
      SELECT value FROM user_preferences
      WHERE key = ?
    `)

    const result = stmt.get(`last_download_path_${userId}`) as { value: string } | undefined

    return result?.value || null
  }

  /**
   * 清除用户偏好（登出时调用）
   * @param userId 用户ID
   */
  clearUserPreferences(userId: number): void {
    if (!this.db) {
      throw new Error('PreferencesService database not initialized')
    }

    const stmt = this.db.prepare(`
      DELETE FROM user_preferences
      WHERE key LIKE ?
    `)

    stmt.run(`last_download_path_${userId}%`)
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// 导出单例实例
export const preferencesService = new PreferencesService()
