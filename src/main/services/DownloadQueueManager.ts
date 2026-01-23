import { TransferService } from './TransferService'
import { DownloadManager, type DownloadProgress } from './DownloadManager'
import { alistService } from './AlistService'
import { activityService, ActionType } from './ActivityService'
import { loggerService } from './LoggerService'
import { BrowserWindow } from 'electron'

export interface DownloadQueueTask {
  id: string
  url: string
  savePath: string
  fileName: string
  fileSize: number
  userId: number
  userToken: string
  username: string
  remotePath: string
  priority: number  // 优先级（越小越优先）
  dbId?: number  // 数据库记录 ID(可选)
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
  private queue: Map<string, DownloadQueueTask> = new Map()
  private activeDownloads: Set<string> = new Set()
  private recentlyCompleted: Set<string> = new Set()  // 跟踪最近完成的任务
  private maxConcurrent: number = 5
  private transferService: TransferService
  private downloadManager: DownloadManager
  private onProgressCallback: DownloadProgressCallback | null = null

  constructor() {
    this.transferService = new TransferService()
    this.downloadManager = new DownloadManager()
  }

  setProgressCallback(callback: DownloadProgressCallback): void {
    this.onProgressCallback = callback
  }

  /**
   * 添加下载任务到队列
   */
  async addToQueue(task: DownloadQueueTask): Promise<number> {
    // 创建数据库记录
    const dbTask = await this.transferService.create({
      userId: task.userId,
      taskType: 'download',
      fileName: task.fileName,
      filePath: task.savePath,
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
    await this.processQueue()

    // 通知渲染进程队列更新
    this.emitQueueUpdated()

    return dbTask.id
  }

  /**
   * 处理队列（启动等待的任务）
   */
  private async processQueue(): Promise<void> {
    // 如果已达到最大并发数，停止
    if (this.activeDownloads.size >= this.maxConcurrent) {
      return
    }

    // 查找等待中的任务（按优先级排序）
    const allTasks = Array.from(this.queue.values())

    // 批量获取所有任务的数据库状态(性能优化:一次查询替代 N 次查询)
    const remotePaths = allTasks.map(task => task.remotePath)
    const taskStatusMap = await this.transferService.getTasksByRemotePaths(remotePaths, 'download')

    const pendingTasks: (DownloadQueueTask & { dbId: number })[] = []

    for (const task of allTasks) {
      const dbTask = taskStatusMap.get(task.remotePath)

      // 只处理 pending 状态的任务，且：
      // 1. 有数据库 ID
      // 2. 不在活跃下载集合中（防止重复启动）
      // 3. 不在最近完成集合中（防止刚完成的任务被立即重新启动）
      if (dbTask && dbTask.status === 'pending' && task.dbId &&
          !this.activeDownloads.has(task.id) &&
          !this.recentlyCompleted.has(task.id)) {
        pendingTasks.push(task as DownloadQueueTask & { dbId: number })
      }
    }

    // 按优先级排序
    pendingTasks.sort((a, b) => a.priority - b.priority)

    // 启动最多 (maxConcurrent - active) 个任务
    const slotsAvailable = this.maxConcurrent - this.activeDownloads.size

    for (let i = 0; i < Math.min(slotsAvailable, pendingTasks.length); i++) {
      const task = pendingTasks[i]
      await this.startDownload(task)
    }
  }

  /**
   * 启动单个下载任务
   */
  private async startDownload(task: DownloadQueueTask & { dbId: number }): Promise<void> {
    // 标记为活跃
    this.activeDownloads.add(task.id)

    // 立即通知渲染进程：任务进入 active 状态
    this.emitQueueUpdated()

    try {
      // 开始下载(传递 dbId 以避免创建重复的数据库记录)
      await this.downloadManager.startDownload({ ...task, dbId: task.dbId }, (progress) => {
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
          win.webContents.send('transfer:download-progress', {
            taskId: task.id,
            fileName: task.fileName,
            progress: progress.percentage,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
            speed: progress.speed
          })
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

      // 添加到最近完成集合，防止立即重新启动
      this.recentlyCompleted.add(task.id)
      loggerService.info('DownloadQueueManager', `[队列] 任务完成，添加到最近完成集合: ${task.id}`)

      // 5秒后从最近完成集合移除
      setTimeout(() => {
        this.recentlyCompleted.delete(task.id)
        loggerService.info('DownloadQueueManager', `[队列] 从最近完成集合移除: ${task.id}`)
      }, 5000)

      // 发送完成事件
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(win => {
        win.webContents.send('transfer:download-completed', {
          taskId: task.id,
          fileName: task.fileName,
          savePath: task.savePath
        })
      })

      // 处理队列中的下一个任务
      await this.processQueue()

    } catch (error: any) {
      // 下载失败 - DownloadManager 已经标记了失败状态
      // 从活跃集合移除
      this.activeDownloads.delete(task.id)

      // 发送失败事件
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(win => {
        win.webContents.send('transfer:download-failed', {
          taskId: task.id,
          fileName: task.fileName,
          error: error.message
        })
      })

      // 处理队列中的下一个任务
      await this.processQueue()
    }
  }

  /**
   * 获取队列状态
   */
  async getQueueState(): Promise<{
    pending: any[]
    active: any[]
    completed: any[]
    failed: any[]
  }> {
    const tasks = Array.from(this.queue.values())

    // 批量获取所有任务的数据库状态(性能优化:一次查询替代 N 次查询)
    const remotePaths = tasks.map(task => task.remotePath)
    const taskStatusMap = await this.transferService.getTasksByRemotePaths(remotePaths, 'download')

    const pending: any[] = []
    const active: any[] = []
    const completed: any[] = []
    const failed: any[] = []

    // 转换为前端期望的数据结构
    const toFrontendTask = (task: DownloadQueueTask, dbTask: any, status: string) => ({
      id: task.id,
      fileName: task.fileName,
      remotePath: task.remotePath,
      savePath: task.savePath,
      fileSize: task.fileSize,
      downloadedBytes: dbTask?.transferredSize || 0,
      status: status,
      progress: dbTask?.transferredSize && task.fileSize ? Math.round((dbTask.transferredSize / task.fileSize) * 100) : 0,
      speed: 0,
      error: dbTask?.errorMessage,
      createdAt: dbTask?.createdAt ? new Date(dbTask.createdAt * 1000) : new Date()
    })

    for (const task of tasks) {
      const dbTask = taskStatusMap.get(task.remotePath)

      // 优先检查内存中的活跃状态（比数据库状态更实时）
      if (this.activeDownloads.has(task.id)) {
        active.push(toFrontendTask(task, dbTask, 'in_progress'))
        continue
      }

      if (!dbTask) continue

      switch (dbTask.status) {
        case 'pending':
          pending.push(toFrontendTask(task, dbTask, 'pending'))
          break
        case 'in_progress':
          // 如果数据库显示 in_progress 但内存中没有，说明可能是恢复的任务
          active.push(toFrontendTask(task, dbTask, 'in_progress'))
          break
        case 'completed':
          completed.push(toFrontendTask(task, dbTask, 'completed'))
          break
        case 'failed':
          failed.push(toFrontendTask(task, dbTask, 'failed'))
          break
      }
    }

    return { pending, active, completed, failed }
  }

  /**
   * 应用启动时恢复队列
   */
  async restoreQueue(userId: number, userToken: string, username: string): Promise<number> {
    // 从数据库读取未完成的任务
    const incompleteTasks = await this.transferService.getIncompleteDownloads(userId)

    // 初始化 AlistService 用于获取下载 URL
    const alistService = new AlistService(userToken, username)
    alistService.setUserId(userId)

    let restoredCount = 0
    for (const dbTask of incompleteTasks) {
      try {
        // 重新获取下载 URL
        const downloadResult = await alistService.getDownloadUrl(dbTask.remotePath)

        if (!downloadResult.success || !downloadResult.rawUrl) {
          loggerService.error('DownloadQueueManager', `无法获取下载 URL: ${dbTask.fileName}, error=${downloadResult.error}`)
          // 标记任务为失败状态
          await this.transferService.markAsFailed(dbTask.id, '无法获取下载 URL', 0)
          continue
        }

        // 重建任务对象
        const task: DownloadQueueTask = {
          id: `download_${dbTask.id}`,
          url: downloadResult.rawUrl,  // 使用重新获取的 URL
          savePath: dbTask.filePath,
          fileName: dbTask.fileName,
          fileSize: dbTask.fileSize,
          userId: dbTask.userId,
          userToken,
          username,
          remotePath: dbTask.remotePath,
          priority: restoredCount,
          dbId: dbTask.id  // 添加数据库 ID
        }

        this.queue.set(task.id, task)
        restoredCount++
      } catch (error: any) {
        loggerService.error('DownloadQueueManager', `恢复任务失败: ${dbTask.fileName}, error=${error}`)
        // 标记任务为失败状态
        await this.transferService.markAsFailed(dbTask.id, error.message, 0)
      }
    }

    // 处理队列
    await this.processQueue()

    return restoredCount
  }

  /**
   * 从队列中移除指定任务
   */
  async removeFromQueue(taskId: string): Promise<void> {
    // 从内存队列移除
    this.queue.delete(taskId)

    // 从活跃下载集合移除
    this.activeDownloads.delete(taskId)

    // 通知队列更新
    this.emitQueueUpdated()

    // 尝试启动下一个等待的任务
    await this.processQueue()
  }

  /**
   * 清空队列（仅清空已完成和失败的任务）
   */
  async clearQueue(): Promise<void> {
    const tasks = Array.from(this.queue.values())

    // 批量获取所有任务的数据库状态(性能优化:一次查询替代 N 次查询)
    const remotePaths = tasks.map(task => task.remotePath)
    const taskStatusMap = await this.transferService.getTasksByRemotePaths(remotePaths, 'download')

    for (const task of tasks) {
      const dbTask = taskStatusMap.get(task.remotePath)

      if (dbTask && (dbTask.status === 'completed' || dbTask.status === 'failed')) {
        this.queue.delete(task.id)
      }
    }

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
    this.maxConcurrent = 5
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
   * 发送队列更新事件
   */
  private async emitQueueUpdated(): Promise<void> {
    try {
      const state = await this.getQueueState()
      // 确保 state 对象包含所有必需的属性
      const safeState = {
        pending: state.pending || [],
        active: state.active || [],
        completed: state.completed || [],
        failed: state.failed || []
      }
      loggerService.info('DownloadQueueManager', `发送队列更新事件: pending=${safeState.pending.length}, active=${safeState.active.length}, completed=${safeState.completed.length}, failed=${safeState.failed.length}`)
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('transfer:queue-updated', safeState)
        }
      })
    } catch (error) {
      loggerService.error('DownloadQueueManager', `发送队列更新事件失败: ${error}`)
    }
  }
}

export const downloadQueueManager = new DownloadQueueManager()
