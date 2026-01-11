import { db } from '../database'
import { activityLogs, dailyStats } from '../database/schema'
import type { NewActivityLogs } from '../database/schema'

/**
 * 操作类型枚举
 */
export enum ActionType {
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
  DELETE = 'delete',
  FOLDER_CREATE = 'folder_create',
  LOGIN = 'login',
  LOGOUT = 'logout'
}

/**
 * 活动日志服务
 * 负责记录用户操作日志和统计
 */
export class ActivityService {
  private static instance: ActivityService | null = null

  private constructor() {}

  static getInstance(): ActivityService {
    if (!ActivityService.instance) {
      ActivityService.instance = new ActivityService()
    }
    return ActivityService.instance
  }

  /**
   * 记录操作日志
   */
  async logActivity(params: {
    userId: number
    actionType: ActionType
    fileCount?: number
    fileSize?: number
    ipAddress?: string
    userAgent?: string
    details?: Record<string, any>
  }): Promise<void> {
    try {
      const log: NewActivityLogs = {
        userId: params.userId,
        actionType: params.actionType,
        fileCount: params.fileCount || 0,
        fileSize: params.fileSize || 0,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: params.details ? JSON.stringify(params.details) : null
      }

      await db.insert(activityLogs).values(log)

      // 异步更新每日统计（不等待完成）
      this.updateDailyStats(params.userId, params.actionType, params.fileCount || 0, params.fileSize || 0)
        .catch(error => {
          console.error('[ActivityService] 更新每日统计失败:', error)
        })
    } catch (error) {
      console.error('[ActivityService] 记录操作日志失败:', error)
    }
  }

  /**
   * 更新每日统计
   */
  private async updateDailyStats(
    userId: number,
    actionType: ActionType,
    fileCount: number,
    fileSize: number
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    try {
      // 查询今日是否已有统计记录
      const existing = await db
        .select()
        .from(dailyStats)
        .where(eq(dailyStats.userId, userId))
        .where(eq(dailyStats.date, today))
        .limit(1)

      if (existing.length > 0) {
        // 更新现有记录
        const updateData: Partial<Record<string, number>> = {
          totalFiles: existing[0].totalFiles + fileCount,
          totalSize: existing[0].totalSize + fileSize,
          updatedAt: new Date()
        }

        // 根据操作类型更新对应字段
        switch (actionType) {
          case ActionType.UPLOAD:
            updateData.uploadCount = existing[0].uploadCount + fileCount
            break
          case ActionType.DOWNLOAD:
            updateData.downloadCount = existing[0].downloadCount + fileCount
            break
          case ActionType.DELETE:
            updateData.deleteCount = existing[0].deleteCount + fileCount
            break
          case ActionType.FOLDER_CREATE:
            updateData.folderCreateCount = existing[0].folderCreateCount + fileCount
            break
        }

        await db
          .update(dailyStats)
          .set(updateData)
          .where(eq(dailyStats.id, existing[0].id))
      } else {
        // 创建新记录
        const newStats: NewDailyStats = {
          userId,
          date: today,
          uploadCount: actionType === ActionType.UPLOAD ? fileCount : 0,
          downloadCount: actionType === ActionType.DOWNLOAD ? fileCount : 0,
          deleteCount: actionType === ActionType.DELETE ? fileCount : 0,
          folderCreateCount: actionType === ActionType.FOLDER_CREATE ? fileCount : 0,
          totalFiles: fileCount,
          totalSize: fileSize
        }

        await db.insert(dailyStats).values(newStats)
      }
    } catch (error) {
      console.error('[ActivityService] 更新每日统计失败:', error)
      throw error
    }
  }

  /**
   * 获取用户操作日志
   */
  async getUserLogs(
    userId: number,
    options?: {
      limit?: number
      offset?: number
      actionType?: ActionType
      startDate?: Date
      endDate?: Date
    }
  ): Promise<{ logs: any[]; total: number }> {
    try {
      let query = db
        .select({
          id: activityLogs.id,
          actionType: activityLogs.actionType,
          fileCount: activityLogs.fileCount,
          fileSize: activityLogs.fileSize,
          createdAt: activityLogs.createdAt,
          details: activityLogs.details
        })
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))

