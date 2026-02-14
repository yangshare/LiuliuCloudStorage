import { ipcMain } from 'electron'
import { shareTransferService } from '../../services/ShareTransferService'
import { loggerService } from '../../services/LoggerService'

/**
 * 验证百度网盘分享链接格式
 */
function isValidBaiduShareUrl(url: string): boolean {
  // 支持标准链接: https://pan.baidu.com/s/xxxxx
  // 支持短链接: https://dwz.cn/xxxxx
  const baiduPattern = /^https?:\/\/(pan\.baidu\.com\/s\/|dwz\.cn\/)[a-zA-Z0-9_-]+/
  return baiduPattern.test(url)
}

/**
 * 验证用户ID是否有效
 */
function isValidUserId(userId: unknown): userId is number {
  return typeof userId === 'number' && userId > 0 && Number.isInteger(userId)
}

/**
 * 注册分享转存相关的 IPC 处理器
 */
export function registerShareTransferHandlers(): void {
  /**
   * 执行分享转存
   */
  ipcMain.handle('shareTransfer:exec', async (_event, params: { url: string; userId: number }) => {
    try {
      // 输入验证
      if (!params || !params.url || !isValidUserId(params.userId)) {
        return {
          success: false,
          message: '参数无效：请提供有效的分享链接和用户ID'
        }
      }

      if (!isValidBaiduShareUrl(params.url)) {
        return {
          success: false,
          message: '请输入有效的百度网盘分享链接（例如：https://pan.baidu.com/s/xxxxx）'
        }
      }

      loggerService.info('ShareTransferHandler', `执行转存请求: ${params.url}`)

      const result = await shareTransferService.execTransfer(params.url, params.userId)

      return {
        success: result.success,
        message: result.message,
        alistPath: result.alistPath,
        recordId: result.recordId
      }
    } catch (error: any) {
      loggerService.error('ShareTransferHandler', '执行转存失败', error)
      return {
        success: false,
        message: error.message || '转存失败'
      }
    }
  })

  /**
   * 获取转存记录列表
   */
  ipcMain.handle('shareTransfer:list', async (_event, params: { userId: number; pageNum?: number; pageSize?: number; status?: string }) => {
    try {
      // 输入验证
      if (!params || !isValidUserId(params.userId)) {
        return {
          success: false,
          records: [],
          total: 0,
          message: '参数无效：请提供有效的用户ID'
        }
      }

      const limit = Math.min(Math.max(params.pageSize || 20, 1), 100) // 限制 1-100
      const offset = Math.max((params.pageNum || 1) - 1, 0) * limit

      const result = await shareTransferService.getRecords(params.userId, {
        limit,
        offset,
        status: params.status
      })

      return {
        success: true,
        records: result.records,
        total: result.total
      }
    } catch (error: any) {
      loggerService.error('ShareTransferHandler', '获取记录列表失败', error)
      return {
        success: false,
        records: [],
        total: 0,
        error: error.message
      }
    }
  })

  /**
   * 获取最新待转存记录
   */
  ipcMain.handle('shareTransfer:latest', async (_event, params: { userId: number }) => {
    try {
      // 输入验证
      if (!params || !isValidUserId(params.userId)) {
        return {
          success: false,
          message: '参数无效：请提供有效的用户ID'
        }
      }

      const record = await shareTransferService.getLatestPending(params.userId)

      return {
        success: true,
        record
      }
    } catch (error: any) {
      loggerService.error('ShareTransferHandler', '获取最新记录失败', error)
      return {
        success: false,
        message: error.message
      }
    }
  })

  /**
   * 标记为已转存
   */
  ipcMain.handle('shareTransfer:complete', async (_event, params: { id: number; userId: number }) => {
    try {
      // 输入验证
      if (!params || !isValidUserId(params.id) || !isValidUserId(params.userId)) {
        return {
          success: false,
          message: '参数无效'
        }
      }

      const success = await shareTransferService.markAsCompleted(params.id, params.userId)

      return {
        success,
        message: success ? '已标记为完成' : '操作失败'
      }
    } catch (error: any) {
      loggerService.error('ShareTransferHandler', '标记完成失败', error)
      return {
        success: false,
        message: error.message
      }
    }
  })

  /**
   * 删除记录
   */
  ipcMain.handle('shareTransfer:delete', async (_event, params: { id: number; userId: number }) => {
    try {
      // 输入验证
      if (!params || !isValidUserId(params.id) || !isValidUserId(params.userId)) {
        return {
          success: false,
          message: '参数无效'
        }
      }

      const success = await shareTransferService.deleteRecord(params.id, params.userId)

      return {
        success,
        message: success ? '删除成功' : '删除失败'
      }
    } catch (error: any) {
      loggerService.error('ShareTransferHandler', '删除记录失败', error)
      return {
        success: false,
        message: error.message
      }
    }
  })

  /**
   * 批量删除记录
   */
  ipcMain.handle('shareTransfer:batchDelete', async (_event, params: { ids: number[]; userId: number }) => {
    try {
      // 输入验证
      if (!params || !Array.isArray(params.ids) || params.ids.length === 0 || !isValidUserId(params.userId)) {
        return {
          success: false,
          message: '参数无效：请提供有效的记录ID列表和用户ID'
        }
      }

      // 验证每个 ID
      if (!params.ids.every(id => isValidUserId(id))) {
        return {
          success: false,
          message: '参数无效：记录ID格式错误'
        }
      }

      const success = await shareTransferService.deleteRecords(params.ids, params.userId)

      return {
        success,
        message: success ? '批量删除成功' : '批量删除失败'
      }
    } catch (error: any) {
      loggerService.error('ShareTransferHandler', '批量删除失败', error)
      return {
        success: false,
        message: error.message
      }
    }
  })
}
