import { activityService, type ActionType } from '../../services/ActivityService'

export interface LogActivityParams {
  userId: number
  actionType: ActionType
  fileCount?: number
  fileSize?: number
  ipAddress?: string
  userAgent?: string
  details?: Record<string, any>
}

export interface LogQueryOptions {
  limit?: number
  offset?: number
  actionType?: ActionType
  startDate?: string
  endDate?: string
}

function parseDateOptions(options?: LogQueryOptions) {
  if (!options) return undefined
  return {
    ...options,
    startDate: options.startDate ? new Date(options.startDate) : undefined,
    endDate: options.endDate ? new Date(options.endDate) : undefined
  }
}

export class ActivityFeatureService {
  async logActivity(params: LogActivityParams): Promise<void> {
    await activityService.logActivity(params)
  }

  async getUserLogs(userId: number, options?: LogQueryOptions) {
    return activityService.getUserLogs(userId, parseDateOptions(options))
  }

  async getAllLogs(options?: LogQueryOptions & { userId?: number }) {
    return activityService.getAllLogs(parseDateOptions(options))
  }

  async getDailyActiveUsers(date?: string) {
    const dau = await activityService.getDailyActiveUsers(date)
    return { dau }
  }

  async getUserStats(userId: number, startDate?: string, endDate?: string) {
    const stats = await activityService.getUserStats(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    )
    return { stats }
  }
}

export const activityFeatureService = new ActivityFeatureService()
