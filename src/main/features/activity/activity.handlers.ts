import { ipcMain } from 'electron'
import { activityFeatureService } from './activity.service'
import { IPCError } from '../../core/ipc/error-handler'
import { loggerService } from '../../core/logger/logger.service'

export function registerActivityHandlers(): void {
  ipcMain.handle('activity:log:create', async (_, params) => {
    try {
      await activityFeatureService.logActivity(params)
      return { success: true }
    } catch (error: any) {
      loggerService.error('ActivityHandler', '记录日志失败', error)
      return { success: false, error: error instanceof IPCError ? error.message : '记录日志失败' }
    }
  })

  ipcMain.handle('activity:log:get-user-logs', async (_, userId, options) => {
    try {
      return await activityFeatureService.getUserLogs(userId, options)
    } catch (error: any) {
      loggerService.error('ActivityHandler', '获取用户日志失败', error)
      return { success: false, error: error instanceof IPCError ? error.message : '获取用户日志失败' }
    }
  })

  ipcMain.handle('activity:log:get-all-logs', async (_, options) => {
    try {
      return await activityFeatureService.getAllLogs(options)
    } catch (error: any) {
      loggerService.error('ActivityHandler', '获取所有日志失败', error)
      return { success: false, error: error instanceof IPCError ? error.message : '获取所有日志失败' }
    }
  })

  ipcMain.handle('activity:analytics:get-dau', async (_, date) => {
    try {
      const result = await activityFeatureService.getDailyActiveUsers(date)
      return { success: true, ...result }
    } catch (error: any) {
      loggerService.error('ActivityHandler', '获取DAU失败', error)
      return { success: false, error: error instanceof IPCError ? error.message : '获取DAU失败' }
    }
  })

  ipcMain.handle('activity:analytics:get-user-stats', async (_, userId, startDate, endDate) => {
    try {
      const result = await activityFeatureService.getUserStats(userId, startDate, endDate)
      return { success: true, ...result }
    } catch (error: any) {
      loggerService.error('ActivityHandler', '获取用户统计失败', error)
      return { success: false, error: error instanceof IPCError ? error.message : '获取用户统计失败' }
    }
  })
}
