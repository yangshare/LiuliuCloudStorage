import { ipcMain, net } from 'electron'
import { getDatabase } from '../../database'
import { getCurrentSession } from './auth'
import { quotaCalculationService } from '../../services/QuotaCalculationService'
import { loadConfig } from '../../config'

// 缓存 N8N Webhook URL，避免重复计算
let cachedN8nWebhookUrl: string | null = null

function getN8nWebhookUrl(): string {
  if (!cachedN8nWebhookUrl) {
    const config = loadConfig()
    cachedN8nWebhookUrl = `${config.n8nBaseUrl}/webhook/liuliu`
  }
  return cachedN8nWebhookUrl
}

/**
 * 调用 n8n Webhook (Story 6.4: Dual-Flow Architecture)
 */
async function callN8nWebhook(endpoint: string, data: object): Promise<any> {
  return new Promise((resolve) => {
    const N8N_WEBHOOK_URL = getN8nWebhookUrl()
    const url = `${N8N_WEBHOOK_URL}/${endpoint}`
    const postData = JSON.stringify(data)

    try {
      const request = net.request({ method: 'POST', url })
      request.setHeader('Content-Type', 'application/json')

      let responseData = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { responseData += chunk.toString() })
        response.on('end', () => {
          try {
            resolve(JSON.parse(responseData))
          } catch {
            resolve({ success: false, message: '服务器响应格式错误' })
          }
        })
        response.on('error', () => {
          resolve({ success: false, message: '网络连接中断' })
        })
      })
      request.on('error', (err) => {
        console.error('[quota] n8n Webhook request error:', err.message)
        resolve({ success: false, message: '无法连接到服务器，请检查网络' })
      })
      request.write(postData)
      request.end()
    } catch (err) {
      console.error('[quota] n8n Webhook error:', err)
      resolve({ success: false, message: '请求发送失败' })
    }
  })
}

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
   * 管理员更新用户配额（Story 6.4 - CRITICAL FIX: 必须通过 n8n Webhook）
   *
   * 修复内容:
   * 1. 添加 GB 到字节的单位转换验证
   * 2. 通过 n8n Webhook 更新配额 (Dual-Flow Architecture)
   * 3. 记录操作日志到 activity_logs
   */
  ipcMain.handle('quota:admin-update', async (_event, targetUserId: number, newQuotaGB: number) => {
    try {
      const session = getCurrentSession()

      if (!session) {
        throw new Error('用户未登录')
      }

      const db = getDatabase()

      // 1. 验证当前用户是管理员
      const adminUser = db.prepare('SELECT is_admin, username FROM users WHERE id = ?').get(session.userId) as { is_admin: number; username: string } | undefined

      if (!adminUser || adminUser.is_admin !== 1) {
        throw new Error('权限不足：仅管理员可以调整配额')
      }

      // 2. 验证配额值范围（1GB - 1000GB）
      if (newQuotaGB < 1 || newQuotaGB > 1000) {
        throw new Error('配额值必须在 1GB 到 1000GB 之间')
      }

      // 3. 单位转换：GB 转字节
      const newQuotaBytes = newQuotaGB * 1024 * 1024 * 1024

      // 4. 获取目标用户信息
      const targetUser = db.prepare('SELECT id, username, quota_total FROM users WHERE id = ?').get(targetUserId) as { id: number; username: string; quota_total: number } | undefined

      if (!targetUser) {
        throw new Error('目标用户不存在')
      }

      // 5. 调用 n8n Webhook 更新配额 (Story 6.4 AC3, AC4 - Dual-Flow Architecture)
      const webhookResult = await callN8nWebhook('admin/quota/update', {
        adminUserId: session.userId,
        adminUsername: adminUser.username,
        targetUserId: targetUser.id,
        targetUsername: targetUser.username,
        oldQuotaBytes: targetUser.quota_total,
        newQuotaBytes: newQuotaBytes,
        newQuotaGB: newQuotaGB,
        timestamp: Date.now()
      })

      if (!webhookResult.success) {
        throw new Error(webhookResult.message || '更新配额失败')
      }

      // 6. 记录操作日志 (Story 6.4 AC6)
      try {
        db.prepare(`
          INSERT INTO activity_logs (
            user_id, action_type, target_user_id,
            old_value, new_value, details,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          session.userId,
          'quota_adjusted',
          targetUserId,
          targetUser.quota_total,
          newQuotaBytes,
          JSON.stringify({
            adminUsername: adminUser.username,
            targetUsername: targetUser.username,
            oldQuotaGB: (targetUser.quota_total / (1024 * 1024 * 1024)).toFixed(2),
            newQuotaGB: newQuotaGB
          }),
          Date.now()
        )
      } catch (logError) {
        console.error('[quota] 记录操作日志失败:', logError)
        // 日志记录失败不影响主流程
      }

      return {
        success: true,
        userId: targetUserId,
        oldQuota: targetUser.quota_total,
        newQuota: newQuotaBytes
      }
    } catch (error: any) {
      console.error('管理员更新配额失败:', error)
      throw new Error(error.message || '更新配额失败')
    }
  })
}
