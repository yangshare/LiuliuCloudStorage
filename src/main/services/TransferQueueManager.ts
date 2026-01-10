import { TransferService } from './TransferService'
import { alistService } from './AlistService'
import { orchestrationService } from './OrchestrationService'
import { BrowserWindow } from 'electron'

export interface QueueTask {
  id: number
  filePath: string
  remotePath: string
  userId: number
  userToken: string
  username: string
  fileName: string
  fileSize: number
}

type TaskCallback = (taskId: number, progress: number) => void

class TransferQueueManager {
  private queue: QueueTask[] = []
  private activeCount = 0
  private readonly MAX_CONCURRENT = 5
  private transferService: TransferService
  private onProgressCallback: TaskCallback | null = null

  constructor() {
    this.transferService = new TransferService()
  }

  setProgressCallback(callback: TaskCallback): void {
    this.onProgressCallback = callback
  }

  async addTask(task: QueueTask): Promise<void> {
    this.queue.push(task)
    await this.transferService.updateStatus(task.id, 'pending')
    this.processQueue()
  }

  private async processQueue(): Promise<void> {
    while (this.activeCount < this.MAX_CONCURRENT && this.queue.length > 0) {
      const task = this.queue.shift()
      if (task) {
        this.activeCount++
        this.executeTask(task)
      }
    }
  }

  private async executeTask(task: QueueTask): Promise<void> {
    try {
      await this.transferService.updateStatus(task.id, 'in_progress')

      // 配置 AlistService
      alistService.setToken(task.userToken)
      alistService.setBasePath(`/root/users/${task.username}/`)
      alistService.setUserId(task.userId)

      const uploadResult = await alistService.uploadFile(task.filePath, task.remotePath)

      if (uploadResult.success && uploadResult.taskId) {
        // 轮询进度
        await orchestrationService.waitForTaskCompletion(
          uploadResult.taskId,
          (progress) => {
            if (this.onProgressCallback) {
              this.onProgressCallback(task.id, progress)
            }
            // 发送进度到渲染进程
            const windows = BrowserWindow.getAllWindows()
            windows.forEach(win => {
              win.webContents.send('transfer:progress', { taskId: task.id, progress })
            })
          }
        )
        await this.transferService.updateStatus(task.id, 'completed')
      } else {
        await this.transferService.markAsFailed(task.id, uploadResult.error || '上传失败', 0)
      }
    } catch (error: any) {
      await this.transferService.markAsFailed(task.id, error.message || '上传失败', 0)
    } finally {
      this.activeCount--
      this.processQueue()
    }
  }

  async restore(): Promise<void> {
    // 从数据库恢复 pending 和 in_progress 任务需要 userId，这里暂时跳过
    // 实际恢复逻辑在用户登录后由 IPC handler 触发
  }

  getStatus(): { active: number; pending: number; maxConcurrent: number } {
    return {
      active: this.activeCount,
      pending: this.queue.length,
      maxConcurrent: this.MAX_CONCURRENT
    }
  }

  getActiveCount(): number {
    return this.activeCount
  }
}

export const transferQueueManager = new TransferQueueManager()
