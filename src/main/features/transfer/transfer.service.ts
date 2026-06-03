import { eq, desc, and, or, inArray, count } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getDatabase } from '../../database'
import { SQLITE_BATCH_SIZE } from '../../database/constants'
import { transferQueue, type NewTransferQueue, type TransferQueue } from '../../database/schema'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'
import type { TransferTask, TransferStatus } from '../../../shared/types/transfer'
import { processInBatches } from '../../utils/batch'

export class TransferService {
  private get db() { return drizzle(getDatabase()) }

  // ========== 基础查询 ==========

  async getTasksByUser(userId: number): Promise<TransferTask[]> {
    const rows = await this.db.select().from(transferQueue).where(eq(transferQueue.userId, userId)).orderBy(desc(transferQueue.createdAt)).all()
    return rows.map(r => this.toTransferTask(r))
  }

  async getTask(taskId: number): Promise<TransferQueue | undefined> {
    return this.db.select().from(transferQueue).where(eq(transferQueue.id, taskId)).get()
  }

  async getTaskById(taskId: number): Promise<TransferQueue | undefined> {
    return this.getTask(taskId)
  }

  // ========== 创建 ==========

  async create(task: NewTransferQueue): Promise<TransferQueue> {
    const result = this.db.insert(transferQueue).values(task).returning().get()
    return result
  }

  async createBatch(tasks: NewTransferQueue[]): Promise<TransferQueue[]> {
    return this.db.insert(transferQueue).values(tasks).returning().all()
  }

  // ========== 更新 ==========

  async updateStatus(taskId: number, status: TransferQueue['status']): Promise<void> {
    this.db.update(transferQueue)
      .set({ status, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateProgress(taskId: number, transferredSize: number): Promise<void> {
    this.db.update(transferQueue)
      .set({ transferredSize, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateFileSize(taskId: number, fileSize: number): Promise<void> {
    this.db.update(transferQueue)
      .set({ fileSize, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateFilePath(taskId: number, filePath: string): Promise<void> {
    this.db.update(transferQueue)
      .set({ filePath, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async markAsFailed(taskId: number, errorMessage: string, transferredSize: number): Promise<void> {
    this.db.update(transferQueue)
      .set({
        status: 'failed',
        errorMessage,
        transferredSize,
        resumable: true,
        updatedAt: new Date()
      })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async resumeTask(taskId: number): Promise<void> {
    this.db.update(transferQueue)
      .set({
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  // ========== 取消 ==========

  async cancelTask(taskId: number): Promise<void> {
    this.db.update(transferQueue)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async cancelTasks(taskIds: number[]): Promise<void> {
    if (taskIds.length === 0) return
    // better-sqlite3 事务回调是同步的，必须用同步 for 循环而非 async processInBatches
    getDatabase().transaction(() => {
      for (let i = 0; i < taskIds.length; i += SQLITE_BATCH_SIZE) {
        const batch = taskIds.slice(i, i + SQLITE_BATCH_SIZE)
        this.db.update(transferQueue)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(inArray(transferQueue.id, batch))
          .run()
      }
    })()
  }

  async cancelAllUserTasks(userId: number, taskType: 'upload' | 'download'): Promise<void> {
    this.db.update(transferQueue)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, taskType),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .run()
  }

  async cancelAllIncompleteDownloads(): Promise<void> {
    this.db.update(transferQueue)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(transferQueue.taskType, 'download'),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .run()
  }

  // ========== 删除 ==========

  async deleteTask(taskId: number): Promise<void> {
    this.db.delete(transferQueue)
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async deleteCompletedDownloads(): Promise<void> {
    this.db.delete(transferQueue)
      .where(and(
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'completed')
      ))
      .run()
  }

  async deleteFailedDownloads(): Promise<void> {
    this.db.delete(transferQueue)
      .where(and(
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'failed')
      ))
      .run()
  }

  // ========== 恢复相关 ==========

  async getRecoverableTasks(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, 'upload'),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .all()
  }

  async getResumableTasks(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.status, 'failed'),
        eq(transferQueue.resumable, true)
      ))
      .all()
  }

  // ========== 下载队列查询 ==========

  async getPendingDownloads(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'pending')
      ))
      .all()
  }

  async getActiveDownloads(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'in_progress')
      ))
      .all()
  }

  async getIncompleteDownloads(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, 'download'),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .all()
  }

  // ========== 路径查询 ==========

  async getTaskByRemotePath(remotePath: string, taskType: 'upload' | 'download'): Promise<TransferQueue | undefined> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.remotePath, remotePath),
        eq(transferQueue.taskType, taskType),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .get()
  }

  async getTasksByRemotePaths(remotePaths: string[], taskType: 'upload' | 'download'): Promise<Map<string, TransferQueue>> {
    if (remotePaths.length === 0) {
      return new Map()
    }

    const taskMap = new Map<string, TransferQueue>()
    await processInBatches(remotePaths, (batch) => {
      const tasks = this.db.select()
        .from(transferQueue)
        .where(and(
          eq(transferQueue.taskType, taskType),
          inArray(transferQueue.remotePath, batch)
        ))
        .all()
      for (const task of tasks) {
        taskMap.set(task.remotePath, task)
      }
    })

    return taskMap
  }

  // ========== 统计 ==========

  async getTaskCount(userId: number, taskType: 'download' | 'upload', status: TransferQueue['status']): Promise<number> {
    const result = this.db.select({ value: count() })
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, taskType),
        eq(transferQueue.status, status)
      ))
      .get()