      // 添加筛选条件
      if (options?.actionType) {
        query = query.where(eq(activityLogs.actionType, options.actionType))
      }

      if (options?.startDate) {
        query = query.where(gte(activityLogs.createdAt, options.startDate))
      }

      if (options?.endDate) {
        query = query.where(lte(activityLogs.createdAt, options.endDate))
      }

      // 获取总数
      const total = await query

      // 应用分页和排序
      const logs = await query
        .orderBy(desc(activityLogs.createdAt))
        .limit(options?.limit || 50)
        .offset(options?.offset || 0)

      return { logs, total: logs.length }
    } catch (error) {
      console.error('[ActivityService] 获取用户日志失败:', error)
      return { logs: [], total: 0 }
    }
  }

  /**
   * 获取所有用户的操作日志（管理员）
   */
  async getAllLogs(options?: {
    limit?: number
    offset?: number
    userId?: number
    actionType?: ActionType
    startDate?: Date
    endDate?: Date
  }): Promise<{ logs: any[]; total: number }> {
    try {
      let query = db
        .select({
          id: activityLogs.id,
          userId: activityLogs.userId,
          actionType: activityLogs.actionType,
          fileCount: activityLogs.fileCount,
          fileSize: activityLogs.fileSize,
          createdAt: activityLogs.createdAt,
          details: activityLogs.details
        })
        .from(activityLogs)

      // 添加筛选条件
      if (options?.userId) {
        query = query.where(eq(activityLogs.userId, options.userId))
      }

      if (options?.actionType) {
        query = query.where(eq(activityLogs.actionType, options.actionType))
      }

      if (options?.startDate) {
        query = query.where(gte(activityLogs.createdAt, options.startDate))
      }

      if (options?.endDate) {
        query = query.where(lte(activityLogs.createdAt, options.endDate))
      }

      // 应用分页和排序
      const logs = await query
        .orderBy(desc(activityLogs.createdAt))
        .limit(options?.limit || 100)
        .offset(options?.offset || 0)

      return { logs, total: logs.length }
    } catch (error) {
      console.error('[ActivityService] 获取所有日志失败:', error)
      return { logs: [], total: 0 }
    }
  }

  /**
   * 获取每日活跃用户数（DAU）
   */
  async getDailyActiveUsers(date?: string): Promise<number> {
    const targetDate = date || new Date().toISOString().split('T')[0]

    try {
      const result = await db
        .select()
        .from(dailyStats)
        .where(eq(dailyStats.date, targetDate))

      return result.length
    } catch (error) {
      console.error('[ActivityService] 获取DAU失败:', error)
      return 0
    }
  }

  /**
   * 获取用户统计数据
   */
  async getUserStats(userId: number, startDate?: Date, endDate?: Date): Promise<{
    totalOperations: number
    uploadCount: number
    downloadCount: number
    totalSize: number
  }> {
    try {
      let query = db
        .select()
        .from(dailyStats)
        .where(eq(dailyStats.userId, userId))

      if (startDate) {
        query = query.where(gte(dailyStats.date, startDate.toISOString().split('T')[0]))
      }

      if (endDate) {
        query = query.where(lte(dailyStats.date, endDate.toISOString().split('T')[0]))
      }

      const stats = await query

      return {
        totalOperations: stats.reduce((sum, s) => sum + s.totalFiles, 0),
        uploadCount: stats.reduce((sum, s) => sum + s.uploadCount, 0),
        downloadCount: stats.reduce((sum, s) => sum + s.downloadCount, 0),
        totalSize: stats.reduce((sum, s) => sum + s.totalSize, 0)
      }
    } catch (error) {
      console.error('[ActivityService] 获取用户统计失败:', error)
      return {
        totalOperations: 0,
        uploadCount: 0,
        downloadCount: 0,
        totalSize: 0
      }
    }
  }
}

// 导出单例
export const activityService = ActivityService.getInstance()

// 导出辅助函数（如果需要使用 eq, gte, lte, desc）
import { eq, gte, lte, desc } from 'drizzle-orm'
