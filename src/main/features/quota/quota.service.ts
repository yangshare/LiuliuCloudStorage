// src/main/features/quota/quota.service.ts

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import axios from 'axios'
import { getDatabase } from '../../database'
import { users } from '../../database/schema'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'
import { authService } from '../auth/auth.service'
import { quotaCalculationService } from '../../services/QuotaCalculationService'
import { loadConfig } from '../../config'
import { loggerService } from '../../services/LoggerService'

export interface QuotaInfo {
  quotaTotal: number
  quotaUsed: number
}

export interface AdminUpdateResult {
  success: boolean
  userId: number
  oldQuota: number
  newQuota: number
}

/**
 * 配额服务
 * 负责配额查询、更新、计算和管理员配额调整
 */
export class QuotaService {
  private get db() {
    return drizzle(getDatabase())
  }

  // 缓存 n8n Webhook URL
  private cachedN8nWebhookUrl: string | null = null

  /**
   * 获取 n8n Webhook URL
   */
  private getN8nWebhookUrl(): string {
    if (!this.cachedN8nWebhookUrl) {
      const config = loadConfig()
      this.cachedN8nWebhookUrl = `${config.n8nBaseUrl}/webhook/liuliu`
    }
    return this.cachedN8nWebhookUrl
  }

  /**
   * 调用 n8n Webhook (Story 6.4: Dual-Flow Architecture)
   */
  private async callN8nWebhook(endpoint: string, data: object): Promise<any> {
    const n8nWebhookUrl = this.getN8nWebhookUrl()
    const url = `${n8nWebhookUrl}/${endpoint}`

    try {
      const response = await axios.post(url, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      })
      return response.data
    } catch (error: any) {
      loggerService.error('QuotaService', `n8n Webhook 请求失败: ${error.message}`)
      return { success: false, message: '无法连接到服务器，请检查网络' }
    }
  }

  /**
   * 获取当前用户配额信息
   */
  async getQuota(): Promise<QuotaInfo> {
    const session = authService.getCurrentSession()

    if (!session) {
      throw new IPCError('用户未登录', IPCErrorCode.UNAUTHORIZED)
    }

    const user = this.db
      .select({
        quotaTotal: users.quotaTotal,
        quotaUsed: users.quotaUsed
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()

    if (!user) {
      throw new IPCError('用户不存在', IPCErrorCode.NOT_FOUND)
    }

    return {
      quotaTotal: user.quotaTotal ?? 0,
      quotaUsed: user.quotaUsed ?? 0
    }
  }

  /**
   * 更新配额使用量
   */
  async updateQuota(quotaUsed: number): Promise<{ success: boolean }> {
    const session = authService.getCurrentSession()

    if (!session) {
      throw new IPCError('用户未登录', IPCErrorCode.UNAUTHORIZED)
    }

    this.db
      .update(users)
      .set({
        quotaUsed,
        updatedAt: new Date()
      })
      .where(eq(users.id, session.userId))
      .run()

    return { success: true }
  }

  /**
   * 计算并更新配额使用量（Story 6.2）
   */
  async calculateAndUpdateQuota(): Promise<QuotaInfo> {
    const session = authService.getCurrentSession()

    if (!session) {
      throw new IPCError('用户未登录', IPCErrorCode.UNAUTHORIZED)
    }

    // 计算配额使用量
    const quotaUsed = await quotaCalculationService.calculateQuota(
      session.userId,
      session.username
    )

    // 更新数据库
    this.db
      .update(users)
      .set({
        quotaUsed,
        updatedAt: new Date()
      })
      .where(eq(users.id, session.userId))
      .run()

    // 查询最新配额
    const user = this.db
      .select({
        quotaTotal: users.quotaTotal,
        quotaUsed: users.quotaUsed
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()

    if (!user) {
      throw new IPCError('用户不存在', IPCErrorCode.NOT_FOUND)
    }

    return {
      quotaTotal: user.quotaTotal ?? 0,
      quotaUsed: user.quotaUsed ?? 0
    }
  }

  /**
   * 管理员更新用户配额（Story 6.4 - Dual-Flow Architecture）
   */
  async adminUpdateQuota(targetUserId: number, newQuotaGB: number): Promise<AdminUpdateResult> {
    const session = authService.getCurrentSession()

    if (!session) {
      throw new IPCError('用户未登录', IPCErrorCode.UNAUTHORIZED)
    }

    // 1. 验证当前用户是管理员
    const adminUser = this.db
      .select({
        isAdmin: users.isAdmin,
        username: users.username
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()

    if (!adminUser || !adminUser.isAdmin) {
      throw new IPCError('权限不足：仅管理员可以调整配额', IPCErrorCode.FORBIDDEN)
    }

    // 2. 验证配额值范围（1GB - 1000GB）
    if (newQuotaGB < 1 || newQuotaGB > 1000) {
      throw new IPCError('配额值必须在 1GB 到 1000GB 之间', IPCErrorCode.VALIDATION)
    }

    // 3. 单位转换：GB 转字节
    const newQuotaBytes = newQuotaGB * 1024 * 1024 * 1024

    // 4. 获取目标用户信息
    const targetUser = this.db
      .select({
        id: users.id,
        username: users.username,
        quotaTotal: users.quotaTotal
      })
      .from(users)
      .where(eq(users.id, targetUserId))
      .get()

    if (!targetUser) {
      throw new IPCError('目标用户不存在', IPCErrorCode.NOT_FOUND)
    }

    // 5. 调用 n8n Webhook 更新配额 (Story 6.4 AC3, AC4)
    const webhookResult = await this.callN8nWebhook('admin/quota/update', {
      adminUserId: session.userId,
      adminUsername: adminUser.username,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      oldQuotaBytes: targetUser.quotaTotal,
      newQuotaBytes: newQuotaBytes,
      newQuotaGB: newQuotaGB,
      timestamp: Date.now()
    })

    if (!webhookResult.success) {
      throw new IPCError(webhookResult.message || '更新配额失败', IPCErrorCode.INTERNAL)
    }

    // 6. 记录操作日志 (Story 6.4 AC6)
    // 注意：activity_logs 表没有 target_user_id/old_value/new_value 列，使用原始 SQL 插入
    try {
      const db = getDatabase()
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
        targetUser.quotaTotal,
        newQuotaBytes,
        JSON.stringify({
          adminUsername: adminUser.username,
          targetUsername: targetUser.username,
          oldQuotaGB: ((targetUser.quotaTotal ?? 0) / (1024 * 1024 * 1024)).toFixed(2),
          newQuotaGB: newQuotaGB
        }),
        Date.now()
      )
    } catch (logError) {
      loggerService.error('QuotaService', `记录操作日志失败: ${logError}`)
      // 日志记录失败不影响主流程
    }

    return {
      success: true,
      userId: targetUserId,
      oldQuota: targetUser.quotaTotal ?? 0,
      newQuota: newQuotaBytes
    }
  }
}

export const quotaService = new QuotaService()