    return result?.value ?? 0
  }

  async getDownloadCount(userId: number, status?: TransferQueue['status']): Promise<number> {
    const conditions: ReturnType<typeof eq>[] = [
      eq(transferQueue.userId, userId),
      eq(transferQueue.taskType, 'download')
    ]

    if (status) {
      conditions.push(eq(transferQueue.status, status))
    }

    const result = this.db.select({ count: transferQueue.id })
      .from(transferQueue)
      .where(and(...conditions))
      .all()

    return result.length
  }

  // ========== 最近任务 ==========

  async getRecentCompletedTasks(userId: number, taskType: 'download' | 'upload', limit?: number): Promise<TransferQueue[]> {
    const query = this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, taskType),
        eq(transferQueue.status, 'completed')
      ))
      .orderBy(desc(transferQueue.updatedAt))
    if (limit !== undefined) {
      return query.limit(limit).all()
    }
    return query.all()
  }

  async getRecentFailedTasks(userId: number, taskType: 'download' | 'upload', limit?: number): Promise<TransferQueue[]> {
    const query = this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, taskType),
        eq(transferQueue.status, 'failed')
      ))
      .orderBy(desc(transferQueue.updatedAt))
    if (limit !== undefined) {
      return query.limit(limit).all()
    }
    return query.all()
  }

  // ========== 上传下载业务方法 ==========

  async uploadFile(
    params: {
      filePath: string
      remotePath: string
      userId: number
      userToken: string
      localTaskId: string
    },
    onProgress?: (data: { taskId: string; progress: number; transferredSize: number }) => void
  ) {
    const { alistService } = await import('../../core/api/alist.service')
    const { orchestrationService } = await import('./orchestration.service')
    const fs = await import('fs')
    const path = await import('path')

    if (!fs.existsSync(params.filePath)) {
      throw new IPCError('文件不存在', IPCErrorCode.NOT_FOUND)
    }

    alistService.setToken(params.userToken)
    alistService.setBasePath('/alist/')
    alistService.setUserId(params.userId)

    const fileStats = fs.statSync(params.filePath)
    const fileName = path.basename(params.filePath)

    const uploadResult = await alistService.uploadFile(params.filePath, params.remotePath)
    if (!uploadResult.success) {
      throw new IPCError(uploadResult.error || '上传失败', IPCErrorCode.NETWORK)
    }

    let lastProgress = 0
    const success = await orchestrationService.waitForTaskCompletion(
      uploadResult.taskId!,
      (progress) => {
        if (progress !== lastProgress && onProgress) {
          const transferredSize = Math.floor((fileStats.size * progress) / 100)
          onProgress({
            taskId: params.localTaskId,
            progress,
            transferredSize
          })
          lastProgress = progress
        }
      }
    )

    if (!success) {
      throw new IPCError('上传任务执行失败', IPCErrorCode.NETWORK)
    }

    return {
      taskId: uploadResult.taskId,
      fileInfo: {
        fileName,
        fileSize: fileStats.size,
        remotePath: `${alistService.getBasePath()}${params.remotePath}`,
        uploadedAt: new Date().toISOString()
      }
    }
  }

  async downloadFile(
    params: {
      remotePath: string
      fileName: string
      userId: number
      userToken: string
      savePath?: string
    },
    onProgress?: (data: {
      taskId: string
      fileName: string
      progress: number
      downloadedBytes: number
      totalBytes: number
      speed: number
    }) => void,
    onCompleted?: (data: { taskId: string; fileName: string; savePath: string }) => void,
    onFailed?: (data: { taskId: string; fileName: string; error: string }) => void
  ) {
    const { alistService } = await import('../../core/api/alist.service')
    const { DownloadManager } = await import('./download.manager')
    const path = await import('path')

    alistService.setToken(params.userToken)
    alistService.setBasePath('/alist/')
    alistService.setUserId(params.userId)

    const downloadResult = await alistService.getDownloadUrl(params.remotePath)
    if (!downloadResult.success) {
      throw new IPCError(downloadResult.error || '获取下载链接失败', IPCErrorCode.NETWORK)
    }

    const downloadManager = new DownloadManager()
    const savePath = params.savePath || path.join(downloadManager.getDefaultDownloadPath(), params.fileName)
    const taskId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    downloadManager.startDownload({
      id: taskId,
      url: downloadResult.rawUrl!,
      savePath,
      fileName: downloadResult.fileName!,
      fileSize: downloadResult.fileSize!,
      userId: params.userId,
      userToken: params.userToken,
      remotePath: params.remotePath
    }, (progress) => {
      if (onProgress) {
        onProgress({
          taskId,
          fileName: downloadResult.fileName!,
          progress: progress.percentage,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
          speed: progress.speed
        })
      }
    }).then((actualSavePath) => {
      if (onCompleted) {
        onCompleted({
          taskId,
          fileName: downloadResult.fileName!,
          savePath: actualSavePath
        })
      }
    }).catch((error) => {
      if (onFailed) {
        onFailed({
          taskId,
          fileName: downloadResult.fileName!,
          error: error.message
        })
      }
    })

    return { taskId, savePath }
  }

  async saveAs(fileName: string, userId: number) {
    const { dialog } = await import('electron')
    const { DownloadManager } = await import('./download.manager')
    const { preferencesService } = await import('../../core/preferences/preferences.service')
    const path = await import('path')

    const downloadManager = new DownloadManager()
    const lastPath = preferencesService.getLastDownloadPath(userId)
    const defaultPath = lastPath
      ? path.join(lastPath, fileName)
      : path.join(downloadManager.getDefaultDownloadPath(), fileName)

    const result = await dialog.showSaveDialog({
      title: '选择下载保存位置',
      defaultPath,
      buttonLabel: '保存',
      filters: [{ name: 'All Files', extensions: ['*'] }],
      properties: ['createDirectory']
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    const selectedDir = path.dirname(result.filePath)
    preferencesService.saveLastDownloadPath(userId, selectedDir)

    return { filePath: result.filePath }
  }

  async resumeDownload(
    taskId: string,
    onProgress?: (data: {
      taskId: string
      progress: number
      downloadedBytes: number
      totalBytes: number
      speed: number
    }) => void,
    onCompleted?: (data: { taskId: string; fileName: string; savePath: string }) => void
  ) {
    const { DownloadManager } = await import('./download.manager')
    const downloadManager = new DownloadManager()
    const taskInfo = await this.getTask(Number(taskId))

    if (!taskInfo) {
      throw new IPCError('任务不存在', IPCErrorCode.NOT_FOUND)
    }

    await downloadManager.resumeDownload(Number(taskId), (progress) => {
      if (onProgress) {
        onProgress({
          taskId,
          progress: progress.percentage,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
          speed: progress.speed
        })
      }
    })

    if (onCompleted) {
      onCompleted({
        taskId,
        fileName: taskInfo.fileName || '',
        savePath: taskInfo.filePath || ''
      })
    }

  }

  // ========== 工具方法 ==========

  private toTransferTask(r: TransferQueue): TransferTask {
    return {
      id: r.id,
      filePath: r.filePath,
      remotePath: r.remotePath,
      fileName: r.fileName,
      fileSize: r.fileSize || 0,
      transferredSize: r.transferredSize || 0,
      status: r.status as TransferStatus,
      userId: r.userId,
      taskType: r.taskType,
      createdAt: r.createdAt?.toISOString() || new Date().toISOString()
    }
  }
}

export const transferService = new TransferService()
