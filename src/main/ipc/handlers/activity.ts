import { ipcMain } from 'electron'
import { activityService, ActionType } from '../../services/ActivityService'

/**
 * 注册活动日志相关的IPC处理器
 */
export function registerActivityHandlers(): void {
  // 记录操作日志
  ipcMain.handle(
    'activity:log',
    (_, params: {
      userId: number
      actionType: ActionType
      fileCount?: number
      fileSize?: number
      ipAddress?: string
      userAgent?: string
      details?: Record<string, any>
    }) => {
      activityService.logActivity(params)
      return { success: true }
    }
  )

  // 获取用户操作日志
  ipcMain.handle(
    'activity:get-user-logs',
    async (_, userId: number, options?: {
      limit?: number
      offset?: number
      actionType?: ActionType
      startDate?: string
      endDate?: string
    }) => {
      const parsedOptions = {
        ...options,
        startDate: options?.startDate ? new Date(options.startDate) : undefined,
        endDate: options?.endDate ? new Date(options.endDate) : undefined
      }
      return await activityService.getUserLogs(userId, parsedOptions)
    }
  )

  // 获取所有用户操作日志（管理员）
  ipcMain.handle(
    'activity:get-all-logs',
    async (_, options?: {
      limit?: number
      offset?: number
      userId?: number
      actionType?: ActionType
      startDate?: string
      endDate?: string
    }) => {
      const parsedOptions = {
        ...options,
        startDate: options?.startDate ? new Date(options.startDate) : undefined,
        endDate: options?.endDate ? new Date(options.endDate) : undefined
      }
      return await activityService.getAllLogs(parsedOptions)
    }
  )

  // 获取每日活跃用户数
  ipcMain.handle('activity:get-dau', async (_, date?: string) => {
    const dau = await activityService.getDailyActiveUsers(date)
    return { success: true, dau }
  })

  // 获取用户统计数据
  ipcMain.handle(
    'activity:get-user-stats',
    async (_, userId: number, startDate?: string, endDate?: string) => {
      const stats = await activityService.getUserStats(
        userId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      )
      return { success: true, stats }
    }
  )
}
