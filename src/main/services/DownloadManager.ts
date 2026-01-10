import { net, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { TransferService } from './TransferService'

export interface DownloadTaskInput {
  id: string
  url: string
  savePath: string
  fileName: string
  fileSize: number
  userId: number
  userToken: string
  username: string
  remotePath: string
  dbId?: number  // 数据库记录 ID(可选,如果提供则不创建新记录)
}

export interface DownloadProgress {
  downloadedBytes: number
  totalBytes: number
  percentage: number
  speed: number  // bytes per second
}

export class DownloadManager {
  private transferService: TransferService
  private activeRequests: Map<string | number, any> = new Map()

  constructor() {
    this.transferService = new TransferService()
  }

  async startDownload(
    task: DownloadTaskInput,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    let dbTask: any = null

    try {
      // 检查是否已提供数据库记录 ID
      if (task.dbId) {
        // 使用现有的数据库记录
        dbTask = await this.transferService.getTaskById(task.dbId)
        if (!dbTask) {
          throw new Error(`数据库记录不存在: ${task.dbId}`)
        }
      } else {
        // 创建新的数据库记录
        const createdTask = await this.transferService.create({
          userId: task.userId,
          taskType: 'download',
          fileName: task.fileName,
          filePath: task.savePath,
          remotePath: task.remotePath,
          fileSize: task.fileSize,
          status: 'pending',
          transferredSize: 0,
          resumable: true  // 下载支持断点续传
        })
        dbTask = createdTask
      }

      // 更新状态为 in_progress
      await this.transferService.updateStatus(dbTask.id, 'in_progress')

      // 开始下载
      await this.downloadFile(task.url, task.savePath, dbTask.id, async (progress) => {
        // 更新进度到数据库
        await this.transferService.updateProgress(dbTask.id, progress.downloadedBytes)

        // 回调进度
        if (onProgress) {
          onProgress(progress)
        }
      })

      // 下载完成
      await this.transferService.updateStatus(dbTask.id, 'completed')
    } catch (error: any) {
      // 下载失败
      if (dbTask) {
        await this.transferService.markAsFailed(dbTask.id, error.message, 0)
      }
      throw error
    }
  }

  /**
   * 支持断点续传的下载方法
   */
  async resumeDownload(
    taskId: number,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    // 从数据库获取任务信息
    const task = await this.transferService.getTaskById(taskId)

    if (!task) {
      throw new Error('任务不存在')
    }

    if (task.status !== 'failed' && task.status !== 'cancelled') {
      throw new Error('任务状态不支持恢复')
    }

    // 更新状态为 in_progress
    await this.transferService.updateStatus(taskId, 'in_progress')

    try {
      // 检查本地文件
      const fileExists = fs.existsSync(task.filePath)
      let startPosition = task.transferredSize || 0

      if (fileExists) {
        const stats = fs.statSync(task.filePath)
        startPosition = Math.max(startPosition, stats.size)
      }

      // 从断点继续下载
      await this.downloadFileWithResume(task.url || '', task.filePath, taskId, startPosition, async (progress) => {
        // 更新进度到数据库
        await this.transferService.updateProgress(taskId, progress.downloadedBytes)

        // 回调进度
        if (onProgress) {
          onProgress(progress)
        }
      })

      // 下载完成
      await this.transferService.updateStatus(taskId, 'completed')
    } catch (error: any) {
      // 恢复失败
      await this.transferService.markAsFailed(taskId, error.message, 0)
      throw error
    }
  }

  /**
   * 带断点续传的下载方法
   */
  private async downloadFileWithResume(
    url: string,
    savePath: string,
    taskId: string | number,
    transferredSize: number = 0,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // 确保保存目录存在
      const dir = path.dirname(savePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // 检查本地文件是否存在
      const fileExists = fs.existsSync(savePath)
      let startPosition = transferredSize

      if (fileExists) {
        const stats = fs.statSync(savePath)
        startPosition = Math.max(startPosition, stats.size)
      }

      // 创建写入流（追加模式）
      const file = fileExists
        ? fs.createWriteStream(savePath, { flags: 'a' })
        : fs.createWriteStream(savePath)

      let downloadedBytes = startPosition
      let startTime = Date.now()

      const request = net.request(url)

      // 保存请求引用（用于取消）
      this.activeRequests.set(taskId, request)

      // 添加 Range 请求头
      if (startPosition > 0) {
        request.setHeader('Range', `bytes=${startPosition}-`)
      }

      request.on('response', (response) => {
        // 检查服务器是否支持 Range 请求
        const acceptRanges = response.headers['accept-ranges']
        const contentRange = response.headers['content-range']

        if (startPosition > 0 && !acceptRanges && !contentRange) {
          file.close()
          this.activeRequests.delete(taskId)
          reject(new Error('服务器不支持断点续传'))
          return
        }

        // 获取总文件大小
        let totalBytes = startPosition
        if (contentRange) {
          // Content-Range: bytes xxx-xxx/total
          const match = contentRange.match(/\/(\d+)$/)
          if (match) {
            totalBytes = parseInt(match[1], 10)
          }
        } else {
          totalBytes = parseInt(response.headers['content-length'] || '0', 10) + startPosition
        }

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length
          file.write(chunk)

          if (onProgress && totalBytes > 0) {
            const elapsedSeconds = (Date.now() - startTime) / 1000
            const speed = elapsedSeconds > 0 ? Math.floor((downloadedBytes - startPosition) / elapsedSeconds) : 0

            onProgress({
              downloadedBytes,
              totalBytes,
              percentage: Math.floor((downloadedBytes / totalBytes) * 100),
              speed
            })
          }
        })

        response.on('end', () => {
          file.close()
          this.activeRequests.delete(taskId)
          resolve()
        })

        response.on('error', (error) => {
          file.close()
          this.activeRequests.delete(taskId)
          reject(error)
        })
      })

      request.on('error', (error) => {
        file.close()
        this.activeRequests.delete(taskId)
        reject(error)
      })

      request.end()
    })
  }

  private async downloadFile(
    url: string,
    savePath: string,
    taskId: string | number,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    return this.downloadFileWithResume(url, savePath, taskId, 0, onProgress)
  }

  /**
   * 取消下载
   */
  async cancelDownload(taskId: string | number): Promise<void> {
    // 中止网络请求
    const request = this.activeRequests.get(taskId)
    if (request) {
      request.destroy()
      this.activeRequests.delete(taskId)
    }

    // 删除部分下载的文件
    const task = await this.transferService.getTaskById(Number(taskId))
    if (task && fs.existsSync(task.filePath)) {
      try {
        fs.unlinkSync(task.filePath)
      } catch (error) {
        console.error('删除部分下载文件失败:', error)
      }
    }
  }

  /**
   * 自动重试失败的下载
   */
  async retryFailedDownload(taskId: number): Promise<boolean> {
    const task = await this.transferService.getTaskById(taskId)

    if (!task || task.status !== 'failed') {
      return false
    }

    // 检查重试次数（暂时使用 transferredSize 字段存储重试次数）
    const retryCount = task.transferredSize || 0
    if (retryCount >= 3) {
      return false  // 超过最大重试次数
    }

    // 增加重试计数
    await this.transferService.updateProgress(taskId, retryCount + 1)

    // 指数退避延迟
    const delay = Math.pow(2, retryCount) * 1000  // 1s, 2s, 4s
    await new Promise(resolve => setTimeout(resolve, delay))

    try {
      await this.resumeDownload(taskId)
      return true
    } catch (error) {
      // 重试失败
      return false
    }
  }

  getDefaultDownloadPath(): string {
    return app.getPath('downloads')
  }
}
