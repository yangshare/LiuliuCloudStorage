import { transferQueueManager, type QueueTask } from '../../services/TransferQueueManager'
import { downloadQueueManager, type DownloadQueueTask } from '../../services/DownloadQueueManager'

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

  async cancelUploadTask(taskId: number): Promise<{ success: boolean; error?: string }> {
    return transferQueueManager.cancelTask(taskId)
  }

  async autoRetryAllUploads(userId: number, userToken: string, username: string): Promise<number> {
    return transferQueueManager.autoRetryAll(userId, userToken, username)
  }

  // ========== 下载队列 ==========

  setDownloadCredentials(userId: number, userToken: string): void {
    downloadQueueManager.setCredentials(userId, userToken)
  }

  async restoreDownloadQueue(userId: number, userToken: string): Promise<number> {
    return downloadQueueManager.restoreQueue(userId, userToken)
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

  resumeDownloadQueue(): void {
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

  async resumeUploadTask(taskId: number, userToken: string, username: string) {
    const { transferService } = await import('./transfer.service')
    const task = await transferService.getTask(taskId)
    if (!task) throw new Error('任务不存在')
    if (!task.resumable) throw new Error('该任务不支持恢复')

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

    return { success: true }
  }

  async queueDownloadWithSession(taskData: any) {
    const { authService } = await import('../auth/auth.service')
    const session = authService.getCurrentSession()
    if (!session) throw new Error('用户未登录')

    const task: DownloadQueueTask = {
      id: taskData.id || `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: taskData.fileName,
      fileSize: taskData.fileSize || 0,
      remotePath: taskData.remotePath,
      savePath: taskData.savePath,
      priority: taskData.priority || 0,
      userId: session.userId,
      userToken: session.token
    }

    const dbId = await this.addDownloadTask(task)
    return { success: true, taskId: task.id, dbId }
  }

  async batchQueueDownloadWithSession(remotePaths: string[]) {
    const { authService } = await import('../auth/auth.service')
    const session = authService.getCurrentSession()
    if (!session) throw new Error('用户未登录')

    const tasks: DownloadQueueTask[] = remotePaths.map((remotePath, i) => ({
      id: `download_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: remotePath.split('/').pop() || 'unknown',
      fileSize: 0,
      remotePath,
      priority: i,
      userId: session.userId,
      userToken: session.token
    }))

    const batchResult = await this.addBatchDownloadTasks(tasks)
    return { success: true, successCount: batchResult.length, failedCount: 0 }
  }

  async cancelDownloadTask(taskId: string) {
    const { DownloadManager } = await import('../../services/DownloadManager')
    const { transferService } = await import('./transfer.service')
    const downloadManager = new DownloadManager()
    await downloadManager.cancelDownload(taskId)
    await transferService.cancelTask(Number(taskId))
    await this.removeDownloadFromQueue(taskId)
    return { success: true }
  }
}

export const queueService = new QueueService()
