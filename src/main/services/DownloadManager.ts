import { net, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { TransferService } from './TransferService'
import { downloadConfigService } from './downloadConfigService'
import { loggerService } from './LoggerService'

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
      loggerService.info('DownloadManager', `[下载] Step 1: 应用日期子目录逻辑`)
      // 应用日期子目录逻辑
      const finalSavePath = await this.applyDateFolderLogic(task.savePath, task.fileName)

      loggerService.info('DownloadManager', `[下载] Step 2: 开始下载任务 - 文件名: ${task.fileName}, URL: ${task.url}`)

      // 检查是否已提供数据库记录 ID
      if (task.dbId) {
        loggerService.info('DownloadManager', `[下载] Step 3: 使用现有数据库记录 ID: ${task.dbId}`)
        // 使用现有的数据库记录
        dbTask = await this.transferService.getTaskById(task.dbId)
        if (!dbTask) {
          throw new Error(`数据库记录不存在: ${task.dbId}`)
        }
      } else {
        loggerService.info('DownloadManager', `[下载] Step 3: 创建新的数据库记录`)
        // 创建新的数据库记录
        const createdTask = await this.transferService.create({
          userId: task.userId,
          taskType: 'download',
          fileName: task.fileName,
          filePath: finalSavePath,
          remotePath: task.remotePath,
          fileSize: task.fileSize,
          status: 'pending',
          transferredSize: 0,
          resumable: true  // 下载支持断点续传
        })
        dbTask = createdTask
      }

      loggerService.info('DownloadManager', `[下载] Step 4: 任务ID: ${dbTask.id}, 保存路径: ${finalSavePath}, 文件大小: ${task.fileSize} bytes`)

      // 检查任务状态，如果已经完成或失败，直接返回
      if (dbTask.status === 'completed') {
        loggerService.info('DownloadManager', `[下载] 任务已完成，跳过 - 任务ID: ${dbTask.id}`)
        return
      }

      if (dbTask.status === 'failed') {
        loggerService.info('DownloadManager', `[下载] 任务已失败，跳过 - 任务ID: ${dbTask.id}`)
        return
      }

      // 在更新状态为 in_progress 之前，先检查文件是否已存在
      const fileExists = fs.existsSync(finalSavePath)
      let skipDownload = false

      if (fileExists) {
        const stats = fs.statSync(finalSavePath)
        loggerService.info('DownloadManager', `[下载] 文件已存在 - 本地大小: ${stats.size}, 预期大小: ${task.fileSize || '未知'}`)

        // 文件已存在且完整，标记为跳过下载
        if (task.fileSize && task.fileSize > 0 && stats.size >= task.fileSize) {
          loggerService.info('DownloadManager', `[下载] 文件已完整，直接标记为完成 - 任务ID: ${dbTask.id}`)
          skipDownload = true

          // 直接触发完成进度回调
          if (onProgress) {
            onProgress({
              downloadedBytes: task.fileSize,
              totalBytes: task.fileSize,
              percentage: 100,
              speed: 0
            })
          }

          // 更新状态为 completed
          await this.transferService.updateStatus(dbTask.id, 'completed')
          await this.transferService.updateProgress(dbTask.id, task.fileSize)
        } else if (!task.fileSize || task.fileSize <= 0) {
          // 预期大小未知，但本地文件大小大于0
          if (stats.size > 0) {
            loggerService.info('DownloadManager', `[下载] 预期大小未知但文件已存在（本地 ${stats.size} bytes），直接标记为完成 - 任务ID: ${dbTask.id}`)
            skipDownload = true

            if (onProgress) {
              onProgress({
                downloadedBytes: stats.size,
                totalBytes: stats.size,
                percentage: 100,
                speed: 0
              })
            }

            await this.transferService.updateStatus(dbTask.id, 'completed')
            await this.transferService.updateProgress(dbTask.id, stats.size)
          }
        }
      }

      // 如果不需要跳过下载，正常执行下载流程
      if (!skipDownload) {
        // 更新状态为 in_progress
        loggerService.info('DownloadManager', `[下载] Step 5: 更新状态为 in_progress`)
        await this.transferService.updateStatus(dbTask.id, 'in_progress')
        loggerService.info('DownloadManager', `[下载] Step 6: 状态更新完成`)

        // 开始下载，传递文件大小用于检查文件是否已存在
        await this.downloadFile(task.url, finalSavePath, dbTask.id, task.fileSize, async (progress) => {
          // 更新进度到数据库
          await this.transferService.updateProgress(dbTask.id, progress.downloadedBytes)

          // 回调进度
          if (onProgress) {
            onProgress(progress)
          }
        })

        // 下载完成
        loggerService.info('DownloadManager', `[下载] 任务完成 - ID: ${dbTask.id}, 文件: ${task.fileName}`)
        await this.transferService.updateStatus(dbTask.id, 'completed')
      }
    } catch (error: any) {
      // 下载失败
      loggerService.error('DownloadManager', `[下载] 任务失败 - ID: ${dbTask?.id}, 文件: ${task.fileName}, 错误: ${error.message}`)
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

      // 从断点继续下载，传递文件大小用于检查文件是否已完整
      await this.downloadFileWithResume(task.url || '', task.filePath, taskId, startPosition, task.fileSize, async (progress) => {
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
   * @param url - 下载URL
   * @param savePath - 保存路径
   * @param taskId - 任务ID
   * @param transferredSize - 已传输的字节数（用于断点续传）
   * @param expectedFileSize - 预期的文件总大小（用于检查文件完整性）
   * @param onProgress - 进度回调
   */
  private async downloadFileWithResume(
    url: string,
    savePath: string,
    taskId: string | number,
    transferredSize: number = 0,
    expectedFileSize?: number,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    // 确保保存目录存在
    const dir = path.dirname(savePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    loggerService.info('DownloadManager', `[下载] 开始下载流程 - 任务ID: ${taskId}, URL: ${url}`)
    loggerService.info('DownloadManager', `[下载] 保存路径: ${savePath}, 预期大小: ${expectedFileSize || '未知'}`)

    // 检查本地文件是否存在
    const fileExists = fs.existsSync(savePath)

    // 如果文件已存在，检查是否需要跳过下载
    if (fileExists) {
      const stats = fs.statSync(savePath)
      loggerService.info('DownloadManager', `[下载] 文件已存在 - 本地大小: ${stats.size}, 预期大小: ${expectedFileSize || '未知'}`)

      // 情况1：已知预期大小，且文件已完整下载
      if (expectedFileSize !== undefined && expectedFileSize > 0 && stats.size >= expectedFileSize) {
        // 文件已完整存在，触发完成进度回调并跳过下载
        loggerService.info('DownloadManager', `[下载] 文件已完整（本地 ${stats.size} >= 预期 ${expectedFileSize}），跳过下载 - 任务ID: ${taskId}`)
        if (onProgress) {
          onProgress({
            downloadedBytes: expectedFileSize,
            totalBytes: expectedFileSize,
            percentage: 100,
            speed: 0
          })
        }
        return
      }

      // 情况2：预期大小未知或无效，但本地文件大小大于0，假定文件已存在
      if (!expectedFileSize || expectedFileSize <= 0) {
        if (stats.size > 0) {
          loggerService.info('DownloadManager', `[下载] 预期大小未知但文件已存在（本地 ${stats.size} bytes），跳过下载 - 任务ID: ${taskId}`)
          if (onProgress) {
            onProgress({
              downloadedBytes: stats.size,
              totalBytes: stats.size,
              percentage: 100,
              speed: 0
            })
          }
          return
        } else {
          loggerService.warn('DownloadManager', `[下载] 文件存在但大小为0，将重新下载 - 任务ID: ${taskId}`)
        }
      }

      // 情况3：文件不完整，断点续传
      if (expectedFileSize !== undefined && expectedFileSize > 0 && stats.size < expectedFileSize) {
        loggerService.info('DownloadManager', `[下载] 文件不完整（本地 ${stats.size} < 预期 ${expectedFileSize}），将从位置 ${stats.size} 继续下载`)
      }
    } else {
      loggerService.info('DownloadManager', `[下载] 文件不存在，将创建新文件 - 任务ID: ${taskId}`)
    }

    return new Promise((resolve, reject) => {
      // 计算起始位置
      let startPosition = transferredSize
      if (fileExists) {
        const stats = fs.statSync(savePath)
        startPosition = Math.max(startPosition, stats.size)
      }

      loggerService.info('DownloadManager', `[下载] 起始位置: ${startPosition} bytes`)

      // 创建写入流：如果是从头开始下载（startPosition=0），使用覆盖模式；否则使用追加模式
      const file = (startPosition > 0)
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
        loggerService.info('DownloadManager', `[下载] 设置断点续传 - Range: bytes=${startPosition}-`)
      }

      // 百度网盘下载大于 20M 文件需要设置 User-Agent
      request.setHeader('User-Agent', 'pan.baidu.com')

      loggerService.info('DownloadManager', `[下载] 发起网络请求 - URL: ${url}`)

      request.on('response', (response) => {
        loggerService.info('DownloadManager', `[下载] 收到响应 - 状态码: ${response.statusCode}, headers: ${JSON.stringify(response.headers)}`)

        // 检查服务器是否支持 Range 请求
        const acceptRanges = response.headers['accept-ranges']
        const contentRange = response.headers['content-range']

        if (startPosition > 0 && !acceptRanges && !contentRange) {
          loggerService.error('DownloadManager', `[下载] 服务器不支持断点续传 - accept-ranges: ${acceptRanges}, content-range: ${contentRange}`)
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

        loggerService.info('DownloadManager', `[下载] 文件总大小: ${totalBytes} bytes`)

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
          loggerService.info('DownloadManager', `[下载] 下载完成 - 任务ID: ${taskId}, 已下载: ${downloadedBytes} bytes`)
          file.close()
          this.activeRequests.delete(taskId)
          resolve()
        })

        response.on('error', (error) => {
          loggerService.error('DownloadManager', `[下载] 响应错误 - 任务ID: ${taskId}, 错误: ${error.message}`)
          file.close()
          this.activeRequests.delete(taskId)
          reject(error)
        })
      })

      request.on('error', (error) => {
        loggerService.error('DownloadManager', `[下载] 请求错误 - 任务ID: ${taskId}, 错误: ${error.message}`)
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
    expectedFileSize?: number,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    return this.downloadFileWithResume(url, savePath, taskId, 0, expectedFileSize, onProgress)
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
    try {
      // 读取用户配置的下载目录
      const config = downloadConfigService.getConfig()
      return config.defaultPath
    } catch (error) {
      // 如果配置不存在，回退到系统默认下载文件夹
      console.warn('下载配置不存在，使用系统默认下载文件夹:', error)
      return app.getPath('downloads')
    }
  }

  /**
   * 应用日期子目录逻辑
   * 如果配置开启,则在保存路径中添加 YYYY-MM-DD 格式的子目录
   */
  private async applyDateFolderLogic(basePath: string, fileName: string): Promise<string> {
    try {
      const config = downloadConfigService.getConfig()

      if (config.autoCreateDateFolder) {
        // 生成 YYYY-MM-DD 格式的子目录
        const now = new Date()
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        // 从 basePath 中提取目录部分(如果 basePath 包含文件名)
        const baseDir = path.dirname(basePath)
        const dateFolder = path.join(baseDir, yearMonth)

        // 确保日期子目录存在
        if (!fs.existsSync(dateFolder)) {
          fs.mkdirSync(dateFolder, { recursive: true })
        }

        // 返回完整路径
        return path.join(dateFolder, fileName)
      }

      // 如果配置关闭,直接返回原路径
      return basePath
    } catch (error) {
      console.error('应用日期文件夹逻辑失败:', error)
      // 出错时返回原路径
      return basePath
    }
  }
}
