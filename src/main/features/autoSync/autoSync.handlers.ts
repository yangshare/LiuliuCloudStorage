// src/main/features/autoSync/autoSync.handlers.ts

import { ipcMain } from 'electron'
import { autoSyncFeatureService } from './autoSync.service'
import { IPCError } from '../../core/ipc/error-handler'
import { loggerService } from '../../services/LoggerService'

export function registerAutoSyncHandlers(): void {
  // 创建并执行自动同步计划
  ipcMain.handle('autoSync:createPlanAndRun', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.createPlanAndRun(params)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '创建自动同步计划失败'
      loggerService.error('AutoSyncHandler', '创建并执行自动同步计划失败', error as Error)
      return { success: false, message }
    }
  })

  // 获取自动同步计划列表
  ipcMain.handle('autoSync:listPlans', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.listPlans(params.userId)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '获取自动同步计划失败'
      loggerService.error('AutoSyncHandler', '获取自动同步计划失败', error as Error)
      return { success: false, plans: [], message }
    }
  })

  // 更新自动同步计划
  ipcMain.handle('autoSync:updatePlan', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.updatePlan(params)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '更新自动同步计划失败'
      loggerService.error('AutoSyncHandler', '更新自动同步计划失败', error as Error)
      return { success: false, message }
    }
  })

  // 暂停自动同步计划
  ipcMain.handle('autoSync:pausePlan', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.pausePlan(params.id, params.userId)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '暂停自动同步计划失败'
      loggerService.error('AutoSyncHandler', '暂停自动同步计划失败', error as Error)
      return { success: false, message }
    }
  })

  // 恢复自动同步计划
  ipcMain.handle('autoSync:resumePlan', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.resumePlan(params.id, params.userId)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '恢复自动同步计划失败'
      loggerService.error('AutoSyncHandler', '恢复自动同步计划失败', error as Error)
      return { success: false, message }
    }
  })

  // 删除自动同步计划
  ipcMain.handle('autoSync:deletePlan', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.deletePlan(params.id, params.userId)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '删除自动同步计划失败'
      loggerService.error('AutoSyncHandler', '删除自动同步计划失败', error as Error)
      return { success: false, message }
    }
  })

  // 执行自动同步计划
  ipcMain.handle('autoSync:runPlan', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.runPlan(params.id, params.userId)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '执行自动同步计划失败'
      loggerService.error('AutoSyncHandler', '执行自动同步计划失败', error as Error)
      return { success: false, message }
    }
  })

  // 获取同步记录列表
  ipcMain.handle('autoSync:listRuns', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.listRuns(params.planId, params.userId, params.limit)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '获取同步记录失败'
      loggerService.error('AutoSyncHandler', '获取同步记录失败', error as Error)
      return { success: false, runs: [], message }
    }
  })

  // 启动时运行自动同步
  ipcMain.handle('autoSync:startupRun', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.runStartupPlans(params.userId)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '启动自动同步失败'
      loggerService.error('AutoSyncHandler', '启动自动同步失败', error as Error)
      return { success: false, message }
    }
  })

  // 重置同步基线
  ipcMain.handle('autoSync:resetBaseline', async (_event, params) => {
    try {
      const result = await autoSyncFeatureService.resetBaseline(params.id, params.userId)
      return result
    } catch (error) {
      const message = error instanceof IPCError ? error.message : '重置同步基线失败'
      loggerService.error('AutoSyncHandler', '重置同步基线失败', error as Error)
      return { success: false, message }
    }
  })
}
