import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../../database'
import { SQLITE_BATCH_SIZE } from '../../database/constants'
import { alistService } from '../../core/api/alist.service'
import { shareTransferService } from '../shareTransfer/share-transfer.core.service'
import { downloadQueueManager, type DownloadQueueTask } from '../transfer/download-queue.manager'
import { loggerService } from '../../core/logger/logger.service'
import { SimplePQueue } from '../../utils/SimplePQueue'
import { authService, type AuthSession } from '../auth/auth.service'
import {
  AlistAuthError,
  ALIST_AUTH_EXPIRED_SYNC_MESSAGE,
  isAlistAuthError
} from '../../core/api/alist-auth-error'

export type AutoSyncPlanStatus = 'enabled' | 'paused' | 'syncing' | 'expired' | 'failed' | 'deleted'
export type AutoSyncRunStatus = 'running' | 'completed' | 'partial_failed' | 'failed' | 'skipped'
export type AutoSyncTriggerType = 'startup' | 'manual' | 'created'
export type AutoSyncConflictPolicy = 'skip_existing' | 'rename_remote' | 'overwrite'

export interface AutoSyncPlanRow {
  id: number
  userId: number
  name: string
  shareUrl: string
  shareCode: string | null
  localSyncDir: string
  lastAlistPath: string | null
  status: AutoSyncPlanStatus
  expiresAt: number
  autoRunOnStartup: boolean
  conflictPolicy: AutoSyncConflictPolicy
  lastSyncAt: number | null
  lastSuccessAt: number | null
  lastErrorMessage: string | null
  createdAt: number
  updatedAt: number
  latestRun?: AutoSyncRunRow | null
}

export interface AutoSyncRunRow {
  id: number
  planId: number
  userId: number
  triggerType: AutoSyncTriggerType
  status: AutoSyncRunStatus
  alistPath: string | null
  remoteFileCount: number
  localFileCount: number
  missingFileCount: number
  queuedDownloadCount: number
  skippedCount: number
  failedCount: number
  errorMessage: string | null
  startedAt: number
  finishedAt: number | null
}

export interface AutoSyncRemoteSnapshot {
  id: number
  planId: number
  relativePath: string
  fileSize: number
  firstSeenAt: number
  lastVerifiedAt: number
}

export interface AutoSyncProgressEvent {
  stage: 'transfer' | 'scan' | 'diff' | 'queue' | 'complete'
  status: 'started' | 'in_progress' | 'completed' | 'failed'
  message?: string
  current?: number
  total?: number
}

export interface CreateAutoSyncPlanParams {
  userId: number
  name?: string
  shareUrl: string
  localSyncDir: string
  expiresAt: number
  autoRunOnStartup?: boolean
  conflictPolicy?: AutoSyncConflictPolicy
}

export interface UpdateAutoSyncPlanParams {
  name?: string
  localSyncDir?: string
  expiresAt?: number
  autoRunOnStartup?: boolean
  conflictPolicy?: AutoSyncConflictPolicy
}

interface RemoteFile {
  relativePath: string
  remotePath: string
  fileName: string
  fileSize: number
  modified: string
}

interface DiffFile extends RemoteFile {
  savePath: string
}

function now(): number {
  return Date.now()
}

