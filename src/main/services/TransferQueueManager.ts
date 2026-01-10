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
  private readonly MAX_RETRIES = 3  // 最大重试次数
  private transferService: TransferService
  private onProgressCallback: TaskCallback | null = null
  private retryCount = new Map<number, number>()  // 记录每个任务的重试次数
  private activeTaskIds = new Map<number, string>()  // taskId -> alistTaskId

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

      // 获取任务信息（支持断点续传）
      const taskInfo = await this.transferService.getTask(task.id)
      const startByte = taskInfo?.transferredSize || 0

      const uploadResult = await alistService.uploadFile(task.filePath, task.remotePath, { startByte })

      if (uploadResult.success && uploadResult.taskId) {
        // 记录 alistTaskId 用于取消
        this.activeTaskIds.set(task.id, uploadResult.taskId)

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
        // 清除重试计数和 alistTaskId
        this.retryCount.delete(task.id)
        this.activeTaskIds.delete(task.id)
        // 发送任务完成事件到渲染进程
        const windows = BrowserWindow.getAllWindows()
        windows.forEach(win => {
          win.webContents.send('transfer:completed', { taskId: task.id, fileName: task.fileName })
        })
      } else {
        throw new Error(uploadResult.error || '上传失败')
      }
    } catch (error: any) {
      const errorMessage = error.message || '上传失败'

      // 获取当前重试次数
      const currentRetries = this.retryCount.get(task.id) || 0

      if (currentRetries < this.MAX_RETRIES) {
        // 可以重试：保存断点信息并延迟重试
        const taskInfo = await this.transferService.getTask(task.id)
        const transferredSize = taskInfo?.transferredSize || 0

        await this.transferService.markAsFailed(task.id, errorMessage, transferredSize)

        // 增加重试计数
        this.retryCount.set(task.id, currentRetries + 1)

        // 5 秒后自动重试
        setTimeout(() => {
          this.retryTask(task.id)
        }, 5000)

        console.log(`[TransferQueueManager] 任务 ${task.id} 失败，5 秒后重试 (${currentRetries + 1}/${this.MAX_RETRIES})`)
      } else {
        // 超过最大重试次数：永久失败
        await this.transferService.markAsFailed(task.id, errorMessage, 0)
        this.retryCount.delete(task.id)

        // 发送任务失败事件到渲染进程
        const windows = BrowserWindow.getAllWindows()
        windows.forEach(win => {
          win.webContents.send('transfer:failed', { taskId: task.id, fileName: task.fileName, error: errorMessage })
        })
      }
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

  // 手动重试任务
  async retryTask(taskId: number): Promise<void> {
    const task = await this.transferService.getTask(taskId)
    if (task && task.resumable) {
      // 重置状态为 in_progress
      await this.transferService.resumeTask(taskId)
      // 重新添加到队列
      await this.addTask({
        id: task.id,
        filePath: task.filePath,
        remotePath: task.remotePath,
        userId: task.userId,
        userToken: '',  // 需要从外部传入
        username: '',  // 需要从外部传入
        fileName: task.fileName,
        fileSize: task.fileSize
      })
    }
  }

  // 自动重试所有可恢复任务（网络恢复时调用）
  async autoRetryAll(userId: number, userToken: string, username: string): Promise<number> {
    const resumableTasks = await this.transferService.getResumableTasks(userId)
    let retriedCount = 0

    for (const task of resumableTasks) {
      await this.transferService.resumeTask(task.id)
      await this.addTask({
        id: task.id,
        filePath: task.filePath,
        remotePath: task.remotePath,
        userId: task.userId,
        userToken,
        username,
        fileName: task.fileName,
        fileSize: task.fileSize
      })
      retriedCount++
    }

    console.log(`[TransferQueueManager] 自动重试了 ${retriedCount} 个失败任务`)
    return retriedCount
  }

  // 取消任务
  async cancelTask(taskId: number): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TransferQueueManager] 尝试取消任务 ${taskId}`)

      // 1. 从队列中移除（如果在等待队列）
      const queueIndex = this.queue.findIndex(t => t.id === taskId)
      if (queueIndex !== -1) {
        this.queue.splice(queueIndex, 1)
        console.log(`[TransferQueueManager] 任务 ${taskId} 从等待队列移除`)
      }

      // 2. 如果任务正在执行，记录已取消（不调用 Alist API，因为需要 n8n webhook 配置）
      const alistTaskId = this.activeTaskIds.get(taskId)
      if (alistTaskId) {
        console.log(`[TransferQueueManager] 任务 ${taskId} 正在执行，alistTaskId: ${alistTaskId}`)
        // TODO: 调用 Alist API 取消任务（需要 n8n webhook 配置）
        // const success = await orchestrationService.cancelTask(alistTaskId)

        // 释放并发槽位
        this.activeCount--
        this.activeTaskIds.delete(taskId)
        console.log(`[TransferQueueManager] 任务 ${taskId} 释放并发槽位`)
      }

      // 3. 更新数据库状态为 cancelled
      await this.transferService.updateStatus(taskId, 'cancelled')
      console.log(`[TransferQueueManager] 任务 ${taskId} 状态更新为 cancelled`)

      // 4. 启动下一个等待任务
      this.processQueue()

      // 5. 发送取消事件到渲染进程
      const taskInfo = await this.transferService.getTask(taskId)
      if (taskInfo) {
        const windows = BrowserWindow.getAllWindows()
        windows.forEach(win => {
          win.webContents.send('transfer:cancelled', {
            taskId: taskId,
            fileName: taskInfo.fileName
          })
        })
      }

      return { success: true }
    } catch (error: any) {
      console.error(`[TransferQueueManager] 取消任务 ${taskId} 失败:`, error)
      return { success: false, error: error.message || '取消任务失败' }
    }
  }
}

export const transferQueueManager = new TransferQueueManager()
