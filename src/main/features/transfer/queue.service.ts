import { randomUUID } from 'crypto'
import { transferQueueManager, type QueueTask } from './transfer-queue.manager'
import { downloadQueueManager, type DownloadQueueTask } from './download-queue.manager'
import { authService } from '../auth/auth.service'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'

export interface TransferQueueStatus {
  active: number
  pending: number
  maxConcurrent: number
}

export interface DownloadQueueState {
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
}

export class QueueService {
  // ========== 上传队列 ==========

  async addUploadTask(task: QueueTask): Promise<void> {
    await transferQueueManager.addTask(task)
  }

  getUploadQueueStatus(): TransferQueueStatus {
    return transferQueueManager.getStatus()
  }

  async cancelUploadTask(taskId: number): Promise<void> {
    await transferQueueManager.cancelTask(taskId)
  }

  async autoRetryAllUploads(userId: number, userToken: string, username: string): Promise<number> {
    return transferQueueManager.autoRetryAll(userId, userToken, username)
  }

  // ========== 下载队列 ==========

  private async getValidDownloadSession(): Promise<{ userId: number; username: string; token: string; basePath: string }> {
    const session = await authService.ensureValidSession()
    if (!session) throw new IPCError('Alist 登录已过期，请重新登录后恢复下载', IPCErrorCode.UNAUTHORIZED)
    return session
  }

  setDownloadCredentials(userId: number, userToken: string): void {
    downloadQueueManager.setCredentials(userId, userToken)
  }

  async restoreDownloadQueue(_userId: number, _userToken: string): Promise<number> {
    const session = await this.getValidDownloadSession()
    downloadQueueManager.setCredentials(session.userId, session.token)
    return downloadQueueManager.restoreQueue(session.userId, session.token)
  }

  async addDownloadTask(task: DownloadQueueTask): Promise<number> {
    return downloadQueueManager.addToQueue(task)
  }

  async addBatchDownloadTasks(tasks: DownloadQueueTask[]): Promise<Array<{ taskId: string; dbId: number }>> {
    return downloadQueueManager.addBatchToQueue(tasks)
  }

  async getDownloadQueueState(): Promise<DownloadQueueState> {
    return downloadQueueManager.getQueueState()
  }

  pauseDownloadQueue(): void {
    downloadQueueManager.pauseQueue()
  }

  async resumeDownloadQueue(): Promise<void> {
    const session = await this.getValidDownloadSession()
    downloadQueueManager.setCredentials(session.userId, session.token)
    downloadQueueManager.resumeQueue()
  }

  async clearDownloadQueue(): Promise<void> {
    await downloadQueueManager.clearQueue()
  }

  async clearPendingQueue(): Promise<void> {
    await downloadQueueManager.clearPendingQueue()
  }

  async clearActiveQueue(): Promise<void> {
    await downloadQueueManager.clearActiveQueue()
  }

  async cancelAllActiveDownloads(): Promise<void> {
    await downloadQueueManager.clearActiveQueue()
  }

  async removeDownloadFromQueue(taskId: string): Promise<void> {
    await downloadQueueManager.removeFromQueue(taskId)
  }

  getDownloadStatus(): Promise<TransferQueueStatus> {
    return downloadQueueManager.getStatus()
  }

  // ========== 恢复队列 ==========

  async restoreUploadQueue(userId: number, userToken: string, username: string) {
    const { transferService } = await import('./transfer.service')
    const tasks = await transferService.getRecoverableTasks(userId)
    for (const task of tasks) {
      await this.addUploadTask({
        id: task.id,
        filePath: task.filePath,
        remotePath: task.remotePath,
        userId: task.userId,
        userToken,
        username,
        fileName: task.fileName,
        fileSize: task.fileSize
      })
    }
    return { restored: tasks.length }
  }

  async resumeUploadTask(taskId: number, userToken: string, username: string): Promise<void> {
    const { transferService } = await import('./transfer.service')
    const task = await transferService.getTask(taskId)
    if (!task) throw new IPCError('任务不存在', IPCErrorCode.NOT_FOUND)
    if (!task.resumable) throw new IPCError('该任务不支持恢复', IPCErrorCode.CONFLICT)

    await transferService.resumeTask(taskId)
    await this.addUploadTask({
      id: task.id,
      filePath: task.filePath,
      remotePath: task.remotePath,
      userId: task.userId,
      userToken,
      username,
      fileName: task.fileName,
      fileSize: task.fileSize
    })
  }

  async queueDownloadWithSession(taskData: any) {
    const session = await this.getValidDownloadSession()

    const task: DownloadQueueTask = {
      id: taskData.id || `download_${Date.now()}_${randomUUID()}`,
      fileName: taskData.fileName,
      fileSize: taskData.fileSize || 0,
      remotePath: taskData.remotePath,
      savePath: taskData.savePath,
      priority: taskData.priority || 0,
      userId: session.userId,
      userToken: session.token
    }

    const dbId = await this.addDownloadTask(task)
    return { taskId: task.id, dbId }
  }

  async batchQueueDownloadWithSession(remotePaths: string[]) {
    const session = await this.getValidDownloadSession()
    const batchId = `batch_${Date.now()}_${randomUUID()}`
    const tasks: DownloadQueueTask[] = remotePaths.map((remotePath, i) => ({
      id: `download_${Date.now()}_${i}_${randomUUID()}`,
      fileName: remotePath.split('/').pop() || 'unknown',
      fileSize: 0,
      remotePath,
      priority: i,
      userId: session.userId,
      userToken: session.token,
      batchId
    }))

    const batchResult = await this.addBatchDownloadTasks(tasks)
    return {
      successCount: batchResult.length,
      failedCount: tasks.length - batchResult.length,
      batchId
    }
  }

  async cancelDownloadTask(taskId: string): Promise<void> {
    const { DownloadManager } = await import('./download.manager')
    const { transferService } = await import('./transfer.service')
    const downloadManager = new DownloadManager()
    await downloadManager.cancelDownload(taskId)
    await transferService.cancelTask(Number(taskId))
    await this.removeDownloadFromQueue(taskId)
  }
}

export const queueService = new QueueService()
