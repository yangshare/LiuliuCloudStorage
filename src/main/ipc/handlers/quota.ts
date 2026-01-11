import { ipcMain } from 'electron'
import { getDatabase } from '../../database'
import { getCurrentSession } from './auth'
import { quotaCalculationService } from '../../services/QuotaCalculationService'

export function registerQuotaHandlers(): void {
  /**
   * 获取当前用户的配额信息
   */
  ipcMain.handle('quota:get', async () => {
    try {
      // 获取当前会话
      const session = getCurrentSession()

      if (!session) {
        throw new Error('用户未登录')
      }

      const db = getDatabase()

      // 查询用户配额（使用snake_case字段名）
      const user = db
        .prepare('SELECT quota_total, quota_used FROM users WHERE id = ?')
        .get(session.userId) as { quota_total: number; quota_used: number } | undefined

      if (!user) {
        throw new Error('用户不存在')
      }

      // 返回时转换为camelCase
      return {
        quotaTotal: user.quota_total,
        quotaUsed: user.quota_used
      }
    } catch (error: any) {
      console.error('获取配额失败:', error)
      throw new Error(error.message || '获取配额失败')
    }
  })

  /**
   * 更新配额使用量（内部使用，上传/下载后调用）
   */
  ipcMain.handle('quota:update', async (_event, quotaUsed: number) => {
    try {
      const session = getCurrentSession()

      if (!session) {
        throw new Error('用户未登录')
      }

      const db = getDatabase()

      // 更新用户的已用配额
      db.prepare('UPDATE users SET quota_used = ?, updated_at = ? WHERE id = ?')
        .run(quotaUsed, Date.now(), session.userId)

      return { success: true }
    } catch (error: any) {
      console.error('更新配额失败:', error)
      throw new Error(error.message || '更新配额失败')
    }
  })

  /**
   * 计算并更新配额使用量（Story 6.2）
   */
  ipcMain.handle('quota:calculate', async () => {
    try {
      const session = getCurrentSession()

      if (!session) {
        throw new Error('用户未登录')
      }

      // 计算配额使用量
      const quotaUsed = await quotaCalculationService.calculateQuota(
        session.userId,
        session.username
      )

      // 更新数据库
      const db = getDatabase()
      db.prepare('UPDATE users SET quota_used = ?, updated_at = ? WHERE id = ?')
        .run(quotaUsed, Date.now(), session.userId)

      // 查询最新配额
      const user = db
        .prepare('SELECT quota_total, quota_used FROM users WHERE id = ?')
        .get(session.userId) as { quota_total: number; quota_used: number } | undefined

      if (!user) {
        throw new Error('用户不存在')
      }

      // 返回时转换为camelCase
      return {
        quotaTotal: user.quota_total,
        quotaUsed: user.quota_used
      }
    } catch (error: any) {
      console.error('计算配额失败:', error)
      throw new Error(error.message || '计算配额失败')
    }
  })

  /**
   * 管理员更新用户配额（Story 6.4）
   */
  ipcMain.handle('quota:admin-update', async (_event, userId: number, quotaTotal: number) => {
    try {
      const session = getCurrentSession()

      if (!session) {
        throw new Error('用户未登录')
      }

      const db = getDatabase()

      // 检查当前用户是否为管理员
      const adminUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(session.userId) as { is_admin: number } | undefined

      if (!adminUser || adminUser.is_admin !== 1) {
        throw new Error('权限不足：仅管理员可以调整配额')
      }

      // 更新指定用户的总配额
      db.prepare('UPDATE users SET quota_total = ?, updated_at = ? WHERE id = ?')
        .run(quotaTotal, Date.now(), userId)

      return { success: true }
    } catch (error: any) {
      console.error('管理员更新配额失败:', error)
      throw new Error(error.message || '更新配额失败')
    }
  })
}
