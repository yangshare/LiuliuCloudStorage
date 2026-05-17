import { ipcMain, BrowserWindow } from 'electron'
import { autoSyncService, type AutoSyncConflictPolicy, type AutoSyncProgressEvent } from '../../services/AutoSyncService'
import { loggerService } from '../../services/LoggerService'
import { authService } from '../../features/auth/auth.service'

function broadcastProgress(planId: number, event: AutoSyncProgressEvent): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('autoSync:progress', { planId, ...event })
  })
}

autoSyncService.setProgressCallback((planId, event) => {
  broadcastProgress(planId, event)
})

function getSessionOrThrow(): { userId: number; username: string; token: string } {
  const session = authService.getCurrentSession()
  if (!session) {
    throw new Error('用户未登录')
  }
  return session
}

function isValidUserId(userId: unknown): userId is number {
  return typeof userId === 'number' && userId > 0 && Number.isInteger(userId)
}

function assertOwnUser(userId: number): { userId: number; username: string; token: string } {
  const session = getSessionOrThrow()
  if (session.userId !== userId) {
    throw new Error('无权操作该用户的自动同步计划')
  }
  return session
}

function isValidConflictPolicy(policy: unknown): policy is AutoSyncConflictPolicy {
  return policy === 'skip_existing' || policy === 'rename_remote' || policy === 'overwrite'
}

function normalizeConflictPolicy(policy: unknown): AutoSyncConflictPolicy {
  return isValidConflictPolicy(policy) ? policy : 'skip_existing'
}

export function registerAutoSyncHandlers(): void {
  ipcMain.handle('autoSync:createPlanAndRun', async (_event, params: {
    userId: number
    name?: string
    shareUrl: string
    localSyncDir: string
    expiresAt: number
    autoRunOnStartup?: boolean
    conflictPolicy?: AutoSyncConflictPolicy
  }) => {
    try {
      if (!params || !isValidUserId(params.userId)) {
        return { success: false, message: '参数无效：请提供有效的用户ID' }
      }
      const session = assertOwnUser(params.userId)
      const result = await autoSyncService.createPlanAndRun({
        userId: params.userId,
        name: params.name,
        shareUrl: params.shareUrl,
        localSyncDir: params.localSyncDir,
        expiresAt: params.expiresAt,
        autoRunOnStartup: params.autoRunOnStartup,
        conflictPolicy: normalizeConflictPolicy(params.conflictPolicy)
      }, session)
      return result
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '创建并执行自动同步计划失败', error)
      return { success: false, message: error.message || '创建自动同步计划失败' }
    }
  })

  ipcMain.handle('autoSync:listPlans', async (_event, params: { userId: number }) => {
    try {
      if (!params || !isValidUserId(params.userId)) {
        return { success: false, plans: [], message: '参数无效：请提供有效的用户ID' }
      }
      assertOwnUser(params.userId)
      const plans = await autoSyncService.listPlans(params.userId)
      return { success: true, plans }
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '获取自动同步计划失败', error)
      return { success: false, plans: [], message: error.message || '获取自动同步计划失败' }
    }
  })

  ipcMain.handle('autoSync:updatePlan', async (_event, params: {
    id: number
    userId: number
    updates: {
      name?: string
      localSyncDir?: string
      expiresAt?: number
      autoRunOnStartup?: boolean
      conflictPolicy?: AutoSyncConflictPolicy
    }
  }) => {
    try {
      if (!params || !isValidUserId(params.id) || !isValidUserId(params.userId)) {
        return { success: false, message: '参数无效' }
      }
      assertOwnUser(params.userId)
      const plan = await autoSyncService.updatePlan(params.id, params.userId, {
        ...params.updates,
        conflictPolicy: params.updates?.conflictPolicy
          ? normalizeConflictPolicy(params.updates.conflictPolicy)
          : undefined
      })
      return { success: true, plan }
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '更新自动同步计划失败', error)
      return { success: false, message: error.message || '更新自动同步计划失败' }
    }
  })

  ipcMain.handle('autoSync:pausePlan', async (_event, params: { id: number; userId: number }) => {
    try {
      if (!params || !isValidUserId(params.id) || !isValidUserId(params.userId)) {
        return { success: false, message: '参数无效' }
      }
      assertOwnUser(params.userId)
      await autoSyncService.pausePlan(params.id, params.userId)
      return { success: true }
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '暂停自动同步计划失败', error)
      return { success: false, message: error.message || '暂停自动同步计划失败' }
    }
  })

  ipcMain.handle('autoSync:resumePlan', async (_event, params: { id: number; userId: number }) => {
    try {
      if (!params || !isValidUserId(params.id) || !isValidUserId(params.userId)) {
        return { success: false, message: '参数无效' }
      }
      assertOwnUser(params.userId)
      await autoSyncService.resumePlan(params.id, params.userId)
      return { success: true }
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '恢复自动同步计划失败', error)
      return { success: false, message: error.message || '恢复自动同步计划失败' }
    }
  })

  ipcMain.handle('autoSync:deletePlan', async (_event, params: { id: number; userId: number }) => {
    try {
      if (!params || !isValidUserId(params.id) || !isValidUserId(params.userId)) {
        return { success: false, message: '参数无效' }
      }
      assertOwnUser(params.userId)
      await autoSyncService.deletePlan(params.id, params.userId)
      return { success: true }
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '删除自动同步计划失败', error)
      return { success: false, message: error.message || '删除自动同步计划失败' }
    }
  })

  ipcMain.handle('autoSync:runPlan', async (_event, params: { id: number; userId: number }) => {
    try {
      if (!params || !isValidUserId(params.id) || !isValidUserId(params.userId)) {
        return { success: false, message: '参数无效' }
      }
      const session = assertOwnUser(params.userId)
      const result = await autoSyncService.runPlan(params.id, session, 'manual')
      return result
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '执行自动同步计划失败', error)
      return { success: false, message: error.message || '执行自动同步计划失败' }
    }
  })

  ipcMain.handle('autoSync:listRuns', async (_event, params: { planId: number; userId: number; limit?: number }) => {
    try {
      if (!params || !isValidUserId(params.planId) || !isValidUserId(params.userId)) {
        return { success: false, runs: [], message: '参数无效' }
      }
      assertOwnUser(params.userId)
      const runs = await autoSyncService.listRuns(params.planId, params.userId, params.limit)
      return { success: true, runs }
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '获取同步记录失败', error)
      return { success: false, runs: [], message: error.message || '获取同步记录失败' }
    }
  })

  ipcMain.handle('autoSync:startupRun', async (_event, params: { userId: number }) => {
    try {
      if (!params || !isValidUserId(params.userId)) {
        return { success: false, message: '参数无效：请提供有效的用户ID' }
      }
      const session = assertOwnUser(params.userId)
      const result = await autoSyncService.runStartupPlans(session)
      return result
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '启动自动同步失败', error)
      return { success: false, message: error.message || '启动自动同步失败' }
    }
  })

  ipcMain.handle('autoSync:resetBaseline', async (_event, params: { id: number; userId: number }) => {
    try {
      if (!params || !isValidUserId(params.id) || !isValidUserId(params.userId)) {
        return { success: false, message: '参数无效' }
      }
      const session = assertOwnUser(params.userId)
      const result = await autoSyncService.resetBaseline(params.id, params.userId, session)
      return result
    } catch (error: any) {
      loggerService.error('AutoSyncHandler', '重置同步基线失败', error)
      return { success: false, message: error.message || '重置同步基线失败' }
    }
  })
}
