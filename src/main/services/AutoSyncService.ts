import * as fs from 'fs'
import { readdir, stat } from 'fs/promises'
import * as path from 'path'
import { getDatabase } from '../database'
import { alistService } from './AlistService'
import { shareTransferService } from './ShareTransferService'
import { downloadQueueManager, type DownloadQueueTask } from './DownloadQueueManager'
import { loggerService } from './LoggerService'

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

interface LocalFile {
  relativePath: string
  fileSize: number
  modifiedMs: number
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
  private startupExecutedPlans = new Set<number>()
  private runningPlans = new Set<number>()
  private lastExpiredCheck = 0

  static getInstance(): AutoSyncService {
    if (!AutoSyncService.instance) {
      AutoSyncService.instance = new AutoSyncService()
    }
    return AutoSyncService.instance
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
    const result = await this.runPlan(plan.id, session, 'created')

    if (!result.success && !result.run?.alistPath) {
      await this.deletePlan(plan.id, params.userId)
      return {
        success: false,
        message: result.message || '首次同步失败，未创建自动同步计划'
      }
    }

    return {
      success: result.success,
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
    this.db.prepare(`
      DELETE FROM auto_sync_downloaded_files
      WHERE plan_id = ?
        AND EXISTS (
          SELECT 1 FROM auto_sync_plans
          WHERE id = ? AND user_id = ?
        )
    `).run(id, id, userId)
    this.db.prepare(`
      UPDATE auto_sync_plans SET status = 'deleted', updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(t, id, userId)
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

    for (const row of rows) {
      const plan = toRow(row)
      if (this.startupExecutedPlans.has(plan.id)) {
        skipped++
        continue
      }
      this.startupExecutedPlans.add(plan.id)
      const result = await this.runPlan(plan.id, session, 'startup')
      if (result.success) executed++
      else failed++
    }

    return { success: true, total: rows.length, executed, skipped, failed }
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

    try {
      const syncStartTs = now()
      this.db.prepare(`
        UPDATE auto_sync_plans SET status = 'syncing', last_sync_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(syncStartTs, syncStartTs, planId, session.userId)

      const transfer = await shareTransferService.execTransfer(plan.shareUrl, session.userId)
      if (!transfer.success || !transfer.alistPath) {
        throw new Error(transfer.message || '转存失败')
      }

      const remoteRoot = extractRemotePathFromAlistUrl(transfer.alistPath)
      const remoteFiles = await this.scanRemoteFiles(remoteRoot)
      const localFiles = await this.scanLocalDirectory(plan.localSyncDir)

      // 同步已下载文件状态，并构建已完成下载的 Map
      this.syncDownloadedFileStatuses(planId)
      const completedDownloads = this.db.prepare(`
        SELECT relative_path, file_size FROM auto_sync_downloaded_files
        WHERE plan_id = ? AND status = 'completed'
      `).all(planId) as Array<{ relative_path: string; file_size: number }>
      const downloadedFileMap = new Map<string, { fileSize: number }>()
      for (const row of completedDownloads) {
        downloadedFileMap.set(row.relative_path, { fileSize: row.file_size })
      }

      const missingFiles = this.diffFiles(remoteFiles, localFiles, plan.localSyncDir, plan.conflictPolicy, downloadedFileMap)
      const queuedCount = await this.queueMissingFiles(missingFiles, planId, session)

      const status: AutoSyncRunStatus = queuedCount === missingFiles.length ? 'completed' : 'partial_failed'
      const failedCount = missingFiles.length - queuedCount
      const finishTs = now()
      this.finishRun(runId, {
        status,
        alistPath: transfer.alistPath,
        remoteFileCount: remoteFiles.length,
        localFileCount: localFiles.length,
        missingFileCount: missingFiles.length,
        queuedDownloadCount: queuedCount,
        skippedCount: localFiles.length,
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
      return {
        success: status === 'completed',
        run,
        message: missingFiles.length === 0
          ? '同步完成，没有缺少文件'
          : `同步完成，已加入 ${queuedCount} 个下载任务`
      }
    } catch (error: any) {
      const message = error.message || '自动同步失败'
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
      return { success: false, run: this.getRun(runId), message }
    } finally {
      this.runningPlans.delete(planId)
    }
  }

  private syncDownloadedFileStatuses(planId: number): void {
    const timestamp = Math.floor(Date.now() / 1000)

    // 将 transfer_queue 中已完成的记录同步为 completed
    this.db.prepare(`
      UPDATE auto_sync_downloaded_files
      SET status = 'completed',
          downloaded_at = COALESCE(downloaded_at, (SELECT tq.updated_at FROM transfer_queue tq WHERE tq.id = transfer_task_id)),
          updated_at = ?
      WHERE plan_id = ?
        AND status = 'pending'
        AND transfer_task_id IN (SELECT id FROM transfer_queue WHERE status = 'completed')
    `).run(timestamp, planId)

    // 将 transfer_queue 中失败的记录同步为 failed
    this.db.prepare(`
      UPDATE auto_sync_downloaded_files
      SET status = 'failed',
          updated_at = ?
      WHERE plan_id = ?
        AND status = 'pending'
        AND transfer_task_id IN (SELECT id FROM transfer_queue WHERE status = 'failed')
    `).run(timestamp, planId)

    // 处理孤立记录：transfer_task_id 不存在于 transfer_queue 中，或为 NULL
    this.db.prepare(`
      UPDATE auto_sync_downloaded_files
      SET status = 'failed',
          updated_at = ?
      WHERE plan_id = ?
        AND status = 'pending'
        AND (
          transfer_task_id IS NULL
          OR transfer_task_id NOT IN (SELECT id FROM transfer_queue)
        )
    `).run(timestamp, planId)
  }

  private async scanRemoteFiles(remoteRoot: string): Promise<RemoteFile[]> {
    const files: RemoteFile[] = []
    const root = normalizeRemotePath(remoteRoot)

    const walk = async (current: string): Promise<void> => {
      const result = await alistService.listFiles(current)
      for (const item of result.content || []) {
        const childPath = buildChildRemotePath(current, item.name)
        if (item.isDir) {
          await walk(childPath)
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
    }

    await walk(root)
    return files.filter(file => file.relativePath && !file.relativePath.startsWith('..'))
  }

  private async scanLocalDirectory(localDir: string): Promise<LocalFile[]> {
    ensureDirectoryWritable(localDir)
    const root = path.resolve(localDir)
    const files: LocalFile[] = []

    const walk = async (current: string): Promise<void> => {
      const entries = await readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
          continue
        }
        const s = await stat(fullPath)
        files.push({
          relativePath: path.relative(root, fullPath).split(path.sep).join('/'),
          fileSize: s.size,
          modifiedMs: s.mtimeMs
        })
      }
    }

    await walk(root)
    return files
  }

  private diffFiles(
    remoteFiles: RemoteFile[],
    localFiles: LocalFile[],
    localSyncDir: string,
    conflictPolicy: AutoSyncConflictPolicy,
    downloadedFileMap: Map<string, { fileSize: number }>
  ): DiffFile[] {
    const localMap = new Map(localFiles.map(file => [file.relativePath, file]))
    const result: DiffFile[] = []

    for (const remote of remoteFiles) {
      const local = localMap.get(remote.relativePath)

      // Case 1: 本地文件存在，按 conflictPolicy 处理
      if (local) {
        if (conflictPolicy === 'rename_remote' && local.fileSize !== remote.fileSize) {
          result.push({
            ...remote,
            savePath: this.buildRenamedRemotePath(localSyncDir, remote.relativePath)
          })
        }
        if (conflictPolicy === 'overwrite') {
          result.push({ ...remote, savePath: buildSafeLocalPath(localSyncDir, remote.relativePath) })
        }
        continue
      }

      // Case 2: 本地不存在，但数据库标记已完成下载
      const downloaded = downloadedFileMap.get(remote.relativePath)
      if (downloaded) {
        // 远程文件大小变化，需要重新下载
        if (downloaded.fileSize !== remote.fileSize) {
          result.push({ ...remote, savePath: buildSafeLocalPath(localSyncDir, remote.relativePath) })
        }
        continue
      }

      // Case 3: 本地不存在，数据库无记录，真正缺失的文件
      result.push({ ...remote, savePath: buildSafeLocalPath(localSyncDir, remote.relativePath) })
    }

    return result
  }

  private buildRenamedRemotePath(localSyncDir: string, relativePath: string): string {
    const parsed = path.parse(relativePath)
    const suffix = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
    const renamed = path.posix.join(parsed.dir.split(path.sep).join('/'), `${parsed.name}.remote-${suffix}${parsed.ext}`)
    return buildSafeLocalPath(localSyncDir, renamed)
  }

  private async queueMissingFiles(
    missingFiles: DiffFile[],
    planId: number,
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

    const timestamp = Math.floor(Date.now() / 1000)
    let queuedCount = 0

    // 记录已入队的文件到跟踪表
    for (let i = 0; i < tasks.length; i++) {
      const transferDbId = await downloadQueueManager.addToQueue(tasks[i])
      if (transferDbId <= 0) continue

      queuedCount++
      const file = missingFiles[i]
      try {
        this.db.prepare(`
          INSERT OR REPLACE INTO auto_sync_downloaded_files
            (plan_id, remote_path, relative_path, file_size, transfer_task_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(
          planId,
          file.remotePath,
          file.relativePath,
          file.fileSize,
          transferDbId,
          timestamp,
          timestamp
        )
      } catch (err: any) {
        loggerService.error('AutoSyncService',
          `记录下载文件跟踪失败: ${file.relativePath} - ${err.message}`)
      }
    }

    return queuedCount
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