function toRow(row: any): AutoSyncPlanRow {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    shareUrl: row.share_url,
    shareCode: row.share_code,
    localSyncDir: row.local_sync_dir,
    lastAlistPath: row.last_alist_path,
    status: row.status,
    expiresAt: row.expires_at,
    autoRunOnStartup: row.auto_run_on_startup === 1,
    conflictPolicy: row.conflict_policy,
    lastSyncAt: row.last_sync_at,
    lastSuccessAt: row.last_success_at,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toRunRow(row: any): AutoSyncRunRow {
  return {
    id: row.id,
    planId: row.plan_id,
    userId: row.user_id,
    triggerType: row.trigger_type,
    status: row.status,
    alistPath: row.alist_path,
    remoteFileCount: row.remote_file_count,
    localFileCount: row.local_file_count,
    missingFileCount: row.missing_file_count,
    queuedDownloadCount: row.queued_download_count,
    skippedCount: row.skipped_count,
    failedCount: row.failed_count,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }
}

function extractShareCode(url: string): string | null {
  const match = url.match(/\/s\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function getDefaultPlanName(url: string): string {
  const code = extractShareCode(url)
  return code ? `分享同步 ${code}` : `分享同步 ${new Date().toLocaleDateString('zh-CN')}`
}

function sanitizeSegment(segment: string): string {
  const reserved = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i
  let value = segment.replace(/[\\/:*?"<>|]/g, '_').replace(/[\s.]+$/, '')
  if (reserved.test(value)) value = `_${value}`
  return value || '_'
}

function buildSafeLocalPath(rootDir: string, relativePath: string): string {
  const parts = relativePath.split('/').filter(Boolean).map(sanitizeSegment)
  const target = path.resolve(rootDir, ...parts)
  const root = path.resolve(rootDir)
  const rel = path.relative(root, target)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('下载路径超出本机同步目录')
  }
  return target
}

function ensureDirectoryWritable(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
  fs.accessSync(dirPath, fs.constants.W_OK)
}

function normalizeRemotePath(remotePath: string): string {
  if (!remotePath.startsWith('/')) return `/${remotePath}`
  return remotePath.replace(/\/+/g, '/')
}

function extractRemotePathFromAlistUrl(alistUrl: string): string {
  try {
    const parsed = new URL(alistUrl)
    const segments = decodeURIComponent(parsed.pathname).split('/').filter(Boolean)
    if (segments.length <= 1) return '/'
    return normalizeRemotePath(`/${segments.slice(1).join('/')}`)
  } catch {
    const pathMatch = alistUrl.match(/https?:\/\/[^/]+(\/.*)/)
    if (!pathMatch) return '/'
    const segments = pathMatch[1].split('/').filter(Boolean)
    return normalizeRemotePath(`/${segments.slice(1).join('/')}`)
  }
}

function buildChildRemotePath(parent: string, name: string): string {
  return parent === '/' ? `/${name}` : `${parent}/${name}`
}

export class AutoSyncService {
  private static instance: AutoSyncService | null = null
  private startupExecutedPlans = new Map<number, Set<number>>()
  private runningPlans = new Set<number>()
  private lastExpiredCheck = 0
  private readonly maxScanDepth = 32
  private readonly maxScanConcurrency = 3
  private progressCallback: ((planId: number, event: AutoSyncProgressEvent) => void) | null = null

  static getInstance(): AutoSyncService {
    if (!AutoSyncService.instance) {
      AutoSyncService.instance = new AutoSyncService()
    }
    return AutoSyncService.instance
  }

  private async ensureWorkflowSession(session: { userId: number; username: string; token: string }): Promise<AuthSession> {
    const validSession = await authService.ensureValidSession()
    if (!validSession || validSession.userId !== session.userId) {
      throw new AlistAuthError(ALIST_AUTH_EXPIRED_SYNC_MESSAGE)
    }
    return validSession
  }

  private async withAlistSessionRetry<T>(
    session: AuthSession,
    operation: (activeSession: AuthSession) => Promise<T>
  ): Promise<{ result: T; session: AuthSession }> {
    try {
      return { result: await operation(session), session }
    } catch (error) {
      if (!isAlistAuthError(error)) throw error
      const recovered = await authService.ensureValidSession({ forceRefresh: true })
      if (!recovered || recovered.userId !== session.userId) {
        throw new AlistAuthError(ALIST_AUTH_EXPIRED_SYNC_MESSAGE)
      }
      return { result: await operation(recovered), session: recovered }
    }
  }

  setProgressCallback(cb: (planId: number, event: AutoSyncProgressEvent) => void): void {
    this.progressCallback = cb
  }

  private notifyProgress(planId: number, event: AutoSyncProgressEvent): void {
    try {
      this.progressCallback?.(planId, event)
    } catch {
      // 进度回调不应影响主流程
    }
  }

  private get db() {
    return getDatabase()
  }

  async createPlan(params: CreateAutoSyncPlanParams): Promise<AutoSyncPlanRow> {
    if (!params.userId || params.userId <= 0) throw new Error('用户未登录')
    if (!params.shareUrl?.trim()) throw new Error('分享链接不能为空')
    if (!params.localSyncDir?.trim()) throw new Error('本机同步目录不能为空')
    if (!params.expiresAt || params.expiresAt <= now()) throw new Error('有效期必须晚于当前时间')

    ensureDirectoryWritable(params.localSyncDir)

    const timestamp = now()
    const result = this.db.prepare(`
      INSERT INTO auto_sync_plans (
        user_id, name, share_url, share_code, local_sync_dir, status, expires_at,
        auto_run_on_startup, conflict_policy, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'enabled', ?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      params.userId,
      params.name?.trim() || getDefaultPlanName(params.shareUrl),
      params.shareUrl.trim(),
      extractShareCode(params.shareUrl),
      params.localSyncDir,
      params.expiresAt,
      params.autoRunOnStartup === false ? 0 : 1,
      params.conflictPolicy || 'skip_existing',
      timestamp,
      timestamp
    )

    return toRow(result)
  }

  async createPlanAndRun(
    params: CreateAutoSyncPlanParams,
    session: { userId: number; username: string; token: string }
  ): Promise<{ success: boolean; plan?: AutoSyncPlanRow; run?: AutoSyncRunRow; message?: string }> {
    const plan = await this.createPlan(params)
    const result = await this.establishBaseline(plan.id, session)

    if (!result.success) {
      await this.deletePlan(plan.id, params.userId)
      return {
        success: false,
        message: result.message || '首次同步失败，未创建自动同步计划'
      }
    }

    return {
      success: true,
      plan: await this.getPlan(plan.id, params.userId) || plan,
      run: result.run,
      message: result.message
    }
  }

  async getPlan(id: number, userId: number): Promise<AutoSyncPlanRow | null> {
    const row = this.db.prepare('SELECT * FROM auto_sync_plans WHERE id = ? AND user_id = ? AND status != ?')
      .get(id, userId, 'deleted')
    return row ? toRow(row) : null
  }

  async listPlans(userId: number): Promise<AutoSyncPlanRow[]> {
    await this.markExpiredPlans(userId)
    const rows = this.db.prepare(`
      SELECT p.*,
        r.id AS run_id, r.plan_id AS run_plan_id, r.user_id AS run_user_id,
        r.trigger_type AS run_trigger_type, r.status AS run_status,
        r.alist_path AS run_alist_path, r.remote_file_count AS run_remote_file_count,
        r.local_file_count AS run_local_file_count, r.missing_file_count AS run_missing_file_count,
        r.queued_download_count AS run_queued_download_count, r.skipped_count AS run_skipped_count,
        r.failed_count AS run_failed_count, r.error_message AS run_error_message,
        r.started_at AS run_started_at, r.finished_at AS run_finished_at
      FROM auto_sync_plans p
      LEFT JOIN auto_sync_runs r ON r.id = (
        SELECT id FROM auto_sync_runs WHERE plan_id = p.id ORDER BY started_at DESC LIMIT 1
      )
      WHERE p.user_id = ? AND p.status != 'deleted'
      ORDER BY p.created_at DESC
    `).all(userId)

    return rows.map((row: any) => {
      const plan = toRow(row)
      plan.latestRun = row.run_id ? toRunRow({
        id: row.run_id,
        plan_id: row.run_plan_id,
        user_id: row.run_user_id,
        trigger_type: row.run_trigger_type,
        status: row.run_status,
        alist_path: row.run_alist_path,
        remote_file_count: row.run_remote_file_count,
        local_file_count: row.run_local_file_count,
        missing_file_count: row.run_missing_file_count,
        queued_download_count: row.run_queued_download_count,
        skipped_count: row.run_skipped_count,
        failed_count: row.run_failed_count,
        error_message: row.run_error_message,
        started_at: row.run_started_at,
        finished_at: row.run_finished_at
      }) : null
      return plan
    })
  }

  async listRuns(planId: number, userId: number, limit = 20): Promise<AutoSyncRunRow[]> {
    const rows = this.db.prepare(`
      SELECT r.* FROM auto_sync_runs r
      JOIN auto_sync_plans p ON p.id = r.plan_id
      WHERE r.plan_id = ? AND r.user_id = ? AND p.user_id = ?
      ORDER BY r.started_at DESC
      LIMIT ?
    `).all(planId, userId, userId, Math.min(Math.max(limit, 1), 100))
    return rows.map(toRunRow)
  }

  async updatePlan(id: number, userId: number, updates: UpdateAutoSyncPlanParams): Promise<AutoSyncPlanRow> {
    const plan = await this.getPlan(id, userId)
    if (!plan) throw new Error('计划不存在')

    const next = {
      name: updates.name ?? plan.name,
      localSyncDir: updates.localSyncDir ?? plan.localSyncDir,
      expiresAt: updates.expiresAt ?? plan.expiresAt,
      autoRunOnStartup: updates.autoRunOnStartup ?? plan.autoRunOnStartup,
      conflictPolicy: updates.conflictPolicy ?? plan.conflictPolicy
    }

    if (next.expiresAt <= now()) throw new Error('有效期必须晚于当前时间')
    ensureDirectoryWritable(next.localSyncDir)

    const row = this.db.prepare(`
      UPDATE auto_sync_plans
      SET name = ?, local_sync_dir = ?, expires_at = ?, auto_run_on_startup = ?,
          conflict_policy = ?, status = CASE WHEN status = 'expired' THEN 'enabled' ELSE status END,
          updated_at = ?
      WHERE id = ? AND user_id = ?
      RETURNING *
    `).get(
      next.name,
      next.localSyncDir,
      next.expiresAt,
      next.autoRunOnStartup ? 1 : 0,
      next.conflictPolicy,
      now(),
      id,
      userId
    )

    return toRow(row)
  }

  async pausePlan(id: number, userId: number): Promise<void> {
    this.db.prepare(`
      UPDATE auto_sync_plans SET status = 'paused', updated_at = ?
      WHERE id = ? AND user_id = ? AND status != 'deleted'
    `).run(now(), id, userId)
  }

  async resumePlan(id: number, userId: number): Promise<void> {
    const plan = await this.getPlan(id, userId)
    if (!plan) throw new Error('计划不存在')
    if (plan.expiresAt <= now()) {
      this.db.prepare(`
        UPDATE auto_sync_plans SET status = 'expired', updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(now(), id, userId)
      throw new Error('计划已过期')
    }

    this.db.prepare(`
      UPDATE auto_sync_plans SET status = 'enabled', last_error_message = NULL, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(now(), id, userId)
  }

  async deletePlan(id: number, userId: number): Promise<void> {
    const t = now()
    const deleteSnapshots = this.db.prepare(`
      DELETE FROM auto_sync_remote_snapshots
      WHERE plan_id = ?
        AND EXISTS (
          SELECT 1 FROM auto_sync_plans
          WHERE id = ? AND user_id = ?
        )
    `)
    const updatePlan = this.db.prepare(`
      UPDATE auto_sync_plans SET status = 'deleted', updated_at = ?
      WHERE id = ? AND user_id = ?
    `)
    this.db.transaction(() => {
      deleteSnapshots.run(id, id, userId)
      updatePlan.run(t, id, userId)
    })()
  }

  async runStartupPlans(session: { userId: number; username: string; token: string }): Promise<{
    success: boolean
    total: number
    executed: number
    skipped: number
    failed: number
  }> {
    await this.markExpiredPlans(session.userId)
    const rows = this.db.prepare(`
      SELECT * FROM auto_sync_plans
      WHERE user_id = ?
        AND status = 'enabled'
        AND auto_run_on_startup = 1
        AND expires_at > ?
      ORDER BY COALESCE(last_sync_at, 0) ASC, created_at ASC
    `).all(session.userId, now())

    let executed = 0
    let skipped = 0
    let failed = 0

    const executedSet = this.startupExecutedPlans.get(session.userId) ?? new Set<number>()
    for (const row of rows) {
      const plan = toRow(row)
      if (executedSet.has(plan.id)) {
        skipped++
        continue
      }
      executedSet.add(plan.id)
      const result = await this.runPlan(plan.id, session, 'startup')
      if (result.success) executed++
      else failed++
    }
    this.startupExecutedPlans.set(session.userId, executedSet)

    return { success: true, total: rows.length, executed, skipped, failed }
  }

  resetStartupExecuted(userId: number): void {
    this.startupExecutedPlans.delete(userId)
  }

  async runPlan(
    planId: number,
    session: { userId: number; username: string; token: string },
    triggerType: AutoSyncTriggerType
  ): Promise<{ success: boolean; run?: AutoSyncRunRow; message?: string }> {
    if (this.runningPlans.has(planId)) {
      const run = await this.createRun(planId, session.userId, triggerType, 'skipped', '计划正在同步中')
      return { success: false, run, message: '计划正在同步中' }
    }

    const plan = await this.getPlan(planId, session.userId)
    if (!plan) return { success: false, message: '计划不存在' }
    if (plan.status === 'paused') {
      const run = await this.createRun(planId, session.userId, triggerType, 'skipped', '计划已暂停')
      return { success: false, run, message: '计划已暂停' }
    }
    if (plan.expiresAt <= now()) {
      await this.markExpiredPlans(session.userId)
      const run = await this.createRun(planId, session.userId, triggerType, 'skipped', '计划已过期')
      return { success: false, run, message: '计划已过期' }
    }

    this.runningPlans.add(planId)
    const runId = await this.insertRun(planId, session.userId, triggerType)
    let activeSession = await this.ensureWorkflowSession(session)

    try {
      const syncStartTs = now()
      this.db.prepare(`
        UPDATE auto_sync_plans SET status = 'syncing', last_sync_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(syncStartTs, syncStartTs, planId, session.userId)

      // 阶段 1：转存
      this.notifyProgress(planId, { stage: 'transfer', status: 'started', message: '开始转存...' })
      const transferAttempt = await this.withAlistSessionRetry(activeSession, (s) =>
        shareTransferService.execTransfer(plan.shareUrl, s.userId)
      )
      activeSession = transferAttempt.session
      const transfer = transferAttempt.result
      if (!transfer.success || !transfer.alistPath) {
        this.notifyProgress(planId, { stage: 'transfer', status: 'failed', message: transfer.message || '转存失败' })
        throw new Error(transfer.message || '转存失败')
      }
      this.notifyProgress(planId, { stage: 'transfer', status: 'completed', message: '转存成功', current: 30, total: 100 })

      // 阶段 2：扫描远程文件
      this.notifyProgress(planId, { stage: 'scan', status: 'started', message: '正在扫描远程文件...' })
      const remoteRoot = extractRemotePathFromAlistUrl(transfer.alistPath)
      const scanAttempt = await this.withAlistSessionRetry(activeSession, () =>
        this.scanRemoteFiles(remoteRoot, (scannedFiles, scannedDirs) => {
          this.notifyProgress(planId, {
            stage: 'scan',
            status: 'in_progress',
            message: `已扫描 ${scannedDirs} 个目录，发现 ${scannedFiles} 个文件...`,
            current: 30 + Math.min(scannedFiles, 35),
            total: 100
          })
        })
      )
      activeSession = scanAttempt.session
      const remoteFiles = scanAttempt.result
      this.notifyProgress(planId, { stage: 'scan', status: 'completed', message: `扫描完成，共 ${remoteFiles.length} 个文件`, current: 65, total: 100 })

      // 阶段 3：对比快照
      this.notifyProgress(planId, { stage: 'diff', status: 'started', message: '正在对比快照...' })
      const newFiles = await this.diffFilesIncremental(planId, remoteFiles, plan.localSyncDir)
      this.notifyProgress(planId, { stage: 'diff', status: 'completed', message: `发现 ${newFiles.length} 个新增文件`, current: 75, total: 100 })

      // 阶段 4：入队下载
      this.notifyProgress(planId, { stage: 'queue', status: 'started', message: '正在加入下载队列...' })
      const queueAttempt = await this.withAlistSessionRetry(activeSession, (s) =>
        this.queueMissingFiles(newFiles, s)
      )
      const queuedCount = queueAttempt.result
      this.notifyProgress(planId, { stage: 'queue', status: 'completed', message: `已加入 ${queuedCount} 个下载任务`, current: 90, total: 100 })

      const status: AutoSyncRunStatus = queuedCount === newFiles.length ? 'completed' : 'partial_failed'
      const failedCount = newFiles.length - queuedCount
      const finishTs = now()
      this.finishRun(runId, {
        status,
        alistPath: transfer.alistPath,
        remoteFileCount: remoteFiles.length,
        localFileCount: 0,
        missingFileCount: newFiles.length,
        queuedDownloadCount: queuedCount,
        skippedCount: remoteFiles.length - newFiles.length,
        failedCount,
        errorMessage: failedCount > 0 ? `${failedCount} 个文件加入下载队列失败` : null
      }, finishTs)

      this.db.prepare(`
        UPDATE auto_sync_plans
        SET status = 'enabled', last_alist_path = ?, last_success_at = ?,
            last_error_message = NULL, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(transfer.alistPath, finishTs, finishTs, planId, session.userId)

      const run = this.getRun(runId)
      this.notifyProgress(planId, {
        stage: 'complete',
        status: 'completed',
        message: newFiles.length === 0 ? '同步完成，没有新增文件' : `同步完成，已加入 ${queuedCount} 个下载任务`,
        current: 100,
        total: 100
      })
      return {
        success: status === 'completed',
        run,
        message: newFiles.length === 0
          ? '同步完成，没有新增文件'
          : `同步完成，已加入 ${queuedCount} 个下载任务`
      }
    } catch (error: any) {
      const message = error instanceof AlistAuthError || isAlistAuthError(error)
        ? ALIST_AUTH_EXPIRED_SYNC_MESSAGE
        : error.message || '自动同步失败'
      const errorTs = now()
      loggerService.error('AutoSyncService', `计划 ${planId} 同步失败: ${message}`)
      this.finishRun(runId, {
        status: 'failed',
        errorMessage: message
      }, errorTs)
      this.db.prepare(`
        UPDATE auto_sync_plans
        SET status = 'failed', last_error_message = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(message, errorTs, planId, session.userId)
      this.notifyProgress(planId, { stage: 'complete', status: 'failed', message })
      return { success: false, run: this.getRun(runId), message }
    } finally {
      this.runningPlans.delete(planId)
    }
  }

  private async scanRemoteFiles(
    remoteRoot: string,
    onProgress?: (scannedFiles: number, scannedDirs: number) => void
  ): Promise<RemoteFile[]> {
    const files: RemoteFile[] = []
    const root = normalizeRemotePath(remoteRoot)
    loggerService.info('AutoSyncService', `开始扫描远程文件，root=${root}`)
    let scannedDirs = 0
    let lastProgressFiles = 0
    let lastProgressTime = 0
    let authError: unknown = null

    const queue = new SimplePQueue({ concurrency: this.maxScanConcurrency })

    const scanDir = async (current: string, depth: number): Promise<void> => {
      if (authError) return
      if (depth > this.maxScanDepth) {
        loggerService.warn('AutoSyncService', `远程目录扫描深度超过 ${this.maxScanDepth}: ${current}`)
        return
      }

      loggerService.debug('AutoSyncService', `扫描目录: ${current} (depth=${depth})`)
      let result: { content?: Array<{ name: string; isDir?: boolean; size?: number; modified?: string }> }
      try {
        result = await alistService.listFiles(current)
      } catch (error: any) {
        loggerService.error('AutoSyncService', `扫描目录失败: ${current}, error=${error.message || error}`)
        if (isAlistAuthError(error)) {
          authError = error
        }
        return
      }
      scannedDirs++
      const content = result.content || []
      let dirCount = 0
      for (const item of content) {
        const childPath = buildChildRemotePath(current, item.name)
        if (item.isDir) {
          dirCount++
          queue.add(() => scanDir(childPath, depth + 1))
          continue
        }
        files.push({
          relativePath: path.posix.relative(root, childPath),
          remotePath: childPath,
          fileName: item.name,
          fileSize: item.size || 0,
          modified: item.modified || ''
        })
      }
      loggerService.debug('AutoSyncService', `目录扫描完成: ${current}, 内容项=${content.length}, 子目录=${dirCount}, 文件=${content.length - dirCount}`)

      // 节流：每 500ms 或每新增 50 个文件报告一次进度
      const nowTime = Date.now()
      if (onProgress && (nowTime - lastProgressTime > 500 || files.length - lastProgressFiles >= 50)) {
        onProgress(files.length, scannedDirs)
        lastProgressTime = nowTime
        lastProgressFiles = files.length
      }
    }

    queue.add(() => scanDir(root, 0))
    await queue.onIdle()

    if (authError) throw authError

    const filtered = files.filter(file => file.relativePath && !file.relativePath.startsWith('..'))
    loggerService.info('AutoSyncService', `远程文件扫描结束，共扫描 ${scannedDirs} 个目录，发现 ${filtered.length} 个文件`)
    return filtered
  }

  private async diffFilesIncremental(
    planId: number,
    remoteFiles: RemoteFile[],
    localSyncDir: string
  ): Promise<DiffFile[]> {
    const snapshots = this.loadSnapshots(planId)
    const snapshotMap = new Map(snapshots.map(s => [s.relativePath, s]))
    const result: DiffFile[] = []
    const t = now()
    const idsToUpdate: number[] = []
    for (const remote of remoteFiles) {
      const snapshot = snapshotMap.get(remote.relativePath)
      if (!snapshot) {
        // 新出现文件：加入下载队列，同时写入快照
        result.push({
          ...remote,
          savePath: buildSafeLocalPath(localSyncDir, remote.relativePath)
        })
        this.insertSnapshot(planId, remote.relativePath, remote.fileSize, t)
      } else {
        // 已有记录：一律跳过，不更新 file_size，只更新验证时间
        idsToUpdate.push(snapshot.id)
      }
    }

    if (idsToUpdate.length > 0) {
      this.db.transaction(() => {
        for (let i = 0; i < idsToUpdate.length; i += SQLITE_BATCH_SIZE) {
          const batch = idsToUpdate.slice(i, i + SQLITE_BATCH_SIZE)
          const placeholders = batch.map(() => '?').join(',')
          this.db.prepare(`
            UPDATE auto_sync_remote_snapshots
            SET last_verified_at = ?
            WHERE id IN (${placeholders})
          `).run(t, ...batch)
        }
      })()
    }

    return result
  }

  private async queueMissingFiles(
    missingFiles: DiffFile[],
    session: { userId: number; token: string }
  ): Promise<number> {
    if (missingFiles.length === 0) return 0

    downloadQueueManager.setCredentials(session.userId, session.token)
    const tasks: DownloadQueueTask[] = missingFiles.map((file, index) => ({
      id: `autosync_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 10)}`,
      fileName: file.fileName,
      fileSize: file.fileSize,
      savePath: file.savePath,
      userId: session.userId,
      userToken: session.token,
      remotePath: file.remotePath,
      priority: index
    }))

    const batchResult = await downloadQueueManager.addBatchToQueue(tasks)
    return batchResult.length
  }

  // 快照 CRUD
  private loadSnapshots(planId: number): AutoSyncRemoteSnapshot[] {
    const rows = this.db.prepare(`
      SELECT id, plan_id, relative_path, file_size, first_seen_at, last_verified_at
      FROM auto_sync_remote_snapshots
      WHERE plan_id = ?
    `).all(planId) as Array<{
      id: number
      plan_id: number
      relative_path: string
      file_size: number
      first_seen_at: number
      last_verified_at: number
    }>
    return rows.map(row => ({
      id: row.id,
      planId: row.plan_id,
      relativePath: row.relative_path,
      fileSize: row.file_size,
      firstSeenAt: row.first_seen_at,
      lastVerifiedAt: row.last_verified_at
    }))
  }

  private insertSnapshot(planId: number, relativePath: string, fileSize: number, timestamp: number): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO auto_sync_remote_snapshots
        (plan_id, relative_path, file_size, first_seen_at, last_verified_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(planId, relativePath, fileSize, timestamp, timestamp)
  }

  private insertSnapshotsBatch(planId: number, files: RemoteFile[], timestamp: number): void {
    if (files.length === 0) return
    const PARAMS_PER_ROW = 5
    const ROWS_PER_BATCH = Math.floor(SQLITE_BATCH_SIZE / PARAMS_PER_ROW)
    const VALUES_PLACEHOLDER = '(?, ?, ?, ?, ?)'

    for (let i = 0; i < files.length; i += ROWS_PER_BATCH) {
      const batch = files.slice(i, i + ROWS_PER_BATCH)
      const placeholders = batch.map(() => VALUES_PLACEHOLDER).join(', ')
      const params: (string | number)[] = []
      for (const file of batch) {
        params.push(planId, file.relativePath, file.fileSize, timestamp, timestamp)
      }
      this.db.prepare(`
        INSERT OR IGNORE INTO auto_sync_remote_snapshots
          (plan_id, relative_path, file_size, first_seen_at, last_verified_at)
        VALUES ${placeholders}
      `).run(...params)
    }
  }

  /**
   * 首次同步：建立远程文件快照基线，不自动加入下载队列
   */
  async establishBaseline(
    planId: number,
    session: { userId: number; username: string; token: string }
  ): Promise<{ success: boolean; run?: AutoSyncRunRow; message?: string }> {
    if (this.runningPlans.has(planId)) {
      return { success: false, message: '计划正在同步中' }
    }

    const plan = await this.getPlan(planId, session.userId)
    if (!plan) return { success: false, message: '计划不存在' }

    this.runningPlans.add(planId)
    const runId = await this.insertRun(planId, session.userId, 'created')
    let activeSession = await this.ensureWorkflowSession(session)

    try {
      const syncStartTs = now()
      this.db.prepare(`
        UPDATE auto_sync_plans SET status = 'syncing', last_sync_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(syncStartTs, syncStartTs, planId, session.userId)

      // 阶段 1：转存
      this.notifyProgress(planId, { stage: 'transfer', status: 'started', message: '开始转存...' })
      const transferAttempt = await this.withAlistSessionRetry(activeSession, (s) =>
        shareTransferService.execTransfer(plan.shareUrl, s.userId)
      )
      activeSession = transferAttempt.session
      const transfer = transferAttempt.result
      if (!transfer.success || !transfer.alistPath) {
        this.notifyProgress(planId, { stage: 'transfer', status: 'failed', message: transfer.message || '转存失败' })
        throw new Error(transfer.message || '转存失败')
      }
      this.notifyProgress(planId, { stage: 'transfer', status: 'completed', message: '转存成功', current: 30, total: 100 })

      // 阶段 2：扫描远程文件
      this.notifyProgress(planId, { stage: 'scan', status: 'started', message: '正在扫描远程文件...' })
      const remoteRoot = extractRemotePathFromAlistUrl(transfer.alistPath)
      const scanAttempt = await this.withAlistSessionRetry(activeSession, () =>
        this.scanRemoteFiles(remoteRoot, (scannedFiles, scannedDirs) => {
          this.notifyProgress(planId, {
            stage: 'scan',
            status: 'in_progress',
            message: `已扫描 ${scannedDirs} 个目录，发现 ${scannedFiles} 个文件...`,
            current: 30 + Math.min(scannedFiles, 35),
            total: 100
          })
        })
      )
      activeSession = scanAttempt.session
      const remoteFiles = scanAttempt.result
      this.notifyProgress(planId, { stage: 'scan', status: 'completed', message: `扫描完成，共 ${remoteFiles.length} 个文件`, current: 65, total: 100 })

      // 阶段 3：建立基线
      this.notifyProgress(planId, { stage: 'diff', status: 'started', message: '正在建立快照基线...' })
      const t = now()
      this.insertSnapshotsBatch(planId, remoteFiles, t)
      this.notifyProgress(planId, { stage: 'diff', status: 'completed', message: `已记录 ${remoteFiles.length} 个文件`, current: 90, total: 100 })

      const finishTs = now()
      this.finishRun(runId, {
        status: 'completed',
        alistPath: transfer.alistPath,
        remoteFileCount: remoteFiles.length,
        localFileCount: 0,
        missingFileCount: 0,
        queuedDownloadCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errorMessage: null
      }, finishTs)

      this.db.prepare(`
        UPDATE auto_sync_plans
        SET status = 'enabled', last_alist_path = ?, last_success_at = ?,
            last_error_message = NULL, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(transfer.alistPath, finishTs, finishTs, planId, session.userId)

      this.notifyProgress(planId, {
        stage: 'complete',
        status: 'completed',
        message: `首次同步完成，已记录 ${remoteFiles.length} 个文件的快照基线`,
        current: 100,
        total: 100
      })
      return {
        success: true,
        run: this.getRun(runId),
        message: `首次同步完成，已记录 ${remoteFiles.length} 个文件的快照基线`
      }
    } catch (error: any) {
      const message = error instanceof AlistAuthError || isAlistAuthError(error)
        ? ALIST_AUTH_EXPIRED_SYNC_MESSAGE
        : error.message || '首次同步失败'
      const errorTs = now()
      loggerService.error('AutoSyncService', `计划 ${planId} 建立基线失败: ${message}`)
      this.finishRun(runId, {
        status: 'failed',
        errorMessage: message
      }, errorTs)
      this.notifyProgress(planId, { stage: 'complete', status: 'failed', message })
      this.db.prepare(`
        UPDATE auto_sync_plans
        SET status = 'failed', last_error_message = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(message, errorTs, planId, session.userId)
      return { success: false, run: this.getRun(runId), message }
    } finally {
      this.runningPlans.delete(planId)
    }
  }

  /**
   * 重置基线：清空快照表，重新扫描远程文件建立基线
   */
  async resetBaseline(
    id: number,
    userId: number,
    session: { userId: number; username: string; token: string }
  ): Promise<{ success: boolean; run?: AutoSyncRunRow; message?: string }> {
    const plan = await this.getPlan(id, userId)
    if (!plan) throw new Error('计划不存在')

    // 清空该计划的快照
    this.db.prepare(`DELETE FROM auto_sync_remote_snapshots WHERE plan_id = ?`).run(id)

    // 重新建立基线
    return this.establishBaseline(id, session)
  }

  private async markExpiredPlans(userId: number): Promise<void> {
    const t = now()
    if (t - this.lastExpiredCheck < 5000) return
    this.lastExpiredCheck = t
    this.db.prepare(`
      UPDATE auto_sync_plans
      SET status = 'expired', updated_at = ?
      WHERE user_id = ?
        AND status IN ('enabled', 'failed')
        AND expires_at <= ?
    `).run(t, userId, t)
  }

  private async insertRun(planId: number, userId: number, triggerType: AutoSyncTriggerType): Promise<number> {
    const row = this.db.prepare(`
      INSERT INTO auto_sync_runs (plan_id, user_id, trigger_type, status, started_at)
      VALUES (?, ?, ?, 'running', ?)
      RETURNING id
    `).get(planId, userId, triggerType, now()) as { id: number }
    return row.id
  }

  private async createRun(
    planId: number,
    userId: number,
    triggerType: AutoSyncTriggerType,
    status: AutoSyncRunStatus,
    errorMessage: string
  ): Promise<AutoSyncRunRow> {
    const row = this.db.prepare(`
      INSERT INTO auto_sync_runs (
        plan_id, user_id, trigger_type, status, error_message, started_at, finished_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).get(planId, userId, triggerType, status, errorMessage, now(), now())
    return toRunRow(row)
  }

  private finishRun(runId: number, data: {
    status: AutoSyncRunStatus
    alistPath?: string
    remoteFileCount?: number
    localFileCount?: number
    missingFileCount?: number
    queuedDownloadCount?: number
    skippedCount?: number
    failedCount?: number
    errorMessage?: string | null
  }, timestamp?: number): void {
    this.db.prepare(`
      UPDATE auto_sync_runs
      SET status = ?,
          alist_path = COALESCE(?, alist_path),
          remote_file_count = COALESCE(?, remote_file_count),
          local_file_count = COALESCE(?, local_file_count),
          missing_file_count = COALESCE(?, missing_file_count),
          queued_download_count = COALESCE(?, queued_download_count),
          skipped_count = COALESCE(?, skipped_count),
          failed_count = COALESCE(?, failed_count),
          error_message = ?,
          finished_at = ?
      WHERE id = ?
    `).run(
      data.status,
      data.alistPath ?? null,
      data.remoteFileCount ?? null,
      data.localFileCount ?? null,
      data.missingFileCount ?? null,
      data.queuedDownloadCount ?? null,
      data.skippedCount ?? null,
      data.failedCount ?? null,
      data.errorMessage ?? null,
      timestamp ?? now(),
      runId
    )
  }

  private getRun(runId: number): AutoSyncRunRow {
    const row = this.db.prepare('SELECT * FROM auto_sync_runs WHERE id = ?').get(runId)
    return toRunRow(row)
  }
}

export const autoSyncService = AutoSyncService.getInstance()
