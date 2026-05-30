import { TransferService } from './transfer.service'
import { DownloadManager } from './download.manager'
import { alistService } from '../../core/api/alist.service'
import { activityService, ActionType } from '../activity/activity.core.service'
import { loggerService } from '../../core/logger/logger.service'
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { MAX_CONCURRENT_DOWNLOADS } from '../../../shared/constants'
import { authService, type AuthSession } from '../auth/auth.service'
import {
  ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE,
  isAlistAuthError
} from '../../core/api/alist-auth-error'

export interface DownloadQueueTask {
  id: string
  url?: string
  savePath?: string
  fileName: string
  fileSize: number
  userId: number
  userToken: string
  remotePath: string
  priority: number  // 优先级（越小越优先）
  dbId?: number  // 数据库记录 ID(可选)
  batchId?: string
  batchTotal?: number
}

type DownloadProgressCallback = (data: {
  taskId: string
  fileName: string
  progress: number
  downloadedBytes: number
  totalBytes: number
  speed: number
}) => void

class DownloadQueueManager {
  private queue: Map<string, DownloadQueueTask> = new Map()           // 仅存待启动任务
  private activeDownloads: Map<string, DownloadQueueTask> = new Map() // 仅存执行中任务
  private maxConcurrent: number = MAX_CONCURRENT_DOWNLOADS
  private transferService: TransferService
  private downloadManager: DownloadManager
  private onProgressCallback: DownloadProgressCallback | null = null
  private userId: number = 0
  private userToken: string = ''
  private authFailedNotified: boolean = false  // 防止重复发送认证失败通知
  private emitTimer: ReturnType<typeof setTimeout> | null = null  // 防抖定时器

  constructor() {
    this.transferService = new TransferService()
    this.downloadManager = new DownloadManager()
  }

  setProgressCallback(callback: DownloadProgressCallback): void {
    this.onProgressCallback = callback
  }

  setCredentials(userId: number, userToken: string): void {
    this.userId = userId
    this.userToken = userToken
  }

  /**
   * 检查 remotePath 是否已在队列中（内存或数据库中有未完成的任务）
   */
  private async isDuplicate(remotePath: string): Promise<boolean> {
    // 检查内存中的待启动任务
    for (const t of this.queue.values()) {
      if (t.remotePath === remotePath) return true
    }

    // 检查内存中的执行中任务
    for (const t of this.activeDownloads.values()) {
      if (t.remotePath === remotePath) return true
    }

    // 检查数据库中未完成的任务
    const existing = await this.transferService.getTaskByRemotePath(remotePath, 'download')
    return !!existing && (existing.status === 'pending' || existing.status === 'in_progress')
  }

  /**
   * 添加下载任务到队列
   */
  async addToQueue(task: DownloadQueueTask): Promise<number> {
    // 去重检查
    if (await this.isDuplicate(task.remotePath)) {
      loggerService.info('DownloadQueueManager', `跳过重复任务: ${task.fileName} (${task.remotePath})`)
      return -1
    }

    // 创建数据库记录
    const dbTask = await this.transferService.create({
      userId: task.userId,
      taskType: 'download',
      fileName: task.fileName,
      filePath: task.savePath || '',
      remotePath: task.remotePath,
      fileSize: task.fileSize,
      status: 'pending',
      transferredSize: 0,
      resumable: false
    })

    // 添加数据库 ID 到任务对象
    const taskWithDbId = { ...task, dbId: dbTask.id }

    // 添加到内存队列
    this.queue.set(task.id, taskWithDbId)

    // 尝试启动任务
    this.processQueue()

    // 通知渲染进程队列更新
    this.emitQueueUpdated()

    return dbTask.id
  }

