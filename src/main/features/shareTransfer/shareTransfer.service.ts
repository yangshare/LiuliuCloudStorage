// src/main/features/shareTransfer/shareTransfer.service.ts

import { shareTransferService } from './share-transfer.core.service'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'
import { loggerService } from '../../core/logger/logger.service'

export interface ExecTransferResult {
  success: boolean
  message: string
  alistPath?: string
  recordId?: number
}

export interface ListRecordsResult {
  success: boolean
  records: any[]
  total: number
  message?: string
}

/**
 * ShareTransfer Feature Service
 * 负责参数验证和调用底层 ShareTransferService
 */
export class ShareTransferFeatureService {
  /**
   * 验证百度网盘分享链接格式
   */
  private isValidBaiduShareUrl(url: string): boolean {
    const baiduPattern = /^https?:\/\/(pan\.baidu\.com\/s\/|dwz\.cn\/)[a-zA-Z0-9_-]+/
    return baiduPattern.test(url)
  }

  /**
   * 验证用户ID是否有效
   */
  private isValidUserId(userId: unknown): userId is number {
    return typeof userId === 'number' && userId > 0 && Number.isInteger(userId)
  }

  /**
   * 执行分享转存
   */
  async execTransfer(url: string, userId: number): Promise<ExecTransferResult> {
    if (!url || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效：请提供有效的分享链接和用户ID', IPCErrorCode.VALIDATION)
    }
    if (!this.isValidBaiduShareUrl(url)) {
      throw new IPCError('请输入有效的百度网盘分享链接（例如：https://pan.baidu.com/s/xxxxx）', IPCErrorCode.VALIDATION)
    }

    loggerService.info('ShareTransferFeatureService', `执行转存请求: ${url}`)
    const result = await shareTransferService.execTransfer(url, userId)
    return result
  }

  /**
   * 获取转存记录列表
   */
  async listRecords(
    userId: number,
    pageNum?: number,
    pageSize?: number,
    status?: string
  ): Promise<{ records: any[]; total: number }> {
    if (!this.isValidUserId(userId)) {
      throw new IPCError('参数无效：请提供有效的用户ID', IPCErrorCode.VALIDATION)
    }

    const limit = Math.min(Math.max(pageSize || 20, 1), 100)
    const offset = Math.max((pageNum || 1) - 1, 0) * limit

    return await shareTransferService.getRecords(userId, { limit, offset, status })
  }

  /**
   * 获取最新待转存记录
   */
  async getLatestPending(userId: number): Promise<any | null> {
    if (!this.isValidUserId(userId)) {
      throw new IPCError('参数无效：请提供有效的用户ID', IPCErrorCode.VALIDATION)
    }

    return await shareTransferService.getLatestPending(userId)
  }

  /**
   * 标记为已转存
   */
  async markAsCompleted(id: number, userId: number): Promise<boolean> {
    if (!this.isValidUserId(id) || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效', IPCErrorCode.VALIDATION)
    }

    return await shareTransferService.markAsCompleted(id, userId)
  }

  /**
   * 删除记录
   */
  async deleteRecord(id: number, userId: number): Promise<boolean> {
    if (!this.isValidUserId(id) || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效', IPCErrorCode.VALIDATION)
    }

    return await shareTransferService.deleteRecord(id, userId)
  }

  /**
   * 批量删除记录
   */
  async deleteRecords(ids: number[], userId: number): Promise<boolean> {
    if (!Array.isArray(ids) || ids.length === 0 || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效：请提供有效的记录ID列表和用户ID', IPCErrorCode.VALIDATION)
    }
    if (!ids.every(id => this.isValidUserId(id))) {
      throw new IPCError('参数无效：记录ID格式错误', IPCErrorCode.VALIDATION)
    }

    return await shareTransferService.deleteRecords(ids, userId)
  }
}

export const shareTransferFeatureService = new ShareTransferFeatureService()
