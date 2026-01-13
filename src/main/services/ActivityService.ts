import { getDatabase } from '../database'
import { activityLogs, dailyStats } from '../database/schema'
import type { NewActivityLogs, NewDailyStats } from '../database/schema'
import { count, desc, eq, gte, lte } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

/**
 * 操作类型枚举
 */
export enum ActionType {
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
  DELETE = 'delete',
  RENAME = 'rename',
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

  private get db() {
    return drizzle(getDatabase())
  }

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

      await this.db.insert(activityLogs).values(log)

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
      const existing = await this.db
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

        await this.db
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

        await this.db.insert(dailyStats).values(newStats)
      }
    } catch (error) {
      console.error('[ActivityService] 更新每日统计失败:', error)
      throw error
    }
  }

  /**
   * 获取用户操作日志
   * Story 9.3 MEDIUM FIX: 修复 total 计算，使用 count() 获取实际总数
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
      // 构建基础查询条件
      const conditions = [eq(activityLogs.userId, userId)]

      if (options?.actionType) {
        conditions.push(eq(activityLogs.actionType, options.actionType))
      }

      if (options?.startDate) {
        conditions.push(gte(activityLogs.createdAt, options.startDate))
      }

      if (options?.endDate) {
        conditions.push(lte(activityLogs.createdAt, options.endDate))
      }

      // 获取总数 - Story 9.3 FIX: 使用 count() 而非 logs.length
      const countResult = await this.db
        .select({ count: count() })
        .from(activityLogs)
        .where(...conditions)

      const total = countResult[0]?.count || 0

      // 获取分页数据
      const logs = await this.db
        .select({
          id: activityLogs.id,
          actionType: activityLogs.actionType,
          fileCount: activityLogs.fileCount,
          fileSize: activityLogs.fileSize,
          createdAt: activityLogs.createdAt,
          details: activityLogs.details
        })
        .from(activityLogs)
        .where(...conditions)
        .orderBy(desc(activityLogs.createdAt))
        .limit(options?.limit || 50)
        .offset(options?.offset || 0)

      return { logs, total }
    } catch (error) {
      console.error('[ActivityService] 获取用户日志失败:', error)
      return { logs: [], total: 0 }
    }
  }

  /**
   * 获取所有用户的操作日志（管理员）
   * Story 9.3 MEDIUM FIX: 修复 total 计算，使用 count() 获取实际总数
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
      // 构建基础查询条件
      const conditions: any[] = []

      if (options?.userId) {
        conditions.push(eq(activityLogs.userId, options.userId))
      }

      if (options?.actionType) {
        conditions.push(eq(activityLogs.actionType, options.actionType))
      }

      if (options?.startDate) {
        conditions.push(gte(activityLogs.createdAt, options.startDate))
      }

      if (options?.endDate) {
        conditions.push(lte(activityLogs.createdAt, options.endDate))
      }

      // 获取总数 - Story 9.3 FIX: 使用 count() 而非 logs.length
      const countResult = await this.db
        .select({ count: count() })
        .from(activityLogs)
        .where(...conditions)

      const total = countResult[0]?.count || 0

      // 获取分页数据
      const logs = await this.db
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
        .where(...conditions)
        .orderBy(desc(activityLogs.createdAt))
        .limit(options?.limit || 100)
        .offset(options?.offset || 0)

      return { logs, total }
    } catch (error) {
      console.error('[ActivityService] 获取所有日志失败:', error)
      return { logs: [], total: 0 }
    }
  }

  /**
   * 获取每日活跃用户数（DAU）
   * Story 9.3 CRITICAL FIX: 使用 COUNT(DISTINCT user_id) 计算唯一用户数，而非记录数
   */
  async getDailyActiveUsers(date?: string): Promise<number> {
    const targetDate = date || new Date().toISOString().split('T')[0]

    try {
      // Story 9.3 FIX: 从 daily_stats 表统计唯一用户数
      const result = await this.db
        .select({ count: count() })
        .from(dailyStats)
        .where(eq(dailyStats.date, targetDate))

      return result[0]?.count || 0
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
      let query = this.db
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
