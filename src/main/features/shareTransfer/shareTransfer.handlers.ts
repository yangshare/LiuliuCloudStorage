// src/main/features/shareTransfer/shareTransfer.handlers.ts

import { ipcMain } from 'electron'
import { shareTransferFeatureService } from './shareTransfer.service'
import { IPCError } from '../../core/ipc/error-handler'
import { loggerService } from '../../core/logger/logger.service'

export function registerShareTransferHandlers(): void {
  // 执行分享转存
  ipcMain.handle('shareTransfer:task:exec', async (_event, params: { url: string; userId: number }) => {
    try {
      const result = await shareTransferFeatureService.execTransfer(params.url, params.userId)
      return { success: result.success, message: result.message, alistPath: result.alistPath, recordId: result.recordId }
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '转存失败'
      loggerService.error('ShareTransferHandler', '执行转存失败', error as Error)
      return { success: false, message }
    }
  })

  // 获取转存记录列表
  ipcMain.handle('shareTransfer:task:list', async (_event, params: { userId: number; pageNum?: number; pageSize?: number; status?: string }) => {
    try {
      const result = await shareTransferFeatureService.listRecords(params.userId, params.pageNum, params.pageSize, params.status)
      return { success: true, records: result.records, total: result.total }
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '获取记录列表失败'
      loggerService.error('ShareTransferHandler', '获取记录列表失败', error as Error)
      return { success: false, records: [], total: 0, message }
    }
  })

  // 获取最新待转存记录
  ipcMain.handle('shareTransfer:task:latest', async (_event, params: { userId: number }) => {
    try {
      const record = await shareTransferFeatureService.getLatestPending(params.userId)
      return { success: true, record }
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '获取最新记录失败'
      loggerService.error('ShareTransferHandler', '获取最新记录失败', error as Error)
      return { success: false, message }
    }
  })

  // 标记为已转存
  ipcMain.handle('shareTransfer:task:complete', async (_event, params: { id: number; userId: number }) => {
    try {
      const success = await shareTransferFeatureService.markAsCompleted(params.id, params.userId)
      return { success, message: success ? '已标记为完成' : '操作失败' }
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '标记完成失败'
      loggerService.error('ShareTransferHandler', '标记完成失败', error as Error)
      return { success: false, message }
    }
  })

  // 删除记录
  ipcMain.handle('shareTransfer:task:delete', async (_event, params: { id: number; userId: number }) => {
    try {
      const success = await shareTransferFeatureService.deleteRecord(params.id, params.userId)
      return { success, message: success ? '删除成功' : '删除失败' }
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '删除记录失败'
      loggerService.error('ShareTransferHandler', '删除记录失败', error as Error)
      return { success: false, message }
    }
  })

  // 批量删除记录
  ipcMain.handle('shareTransfer:task:batchDelete', async (_event, params: { ids: number[]; userId: number }) => {
    try {
      const success = await shareTransferFeatureService.deleteRecords(params.ids, params.userId)
      return { success, message: success ? '批量删除成功' : '批量删除失败' }
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '批量删除失败'
      loggerService.error('ShareTransferHandler', '批量删除失败', error as Error)
      return { success: false, message }
    }
  })
}