  /**
   * 批量添加下载任务到队列
   * @returns 返回成功创建的任务元数据 { taskId, dbId }[]
   */
  async addBatchToQueue(tasks: DownloadQueueTask[]): Promise<Array<{ taskId: string; dbId: number }>> {
    // 批量去重：同时过滤"输入数组内部重复"和"已在队列/数据库中的任务"
    const uniqueTasks: DownloadQueueTask[] = []
    const seenInBatch = new Set<string>()
    for (const task of tasks) {
      if (seenInBatch.has(task.remotePath)) {
        loggerService.info('DownloadQueueManager', `跳过批内重复任务: ${task.fileName} (${task.remotePath})`)
        continue
      }
      seenInBatch.add(task.remotePath)
      if (!(await this.isDuplicate(task.remotePath))) {
        uniqueTasks.push(task)
      } else {
        loggerService.info('DownloadQueueManager', `跳过重复任务: ${task.fileName} (${task.remotePath})`)
      }
    }
    if (uniqueTasks.length === 0) return []

    const records = uniqueTasks.map(task => ({
      userId: task.userId,
      taskType: 'download' as const,
      fileName: task.fileName,
      filePath: task.savePath || '',
      remotePath: task.remotePath,
      fileSize: task.fileSize,
      status: 'pending' as const,
      transferredSize: 0,
      resumable: false
    }))
    const dbTasks = await this.transferService.createBatch(records)
    const result: Array<{ taskId: string; dbId: number }> = []
    const batchTotal = uniqueTasks.length
    dbTasks.forEach((dbTask, i) => {
      const task = uniqueTasks[i]
      this.queue.set(task.id, { ...task, dbId: dbTask.id, batchTotal })
      result.push({ taskId: task.id, dbId: dbTask.id })
    })
    this.processQueue()
    this.emitQueueUpdated()
    return result
  }

  /**
   * 处理队列（启动等待的任务）
   */
  private processQueue(): void {
    const slotsAvailable = this.maxConcurrent - this.activeDownloads.size
    if (slotsAvailable <= 0) return

    // queue 里全是待启动任务，按优先级排序后直接启动
    const pendingTasks = Array.from(this.queue.values())
      .filter((t): t is DownloadQueueTask & { dbId: number } => t.dbId !== undefined)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, slotsAvailable)

