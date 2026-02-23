import axios from 'axios'
import { getDatabase } from '../database'
import { shareTransferRecords } from '../database/schema'
import type { NewShareTransferRecord, ShareTransferRecord } from '../database/schema'
import { count, desc, eq, and, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { loadConfig } from '../config'
import { loggerService } from './LoggerService'

/**
 * 获取转存 Token（从配置文件读取）
 */
function getTransferToken(): string {
  const config = loadConfig()
  if (config.ambTransferToken) {
    return config.ambTransferToken
  }

  loggerService.warn('ShareTransfer', '未配置转存 Token，请在设置中配置')
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
    const fullUrl = `${baseUrl}/bdshare/transfer/exec`
    let recordId: number | undefined = undefined

    try {
      loggerService.info('ShareTransfer', `开始执行转存`)
      loggerService.info('ShareTransfer', `  - 分享链接: ${url}`)
      loggerService.info('ShareTransfer', `  - API地址: ${fullUrl}`)

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
      loggerService.info('ShareTransfer', `  - 本地记录ID: ${recordId}`)

      // 调用三方接口
      const token = getTransferToken()
      if (!token) {
        throw new Error('未配置转存 Token，请在设置中配置')
      }

      // Token 脱敏显示（只显示前4位和后4位）
      const maskedToken = token.length > 8
        ? `${token.substring(0, 4)}****${token.substring(token.length - 4)}`
        : '****'
      loggerService.info('ShareTransfer', `  - Token: ${maskedToken} (长度: ${token.length})`)

      const requestBody = { token, url }
      loggerService.info('ShareTransfer', `  - 请求体: ${JSON.stringify({ token: maskedToken, url })}`)

      const response = await axios.post<AmbApiResponse<string>>(
        fullUrl,
        requestBody,
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      loggerService.info('ShareTransfer', `  - 响应状态码: ${response.status}`)
      loggerService.info('ShareTransfer', `  - 响应数据: ${JSON.stringify(response.data)}`)

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
      loggerService.error('ShareTransfer', `  - 接口返回码: ${result.code}`)

      return {
        success: false,
        message: errorMsg,
        recordId
      }
    } catch (error: any) {
      // 详细记录错误信息
      loggerService.error('ShareTransfer', `转存异常: ${error.message}`)
      loggerService.error('ShareTransfer', `  - API地址: ${fullUrl}`)

      if (error.response) {
        // 服务器返回了响应，但状态码不在 2xx 范围
        loggerService.error('ShareTransfer', `  - 响应状态码: ${error.response.status}`)
        loggerService.error('ShareTransfer', `  - 响应头: ${JSON.stringify(error.response.headers)}`)
        loggerService.error('ShareTransfer', `  - 响应数据: ${JSON.stringify(error.response.data)}`)
      } else if (error.request) {
        // 请求已发出但没有收到响应
        loggerService.error('ShareTransfer', `  - 未收到响应，请求可能超时或网络异常`)
      } else {
        // 请求配置出错
        loggerService.error('ShareTransfer', `  - 请求配置错误: ${error.message}`)
      }

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
