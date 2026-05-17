// src/main/features/autoSync/autoSync.service.ts

import { autoSyncService, type AutoSyncConflictPolicy } from '../../services/AutoSyncService'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'
import { authService } from '../auth/auth.service'

/**
 * AutoSync Feature Service
 * 负责参数验证、权限检查和调用底层 AutoSyncService
 */
export class AutoSyncFeatureService {
  /**
   * 验证用户ID是否有效
   */
  private isValidUserId(userId: unknown): userId is number {
    return typeof userId === 'number' && userId > 0 && Number.isInteger(userId)
  }

  /**
   * 获取当前会话，未登录则抛错
   */
  private getSessionOrThrow(): { userId: number; username: string; token: string } {
    const session = authService.getCurrentSession()
    if (!session) {
      throw new IPCError('用户未登录', IPCErrorCode.UNAUTHORIZED)
    }
    return session
  }

  /**
   * 断言当前用户有权操作指定用户的数据
   */
  private assertOwnUser(userId: number): { userId: number; username: string; token: string } {
    const session = this.getSessionOrThrow()
    if (session.userId !== userId) {
      throw new IPCError('无权操作该用户的自动同步计划', IPCErrorCode.FORBIDDEN)
    }
    return session
  }

  /**
   * 验证冲突策略是否有效
   */
  private isValidConflictPolicy(policy: unknown): policy is AutoSyncConflictPolicy {
    return policy === 'skip_existing' || policy === 'rename_remote' || policy === 'overwrite'
  }

  /**
   * 规范化冲突策略
   */
  private normalizeConflictPolicy(policy: unknown): AutoSyncConflictPolicy {
    return this.isValidConflictPolicy(policy) ? policy : 'skip_existing'
  }

  /**
   * 创建并执行自动同步计划
   */
  async createPlanAndRun(params: {
    userId: number
    name?: string
    shareUrl: string
    localSyncDir: string
    expiresAt: number
    autoRunOnStartup?: boolean
    conflictPolicy?: AutoSyncConflictPolicy
  }): Promise<{ success: boolean; plan?: any; run?: any; message?: string }> {
    if (!params || !this.isValidUserId(params.userId)) {
      throw new IPCError('参数无效：请提供有效的用户ID', IPCErrorCode.VALIDATION)
    }
    const session = this.assertOwnUser(params.userId)
    return await autoSyncService.createPlanAndRun({
      userId: params.userId,
      name: params.name,
      shareUrl: params.shareUrl,
      localSyncDir: params.localSyncDir,
      expiresAt: params.expiresAt,
      autoRunOnStartup: params.autoRunOnStartup,
      conflictPolicy: this.normalizeConflictPolicy(params.conflictPolicy)
    }, session)
  }

  /**
   * 获取自动同步计划列表
   */
  async listPlans(userId: number): Promise<{ success: boolean; plans: any[]; message?: string }> {
    if (!this.isValidUserId(userId)) {
      throw new IPCError('参数无效：请提供有效的用户ID', IPCErrorCode.VALIDATION)
    }
    this.assertOwnUser(userId)
    const plans = await autoSyncService.listPlans(userId)
    return { success: true, plans }
  }

  /**
   * 更新自动同步计划
   */
  async updatePlan(params: {
    id: number
    userId: number
    updates: {
      name?: string
      localSyncDir?: string
      expiresAt?: number
      autoRunOnStartup?: boolean
      conflictPolicy?: AutoSyncConflictPolicy
    }
  }): Promise<{ success: boolean; plan?: any; message?: string }> {
    if (!params || !this.isValidUserId(params.id) || !this.isValidUserId(params.userId)) {
      throw new IPCError('参数无效', IPCErrorCode.VALIDATION)
    }
    this.assertOwnUser(params.userId)
    const plan = await autoSyncService.updatePlan(params.id, params.userId, {
      ...params.updates,
      conflictPolicy: params.updates?.conflictPolicy
        ? this.normalizeConflictPolicy(params.updates.conflictPolicy)
        : undefined
    })
    return { success: true, plan }
  }

  /**
   * 暂停自动同步计划
   */
  async pausePlan(id: number, userId: number): Promise<{ success: boolean; message?: string }> {
    if (!this.isValidUserId(id) || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效', IPCErrorCode.VALIDATION)
    }
    this.assertOwnUser(userId)
    await autoSyncService.pausePlan(id, userId)
    return { success: true }
  }

  /**
   * 恢复自动同步计划
   */
  async resumePlan(id: number, userId: number): Promise<{ success: boolean; message?: string }> {
    if (!this.isValidUserId(id) || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效', IPCErrorCode.VALIDATION)
    }
    this.assertOwnUser(userId)
    await autoSyncService.resumePlan(id, userId)
    return { success: true }
  }

  /**
   * 删除自动同步计划
   */
  async deletePlan(id: number, userId: number): Promise<{ success: boolean; message?: string }> {
    if (!this.isValidUserId(id) || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效', IPCErrorCode.VALIDATION)
    }
    this.assertOwnUser(userId)
    await autoSyncService.deletePlan(id, userId)
    return { success: true }
  }

  /**
   * 执行自动同步计划
   */
  async runPlan(id: number, userId: number): Promise<{ success: boolean; run?: any; message?: string }> {
    if (!this.isValidUserId(id) || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效', IPCErrorCode.VALIDATION)
    }
    const session = this.assertOwnUser(userId)
    return await autoSyncService.runPlan(id, session, 'manual')
  }

  /**
   * 获取同步记录列表
   */
  async listRuns(planId: number, userId: number, limit?: number): Promise<{ success: boolean; runs: any[]; message?: string }> {
    if (!this.isValidUserId(planId) || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效', IPCErrorCode.VALIDATION)
    }
    this.assertOwnUser(userId)
    const runs = await autoSyncService.listRuns(planId, userId, limit)
    return { success: true, runs }
  }

  /**
   * 启动时运行自动同步计划
   */
  async runStartupPlans(userId: number): Promise<{ success: boolean; total?: number; executed?: number; skipped?: number; failed?: number; message?: string }> {
    if (!this.isValidUserId(userId)) {
      throw new IPCError('参数无效：请提供有效的用户ID', IPCErrorCode.VALIDATION)
    }
    const session = this.assertOwnUser(userId)
    return await autoSyncService.runStartupPlans(session)
  }

  /**
   * 重置同步基线
   */
  async resetBaseline(id: number, userId: number): Promise<{ success: boolean; run?: any; message?: string }> {
    if (!this.isValidUserId(id) || !this.isValidUserId(userId)) {
      throw new IPCError('参数无效', IPCErrorCode.VALIDATION)
    }
    const session = this.assertOwnUser(userId)
    return await autoSyncService.resetBaseline(id, userId, session)
  }
}

export const autoSyncFeatureService = new AutoSyncFeatureService()
