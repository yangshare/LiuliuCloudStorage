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
}

export const queueService = new QueueService()