    for (const task of pendingTasks) {
      // 立即从 queue 移入 activeDownloads，消除竞态
      this.queue.delete(task.id)
      this.activeDownloads.set(task.id, task)
      this.startDownload(task)
    }
  }

  /**
   * 启动单个下载任务
   */
  private async startDownload(
    task: DownloadQueueTask & { dbId: number },
    authRetryCount = 0
  ): Promise<void> {
    // task 已由 processQueue 放入 activeDownloads，此处无需再操作

    // 立即通知渲染进程：任务进入 active 状态
    this.emitQueueUpdated()

    try {
      // 获取下载链接（如果还没有）
      if (!task.url) {
        const session = await authService.ensureValidSession()
        if (!session) {
          throw new Error(ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE)
        }
        this.applySessionToAlist(session)
        task.userId = session.userId
        task.userToken = session.token
        const dlResult = await alistService.getDownloadUrl(task.remotePath)
        if (!dlResult.success || !dlResult.rawUrl) {
          throw new Error(dlResult.error || '获取下载链接失败')
        }
        task.url = dlResult.rawUrl
        task.fileSize = dlResult.fileSize || task.fileSize
        if (task.fileSize > 0) {
          await this.transferService.updateFileSize(task.dbId, task.fileSize)
        }
      }

      // 计算 savePath（如果还没有）
      if (!task.savePath) {
        const defaultPath = this.downloadManager.getDefaultDownloadPath()
        const remoteDir = path.posix.dirname(task.remotePath)
        const RESERVED = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i
        const sanitize = (seg: string) => {
          let s = seg.replace(/[\\/:*?"<>|]/g, '_').replace(/[\s.]+$/, '')
          if (RESERVED.test(s)) s = '_' + s
          return s || '_'
        }
        const subDir = remoteDir === '/' ? '' : remoteDir.split('/').filter(Boolean).map(sanitize).join(path.sep)
        task.savePath = path.join(defaultPath, subDir, task.fileName)
      }

      // 开始下载(传递 dbId 以避免创建重复的数据库记录)
      const actualSavePath = await this.downloadManager.startDownload({ ...task, url: task.url!, savePath: task.savePath!, dbId: task.dbId }, (progress) => {
        // 发送进度更新事件
        if (this.onProgressCallback) {
          this.onProgressCallback({
            taskId: task.id,
            fileName: task.fileName,
            progress: progress.percentage,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
            speed: progress.speed
          })
        }

        // 发送进度到渲染进程
        const windows = BrowserWindow.getAllWindows()
        windows.forEach(win => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('transfer:download:progress', {
              taskId: task.id,
              fileName: task.fileName,
              progress: progress.percentage,
              downloadedBytes: progress.downloadedBytes,
              totalBytes: progress.totalBytes,
              speed: progress.speed
            })
          }
        })
      })

      // 下载完成 - DownloadManager 已经更新了数据库状态

      // Story 9.2 CRITICAL FIX: 记录下载操作日志
      activityService.logActivity({
        userId: task.userId,
        actionType: ActionType.DOWNLOAD,
        fileCount: 1,
        fileSize: task.fileSize,
        details: { fileName: task.fileName, remotePath: task.remotePath, savePath: task.savePath }
      }).catch(err => loggerService.error('DownloadQueueManager', `记录下载日志失败: ${err}`))

      // 从活跃集合移除
      this.activeDownloads.delete(task.id)

      // 通知前端队列状态变更
      this.emitQueueUpdated()

      // 发送完成事件
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('transfer:download:completed', {
            taskId: task.id,
            fileName: task.fileName,
            savePath: actualSavePath,
            batchId: task.batchId,
            batchTotal: task.batchTotal
          })
        }
      })

      // 处理队列中的下一个任务
      this.processQueue()

    } catch (error: any) {
      // 从活跃集合移除
      this.activeDownloads.delete(task.id)

      const errMsg: string = error.message || ''

      // 认证失败：尝试恢复 session 并重试一次，不标记为普通失败
      if (isAlistAuthError(error) || isAlistAuthError(errMsg)) {
        const handled = await this.handleAuthFailure(task, authRetryCount)
        if (handled) return
      }

      // 更新数据库状态为 failed，避免重启后死循环恢复同一任务
      try {
        await this.transferService.markAsFailed(task.dbId, errMsg, 0)
      } catch (dbErr) {
        loggerService.error('DownloadQueueManager', `更新失败状态失败 - dbId: ${task.dbId}, 错误: ${dbErr}`)
      }

      // 清理本地残留的部分下载文件（仅当 getDownloadUrl 等阶段失败、未真正进入下载流程时可能残留）
      if (task.savePath) {
        try {
          if (fs.existsSync(task.savePath)) {
            fs.unlinkSync(task.savePath)
          }
        } catch (fsErr: any) {
          if (fsErr?.code !== 'ENOENT') {
            loggerService.error('DownloadQueueManager', `清理残留文件失败: ${task.savePath} - ${fsErr}`)
          }
        }
      }

      // 通知前端队列状态变更
      this.emitQueueUpdated()

      // 发送失败事件
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('transfer:download:failed', {
            taskId: task.id,
            fileName: task.fileName,
            error: errMsg,
            batchId: task.batchId,
            batchTotal: task.batchTotal
          })
        }
      })

      // 继续处理队列
      this.processQueue()
    }
  }

  /**
   * 将 session 应用到 AlistService
   */
  private applySessionToAlist(session: AuthSession): void {
    this.setCredentials(session.userId, session.token)
    alistService.setToken(session.token)
    alistService.setBasePath(session.basePath)
    alistService.setUserId(session.userId)
  }

  /**
   * 处理认证失败：尝试恢复 session 并重试一次
   */
  private async handleAuthFailure(
    task: DownloadQueueTask & { dbId: number },
    authRetryCount: number
  ): Promise<boolean> {
    this.pauseQueue()

    if (authRetryCount === 0) {
      const recovered = await authService.ensureValidSession({ forceRefresh: true })
      if (recovered) {
        this.applySessionToAlist(recovered)
        task.userId = recovered.userId
        task.userToken = recovered.token
        task.url = undefined
        await this.transferService.updateStatus(task.dbId, 'pending')

        this.maxConcurrent = MAX_CONCURRENT_DOWNLOADS
        this.activeDownloads.set(task.id, task)
        await this.startDownload(task, authRetryCount + 1)
        return true
      }
    }

    await this.transferService.updateStatus(task.dbId, 'pending')
    this.queue.set(task.id, { ...task, url: undefined })

    if (!this.authFailedNotified) {
      this.authFailedNotified = true
      loggerService.error('DownloadQueueManager', 'Alist 认证失效，已暂停下载队列')
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('transfer:download:auth-failed', {
            error: ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE
          })
        }
      })
    }

    this.emitQueueUpdated()
    return true
  }

  /**
   * 获取队列状态
   */
  async getQueueState(): Promise<{
    pending: any[]
    active: any[]
    completed: any[]
    failed: any[]
    counts: {
      pending: number
      active: number
      completed: number
      failed: number
    }
  }> {
    const pending: any[] = []
    const active: any[] = []
    const completed: any[] = []
    const failed: any[] = []
    let completedCount = 0
    let failedCount = 0

    // pending：直接从内存 queue 读，批量查 DB 获取进度数据
    const pendingTasks = Array.from(this.queue.values())
    if (pendingTasks.length > 0) {
      const remotePaths = pendingTasks.map(t => t.remotePath)
      const taskStatusMap = await this.transferService.getTasksByRemotePaths(remotePaths, 'download')
      for (const task of pendingTasks) {
        const dbTask = taskStatusMap.get(task.remotePath)
        pending.push({
          id: task.id,
          fileName: task.fileName,
          remotePath: task.remotePath,
          savePath: task.savePath,
          fileSize: task.fileSize,
          downloadedBytes: dbTask?.transferredSize || 0,
          status: 'pending',
          progress: 0,
          speed: 0,
          error: null,
          createdAt: dbTask?.createdAt ? new Date(Number(dbTask.createdAt) * 1000) : new Date()
        })
      }
    }

    // active：直接从内存 activeDownloads 读，无需查 DB
    for (const task of this.activeDownloads.values()) {
      active.push({
        id: task.id,
        fileName: task.fileName,
        remotePath: task.remotePath,
        savePath: task.savePath,
        fileSize: task.fileSize,
        downloadedBytes: 0,
        status: 'in_progress',
        progress: 0,
        speed: 0,
        error: null,
        createdAt: new Date()
      })
    }

    // completed / failed：从数据库查历史记录
    try {
      const [recentCompleted, recentFailed, totalCompleted, totalFailed] = await Promise.all([
        this.transferService.getRecentCompletedTasks(this.userId, 'download', 200),
        this.transferService.getRecentFailedTasks(this.userId, 'download', 200),
        this.transferService.getTaskCount(this.userId, 'download', 'completed'),
        this.transferService.getTaskCount(this.userId, 'download', 'failed')
      ])
      completedCount = totalCompleted
      failedCount = totalFailed

      for (const dbTask of recentCompleted) {
        const fileSize: number = dbTask.fileSize ?? 0
        const transferredSize: number = dbTask.transferredSize ?? 0
        completed.push({
          id: `download_${dbTask.id}`,
          fileName: dbTask.fileName,
          remotePath: dbTask.remotePath,
          savePath: dbTask.filePath,
          fileSize,
          downloadedBytes: transferredSize,
          status: 'completed',
          progress: fileSize > 0 ? Math.round((transferredSize / fileSize) * 100) : 100,
          speed: 0,
          error: null,
          createdAt: dbTask.createdAt ? new Date(Number(dbTask.createdAt) * 1000) : new Date()
        })
      }

      for (const dbTask of recentFailed) {
        const fileSize: number = dbTask.fileSize ?? 0
        const transferredSize: number = dbTask.transferredSize ?? 0
        failed.push({
          id: `download_${dbTask.id}`,
          fileName: dbTask.fileName,
          remotePath: dbTask.remotePath,
          savePath: dbTask.filePath,
          fileSize,
          downloadedBytes: transferredSize,
          status: 'failed',
          progress: fileSize > 0 ? Math.round((transferredSize / fileSize) * 100) : 0,
          speed: 0,
          error: dbTask.errorMessage,
          createdAt: dbTask.createdAt ? new Date(Number(dbTask.createdAt) * 1000) : new Date()
        })
      }
    } catch (error) {
      loggerService.error('DownloadQueueManager', `获取历史任务失败: ${error}`)
    }

    return {
      pending,
      active,
      completed,
      failed,
      counts: {
        pending: pending.length,
        active: active.length,
        completed: completedCount,
        failed: failedCount
      }
    }
  }

  /**
   * 应用启动时恢复队列
   */
  async restoreQueue(userId: number, userToken: string): Promise<number> {
    // 保存凭证
    this.setCredentials(userId, userToken)

    // 从数据库读取未完成的任务
    const incompleteTasks = await this.transferService.getIncompleteDownloads(userId)

    let restoredCount = 0
    for (const dbTask of incompleteTasks) {
      const taskId = `download_${dbTask.id}`

      // 检查任务是否已在内存中（通过 taskId 快速检查）
      if (this.queue.has(taskId) || this.activeDownloads.has(taskId)) {
        continue
      }

      // 通过 remotePath 检查是否有相同文件正在下载（复用 isDuplicate 的内存检查部分）
      let inMemory = false
      for (const t of this.queue.values()) {
        if (t.remotePath === dbTask.remotePath) { inMemory = true; break }
      }
      if (!inMemory) {
        for (const t of this.activeDownloads.values()) {
          if (t.remotePath === dbTask.remotePath) { inMemory = true; break }
        }
      }
      if (inMemory) continue

      const task: DownloadQueueTask = {
        id: taskId,
        savePath: dbTask.filePath || undefined,
        fileName: dbTask.fileName,
        fileSize: dbTask.fileSize,
        userId: dbTask.userId,
        userToken,
        remotePath: dbTask.remotePath,
        priority: restoredCount,
        dbId: dbTask.id
      }
      this.queue.set(task.id, task)
      restoredCount++
    }

    // 处理队列
    this.processQueue()

    return restoredCount
  }

  /**
   * 从队列中移除指定任务
   */
  async removeFromQueue(taskId: string): Promise<void> {
    let cancelledTask: DownloadQueueTask | undefined

    // 如果是活跃下载，先中止网络请求
    if (this.activeDownloads.has(taskId)) {
      cancelledTask = this.activeDownloads.get(taskId)
      this.downloadManager.cancelDownload(taskId)
      this.activeDownloads.delete(taskId)
    }

    // 从等待队列移除
    if (this.queue.has(taskId)) {
      cancelledTask = cancelledTask || this.queue.get(taskId)
      this.queue.delete(taskId)
    }

    // 广播取消事件（含批次信息，让 renderer 完成 settled 计数）
    if (cancelledTask) {
      this.broadcastDownloadCancelled(cancelledTask)
    }

    // 通知队列更新
    this.emitQueueUpdated()

    // 尝试启动下一个等待的任务
    this.processQueue()
  }

  /**
   * 清空队列（清空已完成和失败的任务）
   */
  async clearQueue(): Promise<void> {
    // 从数据库删除已完成和已失败的下载记录
    await this.transferService.deleteCompletedDownloads()
    await this.transferService.deleteFailedDownloads()
    this.emitQueueUpdated()
  }

  /**
   * 清空等待中的任务
   */
  async clearPendingQueue(): Promise<void> {
    // queue 里全是 pending，直接清空
    this.queue.clear()
    // 同时清理数据库中残留的 pending 下载记录（应用异常退出时可能遗留）
    await this.transferService.cancelAllIncompleteDownloads()
    this.emitQueueUpdated()
  }

  /**
   * 清空正在下载的任务（中止并从队列移除）
   */
  async clearActiveQueue(): Promise<void> {
    this.downloadManager.abortAllActive()
    for (const task of this.activeDownloads.values()) {
      this.broadcastDownloadCancelled(task)
      if (task.savePath) {
        try { fs.unlinkSync(task.savePath) } catch (e: any) {
          if (e?.code !== 'ENOENT') loggerService.error('DownloadQueueManager', `清理文件失败: ${task.savePath} - ${e}`)
        }
      }
    }
    this.activeDownloads.clear()
    await this.transferService.cancelAllIncompleteDownloads()
    this.emitQueueUpdated()
  }

  /**
   * 暂停队列（不再启动新任务）
   */
  pauseQueue(): void {
    this.maxConcurrent = 0
  }

  /**
   * 恢复队列
   */
  resumeQueue(): void {
    this.authFailedNotified = false
    this.maxConcurrent = MAX_CONCURRENT_DOWNLOADS
    this.processQueue()
  }

  /**
   * 获取队列状态统计
   */
  async getStatus(): Promise<{ active: number; pending: number; maxConcurrent: number }> {
    const state = await this.getQueueState()
    return {
      active: state.active.length,
      pending: state.pending.length,
      maxConcurrent: this.maxConcurrent
    }
  }

  /**
   * 广播下载取消事件到所有窗口（含批次信息）
   */
  private broadcastDownloadCancelled(task: DownloadQueueTask): void {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('transfer:download:cancelled', {
          taskId: task.id,
          fileName: task.fileName,
          batchId: task.batchId,
          batchTotal: task.batchTotal
        })
      }
    })
  }

  /**
   * 发送队列更新事件（防抖：合并短时间内的多次调用）
   */
  private emitQueueUpdated(): void {
    if (this.emitTimer) clearTimeout(this.emitTimer)
    this.emitTimer = setTimeout(() => this.doEmitQueueUpdated(), 200)
  }

  private async doEmitQueueUpdated(): Promise<void> {
    try {
      const state = await this.getQueueState()
      // 确保 state 对象包含所有必需的属性
      const safeState = {
        pending: state.pending || [],
        active: state.active || [],
        completed: state.completed || [],
        failed: state.failed || [],
        counts: state.counts || {
          pending: state.pending?.length || 0,
          active: state.active?.length || 0,
          completed: state.completed?.length || 0,
          failed: state.failed?.length || 0
        }
      }
      loggerService.info('DownloadQueueManager', `发送队列更新事件: pending=${safeState.counts.pending}, active=${safeState.counts.active}, completed=${safeState.counts.completed}, failed=${safeState.counts.failed}`)
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('transfer:queue:updated', safeState)
        }
      })
    } catch (error) {
      loggerService.error('DownloadQueueManager', `发送队列更新事件失败: ${error}`)
    }
  }
}

export const downloadQueueManager = new DownloadQueueManager()
