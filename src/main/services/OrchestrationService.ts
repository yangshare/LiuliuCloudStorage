import axios, { AxiosInstance } from 'axios'
import { AppError } from './httpClient'

export interface TaskProgress {
  state: number  // 0: pending, 1: running, 2: succeeded, 3: failed
  progress: number  // 0-100
  error?: string
}

interface AlistAdminTaskResponse {
  code: number
  message?: string
  data: {
    tasks: Array<{
      id: string
      state: number
      progress: number
      error?: string
    }>
  }
}

class OrchestrationService {
  private n8nBaseUrl: string = ''

  initialize(n8nBaseUrl: string): void {
    this.n8nBaseUrl = n8nBaseUrl
  }

  async pollTaskProgress(taskId: string): Promise<TaskProgress> {
    if (!this.n8nBaseUrl) {
      throw { code: 'NOT_INITIALIZED', message: 'OrchestrationService 未初始化' } as AppError
    }

    try {
      const response = await axios.post<AlistAdminTaskResponse>(
        `${this.n8nBaseUrl}/webhook/alist-admin-task-list`,
        { task_id: taskId },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      )

      if (response.data.code !== 200) {
        throw {
          code: `N8N_${response.data.code}`,
          message: response.data.message || '获取任务进度失败'
        } as AppError
      }

      const task = response.data.data.tasks.find(t => t.id === taskId)
      if (!task) {
        throw {
          code: 'TASK_NOT_FOUND',
          message: `任务 ${taskId} 未找到`
        } as AppError
      }

      return {
        state: task.state,
        progress: task.progress,
        error: task.error
      }
    } catch (error: any) {
      throw {
        code: error.code || 'POLL_ERROR',
        message: error.message || '轮询任务进度失败'
      } as AppError
    }
  }

  async waitForTaskCompletion(
    taskId: string,
    onProgress?: (progress: number) => void,
    maxWaitMs: number = 30 * 60 * 1000 // 默认 30 分钟超时
  ): Promise<boolean> {
    const startTime = Date.now()

    while (true) {
      // 检查超时
      if (Date.now() - startTime > maxWaitMs) {
        throw {
          code: 'UPLOAD_TIMEOUT',
          message: '上传超时，请检查网络连接后重试'
        } as AppError
      }

      const progress = await this.pollTaskProgress(taskId)

      if (onProgress) {
        onProgress(progress.progress)
      }

      if (progress.state === 2) {
        return true  // 成功
      } else if (progress.state === 3) {
        throw {
          code: 'UPLOAD_FAILED',
          message: progress.error || '上传失败'
        } as AppError
      }

      // 等待 500ms 后继续轮询
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  isInitialized(): boolean {
    return this.n8nBaseUrl !== ''
  }
}

export const orchestrationService = new OrchestrationService()
