import axios from 'axios'
import { getDatabase } from '../database'
import { shareTransferRecords } from '../database/schema'
import type { NewShareTransferRecord, ShareTransferRecord } from '../database/schema'
import { count, desc, eq, and, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { loadConfig } from '../config'
import { loggerService } from './LoggerService'

/**
 * 获取转存 Token（从环境变量或配置文件读取）
 */
function getTransferToken(): string {
  // 优先从环境变量读取
  const envToken = process.env.AMB_TRANSFER_TOKEN
  if (envToken) {
    return envToken
  }

  // 从配置文件读取（配置文件中可以配置 token 字段）
  const config = loadConfig()
  const configToken = (config as any).ambTransferToken
  if (configToken) {
    return configToken
  }

  loggerService.warn('ShareTransfer', '未配置 AMB_TRANSFER_TOKEN，转存功能可能无法正常工作')
  return ''
}

/**
 * 三方接口响应格式
 */
export interface AmbApiResponse<T = any> {
  code: number
  msg: string
  data?: T
}

/**
 * 分享转存服务
 * - 调用三方 AMB 接口执行转存
 * - 本地数据库存储转存记录（因为三方 /list 接口需要认证）
 */
export class ShareTransferService {
  private static instance: ShareTransferService | null = null

  private constructor() {}

  private get db() {
    return drizzle(getDatabase())
  }

  private getApiBaseUrl(): string {
    const config = loadConfig()
    return config.ambApiBaseUrl
  }

  static getInstance(): ShareTransferService {
    if (!ShareTransferService.instance) {
      ShareTransferService.instance = new ShareTransferService()
    }
    return ShareTransferService.instance
  }

  /**
   * 执行分享转存
   * POST /bdshare/transfer/exec
   */
  async execTransfer(url: string, userId: number): Promise<{
    success: boolean
    message: string
    alistPath?: string
    recordId?: number
  }> {
    const baseUrl = this.getApiBaseUrl()
    let recordId: number | undefined = undefined

    try {
      loggerService.info('ShareTransfer', `开始执行转存: ${url}`)

      // 创建本地记录（转存中状态）
      const record: NewShareTransferRecord = {
        userId,
        shareUrl: url,
        shareCode: this.extractShareCode(url),
        receiver: '桌面客户端',
        status: 'transferring'
      }
      const [insertedRecord] = await this.db.insert(shareTransferRecords).values(record).returning()
      recordId = insertedRecord.id

      // 调用三方接口
      const token = getTransferToken()
      if (!token) {
        throw new Error('未配置转存 Token，请设置环境变量 AMB_TRANSFER_TOKEN')
      }

      const response = await axios.post<AmbApiResponse<string>>(
        `${baseUrl}/bdshare/transfer/exec`,
        {
          token,
          url
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      const result = response.data

      // 接口成功时返回: { code: 200, msg: "alist路径" }
      // 接口失败时返回: { code: 500, msg: "错误信息" }
      if (result.code === 200) {
        // msg 字段包含 alist 路径
        const alistPath = result.msg || result.data || ''
        const isSuccess = alistPath.startsWith('http')

        if (isSuccess) {
          // 转存成功，更新本地记录
          await this.db
            .update(shareTransferRecords)
            .set({
              alistPath,
              status: 'completed',
              updatedAt: new Date()
            })
            .where(eq(shareTransferRecords.id, recordId))

          loggerService.info('ShareTransfer', `转存成功: ${url} -> ${alistPath}`)

          return {
            success: true,
            message: '转存成功',
            alistPath,
            recordId
          }
        }
      }

      // 转存失败，更新本地记录
      const errorMsg = result.msg || '转存失败'
      await this.db
        .update(shareTransferRecords)
        .set({
          status: 'failed',
          errorMessage: errorMsg,
          updatedAt: new Date()
        })
        .where(eq(shareTransferRecords.id, recordId))

      loggerService.error('ShareTransfer', `转存失败: ${errorMsg}`)

      return {
        success: false,
        message: errorMsg,
        recordId
      }
    } catch (error: any) {
      loggerService.error('ShareTransfer', `转存异常: ${error.message}`)

      // 尝试更新记录状态为失败（如果记录已创建）
      if (recordId) {
        try {
          await this.db
            .update(shareTransferRecords)
            .set({
              status: 'failed',
              errorMessage: error.message || '网络请求异常',
              updatedAt: new Date()
            })
            .where(eq(shareTransferRecords.id, recordId))
        } catch (updateError) {
          loggerService.error('ShareTransfer', '更新失败状态时出错', updateError)
        }
      }

      return {
        success: false,
        message: error.response?.data?.msg || error.message || '网络请求失败',
        recordId
      }
    }
  }

  /**
   * 从分享链接中提取短码
   */
  private extractShareCode(url: string): string | null {
    const match = url.match(/\/s\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  }

  /**
   * 获取本地转存记录列表
   */
  async getRecords(
    userId: number,
    options?: {
      limit?: number
      offset?: number
      status?: string
    }
  ): Promise<{ records: ShareTransferRecord[]; total: number }> {
    try {
      const conditions = [eq(shareTransferRecords.userId, userId)]

      if (options?.status) {
        conditions.push(eq(shareTransferRecords.status, options.status as any))
      }

      // 获取总数
      const countResult = await this.db
        .select({ count: count() })
        .from(shareTransferRecords)
        .where(and(...conditions))

      const total = countResult[0]?.count || 0

      // 获取分页数据
      const records = await this.db
        .select()
        .from(shareTransferRecords)
        .where(and(...conditions))
        .orderBy(desc(shareTransferRecords.createdAt))
        .limit(options?.limit || 50)
        .offset(options?.offset || 0)

      return { records, total }
    } catch (error) {
      loggerService.error('ShareTransfer', `获取记录列表失败: ${error}`)
      return { records: [], total: 0 }
    }
  }

  /**
   * 获取最新待转存记录
   */
  async getLatestPending(userId: number): Promise<ShareTransferRecord | null> {
    try {
      const records = await this.db
        .select()
        .from(shareTransferRecords)
        .where(
          and(
            eq(shareTransferRecords.userId, userId),
            eq(shareTransferRecords.status, 'pending')
          )
        )
        .orderBy(desc(shareTransferRecords.createdAt))
        .limit(1)

      return records[0] || null
    } catch (error) {
      loggerService.error('ShareTransfer', `获取最新待转存记录失败: ${error}`)
      return null
    }
  }

  /**
   * 标记为已转存（本地）
   */
  async markAsCompleted(id: number, userId: number): Promise<boolean> {
    try {
      await this.db
        .update(shareTransferRecords)
        .set({
          status: 'completed',
          updatedAt: new Date()
        })
        .where(and(eq(shareTransferRecords.id, id), eq(shareTransferRecords.userId, userId)))

      return true
    } catch (error) {
      loggerService.error('ShareTransfer', `标记完成失败: ${error}`)
      return false
    }
  }

  /**
   * 删除记录
   */
  async deleteRecord(id: number, userId: number): Promise<boolean> {
    try {
      await this.db
        .delete(shareTransferRecords)
        .where(and(eq(shareTransferRecords.id, id), eq(shareTransferRecords.userId, userId)))

      return true
    } catch (error) {
      loggerService.error('ShareTransfer', `删除记录失败: ${error}`)
      return false
    }
  }

  /**
   * 批量删除记录（使用 inArray 优化）
   */
  async deleteRecords(ids: number[], userId: number): Promise<boolean> {
    try {
      if (ids.length === 0) {
        return true
      }

      // 使用 inArray 进行批量删除，避免 N+1 查询
      await this.db
        .delete(shareTransferRecords)
        .where(
          and(
            inArray(shareTransferRecords.id, ids),
            eq(shareTransferRecords.userId, userId)
          )
        )

      return true
    } catch (error) {
      loggerService.error('ShareTransfer', `批量删除记录失败: ${error}`)
      return false
    }
  }
}

// 导出单例
export const shareTransferService = ShareTransferService.getInstance()
