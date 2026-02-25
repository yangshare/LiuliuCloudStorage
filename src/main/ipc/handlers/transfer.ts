import { ipcMain, dialog, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { alistService } from '../../services/AlistService'
import { orchestrationService } from '../../services/OrchestrationService'
import { transferQueueManager, type QueueTask } from '../../services/TransferQueueManager'
import { TransferService } from '../../services/TransferService'
import { DownloadManager } from '../../services/DownloadManager'
import { preferencesService } from '../../services/PreferencesService'
import { downloadQueueManager, type DownloadQueueTask } from '../../services/DownloadQueueManager'
import { getCurrentSession } from './auth'

const transferService = new TransferService()

export function registerTransferHandlers(): void {
  // 直接上传（保留原有逻辑，用于单文件上传）
  ipcMain.handle('transfer:upload', async (_event, { filePath, remotePath, userId, userToken, username, localTaskId }) => {
    try {
      if (userToken) alistService.setToken(userToken)
      alistService.setBasePath('/alist/')
      if (userId) alistService.setUserId(userId)

      const fileStats = fs.statSync(filePath)
      const fileName = path.basename(filePath)

      const uploadResult = await alistService.uploadFile(filePath, remotePath)

      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error }
      }

      let lastProgress = 0
      const success = await orchestrationService.waitForTaskCompletion(
        uploadResult.taskId!,
        (progress) => {
          // 只在进度变化时发送事件
          if (progress !== lastProgress) {
            const transferredSize = Math.floor((fileStats.size * progress) / 100)
            _event.sender.send('transfer:progress', {
              taskId: localTaskId,
              progress,
              transferredSize
            })
            lastProgress = progress
          }
        }
      )

      return {
        success,
        taskId: uploadResult.taskId,
        fileInfo: {
          fileName,
          fileSize: fileStats.size,
          remotePath: `${alistService.getBasePath()}${remotePath}`,
          uploadedAt: new Date().toISOString()
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message || '上传失败' }
    }
  })

  // 添加任务到队列
  ipcMain.handle('transfer:add-to-queue', async (_event, task: QueueTask) => {
    await transferQueueManager.addTask(task)
    return { success: true }
  })

  // 查询队列状态
  ipcMain.handle('transfer:queue-status', async () => {
    return transferQueueManager.getStatus()
  })

  // 获取所有任务列表
  ipcMain.handle('transfer:list', async (_event, userId: number) => {
    return await transferService.getAllTasks(userId)
  })

  // 恢复队列（用户登录后调用）
  ipcMain.handle('transfer:restore-queue', async (_event, { userId, userToken, username }) => {
    const tasks = await transferService.getRecoverableTasks(userId)
    for (const task of tasks) {
      await transferQueueManager.addTask({
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
  })

  // 下载文件
  ipcMain.handle('transfer:download', async (_event, { remotePath, fileName, userId, userToken, username, savePath: customSavePath }) => {
    try {
      if (userToken) alistService.setToken(userToken)
      alistService.setBasePath('/alist/')
      if (userId) alistService.setUserId(userId)

      const downloadManager = new DownloadManager()

      // 获取下载链接
      const downloadResult = await alistService.getDownloadUrl(remotePath)

      if (!downloadResult.success) {
        return { success: false, error: downloadResult.error }
      }

      // 确定保存路径：优先使用自定义路径，否则使用默认路径
      const savePath = customSavePath || path.join(downloadManager.getDefaultDownloadPath(), fileName)

      // 生成任务 ID
      const taskId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 开始下载（异步执行，不阻塞）
      downloadManager.startDownload({
        id: taskId,
        url: downloadResult.rawUrl!,
        savePath,
        fileName: downloadResult.fileName!,
        fileSize: downloadResult.fileSize!,
        userId,
        userToken,
        username,
        remotePath
      }, (progress) => {
        // 发送进度更新事件到渲染进程
        _event.sender.send('transfer:download-progress', {
          taskId,
          fileName: downloadResult.fileName,
          progress: progress.percentage,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
          speed: progress.speed
        })
      }).then((actualSavePath) => {
        // 下载完成
        _event.sender.send('transfer:download-completed', {
          taskId,
          fileName: downloadResult.fileName,
          savePath: actualSavePath
        })
      }).catch((error) => {
        // 下载失败
        _event.sender.send('transfer:download-failed', {
          taskId,
          fileName: downloadResult.fileName,
          error: error.message
        })
      })

      return {
        success: true,
        taskId,
        savePath
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '下载失败'
      }
    }
  })

  // 另存为：打开保存对话框并返回用户选择的路径
  ipcMain.handle('transfer:saveAs', async (_event, { fileName, userId }) => {
    try {
      const downloadManager = new DownloadManager()

      // 获取上次选择的路径
      const lastPath = preferencesService.getLastDownloadPath(userId)
      const defaultPath = lastPath
        ? path.join(lastPath, fileName)
        : path.join(downloadManager.getDefaultDownloadPath(), fileName)

      // 打开保存对话框
      const result = await dialog.showSaveDialog({
        title: '选择下载保存位置',
        defaultPath,
        buttonLabel: '保存',
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['createDirectory']
      })

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          canceled: true
        }
      }

      // 保存最后选择的目录
      const selectedDir = path.dirname(result.filePath)
      preferencesService.saveLastDownloadPath(userId, selectedDir)

      return {
        success: true,
        savePath: result.filePath
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  })

  ipcMain.handle('transfer:cancel', async (_event, taskId: number) => {
    try {
      const result = await transferQueueManager.cancelTask(taskId)
      return result
    } catch (error: any) {
      console.error('[IPC] 取消任务失败:', error)
      return { success: false, error: error.message || '取消任务失败' }
    }
  })

  // 恢复上传任务
  ipcMain.handle('transfer:resume', async (_event, { taskId, userId, userToken, username }) => {
    try {
      const task = await transferService.getTask(taskId)
      if (!task) {
        return { success: false, error: '任务不存在' }
      }

      if (!task.resumable) {
        return { success: false, error: '该任务不支持恢复' }
      }

      // 重置状态并重新添加到队列
      await transferService.resumeTask(taskId)
      await transferQueueManager.addTask({
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
    } catch (error: any) {
      return { success: false, error: error.message || '恢复任务失败' }
    }
  })

  // 自动重试所有失败任务（网络恢复时调用）
  ipcMain.handle('transfer:auto-retry-all', async (_event, { userId, userToken, username }) => {
    try {
      const count = await transferQueueManager.autoRetryAll(userId, userToken, username)
      return { success: true, retriedCount: count }
    } catch (error: any) {
      return { success: false, error: error.message || '自动重试失败' }
    }
  })

  // ========== 下载队列管理 ==========

  // 初始化下载队列管理器
  ipcMain.handle('transfer:initDownloadQueue', async (_event, { userId, userToken, username }) => {
    try {
      // 保存凭证供后续下载使用
      downloadQueueManager.setCredentials(userId, userToken, username)

      // 恢复队列中的任务
      const restoredCount = await downloadQueueManager.restoreQueue(userId, userToken, username)

      // 监听队列更新事件并发送到渲染进程
      downloadQueueManager.setProgressCallback((data) => {
        _event.sender.send('transfer:download-progress', data)
      })

      return { success: true, restoredCount }
    } catch (error: any) {
      return { success: false, error: error.message || '初始化下载队列失败' }
    }
  })

  // 添加到下载队列
  ipcMain.handle('transfer:queueDownload', async (_event, taskData) => {
    try {
      const session = getCurrentSession()
      if (!session) {
        return { success: false, error: '用户未登录' }
      }

      const task: DownloadQueueTask = {
        id: taskData.id || `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileName: taskData.fileName,
        fileSize: taskData.fileSize || 0,
        remotePath: taskData.remotePath,
        savePath: taskData.savePath,
        priority: taskData.priority || 0,
        userId: session.userId,
        userToken: session.token,
        username: session.username
      }

      await downloadQueueManager.addToQueue(task)

      return { success: true, taskId: task.id }
    } catch (error: any) {
      return { success: false, error: error.message || '添加到下载队列失败' }
    }
  })

  // 批量添加到下载队列
  ipcMain.handle('transfer:batchQueueDownload', async (_event, { remotePaths }: { remotePaths: string[] }) => {
    try {
      const session = getCurrentSession()
      if (!session) {
        return { success: false, error: '用户未登录' }
      }

      const tasks: DownloadQueueTask[] = remotePaths.map((remotePath, i) => ({
        id: `download_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
        fileName: remotePath.split('/').pop() || 'unknown',
        fileSize: 0,
        remotePath,
        priority: i,
        userId: session.userId,
        userToken: session.token,
        username: session.username
      }))

      const dbIds = await downloadQueueManager.addBatchToQueue(tasks)

      return { success: true, successCount: dbIds.length, failedCount: 0 }
    } catch (error: any) {
      return { success: false, error: error.message || '批量添加到下载队列失败' }
    }
  })

  // 获取下载队列状态
  ipcMain.handle('transfer:getDownloadQueue', async () => {
    try {
      const state = await downloadQueueManager.getQueueState()
      return { success: true, state }
    } catch (error: any) {
      return { success: false, error: error.message || '获取队列状态失败' }
    }
  })

  // 暂停下载队列
  ipcMain.handle('transfer:pauseDownloadQueue', async () => {
    try {
      downloadQueueManager.pauseQueue()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '暂停队列失败' }
    }
  })

  // 恢复下载队列
  ipcMain.handle('transfer:resumeDownloadQueue', async () => {
    try {
      downloadQueueManager.resumeQueue()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '恢复队列失败' }
    }
  })

  // 清空下载队列（已完成和失败的任务）
  ipcMain.handle('transfer:clearDownloadQueue', async () => {
    try {
      await downloadQueueManager.clearQueue()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '清空队列失败' }
    }
  })

  // 清空等待中的任务
  ipcMain.handle('transfer:clearPendingQueue', async () => {
    try {
      await downloadQueueManager.clearPendingQueue()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '清空等待队列失败' }
    }
  })

  // 清空正在下载的任务
  ipcMain.handle('transfer:clearActiveQueue', async () => {
    try {
      await downloadQueueManager.clearActiveQueue()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '清空下载队列失败' }
    }
  })

  // ========== 下载恢复和取消 ==========

  // 恢复下载任务（Story 4-5: 下载断点续传）
  ipcMain.handle('transfer:resumeDownload', async (_event, { taskId }) => {
    try {
      const downloadManager = new DownloadManager()

      // 从数据库获取任务信息，用于发送完整的事件数据
      const taskInfo = await transferService.getTask(Number(taskId))

      // 恢复下载
      await downloadManager.resumeDownload(taskId, (progress) => {
        // 发送进度更新事件到渲染进程
        _event.sender.send('transfer:download-progress', {
          taskId,
          progress: progress.percentage,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
          speed: progress.speed
        })
      })

      // 下载完成 - 发送完整的事件数据
      _event.sender.send('transfer:download-completed', {
        taskId,
        fileName: taskInfo?.fileName || '',
        savePath: taskInfo?.filePath || ''
      })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '恢复下载失败' }
    }
  })

  // 取消下载任务（Story 4-6: 取消下载任务）
  ipcMain.handle('transfer:cancelDownload', async (_event, { taskId }) => {
    try {
      const downloadManager = new DownloadManager()

      // 取消下载（中止网络请求并删除部分文件）
      await downloadManager.cancelDownload(taskId)

      // 更新数据库状态
      await transferService.cancelTask(Number(taskId))

      // 从队列移除
      await downloadQueueManager.removeFromQueue(taskId.toString())

      // 通知渲染进程
      _event.sender.send('transfer:download-cancelled', { taskId })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '取消下载失败' }
    }
  })

  // 取消所有下载（批量取消）
  ipcMain.handle('transfer:cancelAllDownloads', async (_event, { userId }) => {
    try {
      const downloadManager = new DownloadManager()

      // 取消所有进行中和等待的任务
      await transferService.cancelAllUserTasks(userId, 'download')

      // 清空队列
      await downloadQueueManager.clearQueue()

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '取消所有下载失败' }
    }
  })
}
