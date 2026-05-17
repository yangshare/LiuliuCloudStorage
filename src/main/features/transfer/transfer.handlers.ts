import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { alistService } from '../../services/AlistService'
import { orchestrationService } from '../../services/OrchestrationService'
import { transferQueueManager, type QueueTask } from '../../services/TransferQueueManager'
import { DownloadManager } from '../../services/DownloadManager'
import { preferencesService } from '../../services/PreferencesService'
import { downloadQueueManager, type DownloadQueueTask } from '../../services/DownloadQueueManager'
import { authService } from '../../features/auth/auth.service'
import { transferService } from './transfer.service'
import { queueService } from './queue.service'
import { handleIPC } from '../../core/ipc/error-handler'

export function registerTransferHandlers(): void {
  // ========== 直接上传 ==========
  ipcMain.handle('transfer:upload', async (_event, { filePath, remotePath, userId, userToken, username: _username, localTaskId }) => {
    return handleIPC(async () => {
      if (userToken) alistService.setToken(userToken)
      alistService.setBasePath('/alist/')
      if (userId) alistService.setUserId(userId)

      const fileStats = fs.statSync(filePath)
      const fileName = path.basename(filePath)

      const uploadResult = await alistService.uploadFile(filePath, remotePath)
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '上传失败')
      }

      let lastProgress = 0
      const success = await orchestrationService.waitForTaskCompletion(
        uploadResult.taskId!,
        (progress) => {
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
    })
  })

  // ========== 队列管理（上传） ==========
  ipcMain.handle('transfer:add-to-queue', async (_event, task: QueueTask) => {
    return handleIPC(async () => {
      await queueService.addUploadTask(task)
      return { success: true }
    })
  })

  ipcMain.handle('transfer:queue-status', async () => {
    return handleIPC(async () => queueService.getUploadQueueStatus())
  })

  // ========== 任务列表 ==========
  ipcMain.handle('transfer:list', async (_event, userId: number) => {
    return transferService.getTasksByUser(userId)
  })

  // ========== 恢复队列 ==========
  ipcMain.handle('transfer:restore-queue', async (_event, { userId, userToken, username }) => {
    return handleIPC(async () => {
      const tasks = await transferService.getRecoverableTasks(userId)
      for (const task of tasks) {
        await queueService.addUploadTask({
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
  })

  // ========== 直接下载 ==========
  ipcMain.handle('transfer:download', async (_event, { remotePath, fileName, userId, userToken, username: _username, savePath: customSavePath }) => {
    return handleIPC(async () => {
      if (userToken) alistService.setToken(userToken)
      alistService.setBasePath('/alist/')
      if (userId) alistService.setUserId(userId)

      const downloadManager = new DownloadManager()
      const downloadResult = await alistService.getDownloadUrl(remotePath)
      if (!downloadResult.success) {
        throw new Error(downloadResult.error || '获取下载链接失败')
      }

      const savePath = customSavePath || path.join(downloadManager.getDefaultDownloadPath(), fileName)
      const taskId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      downloadManager.startDownload({
        id: taskId,
        url: downloadResult.rawUrl!,
        savePath,
        fileName: downloadResult.fileName!,
        fileSize: downloadResult.fileSize!,
        userId,
        userToken,
        remotePath
      }, (progress) => {
        _event.sender.send('transfer:download-progress', {
          taskId,
          fileName: downloadResult.fileName,
          progress: progress.percentage,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
          speed: progress.speed
        })
      }).then((actualSavePath) => {
        _event.sender.send('transfer:download-completed', {
          taskId,
          fileName: downloadResult.fileName,
          savePath: actualSavePath
        })
      }).catch((error) => {
        _event.sender.send('transfer:download-failed', {
          taskId,
          fileName: downloadResult.fileName,
          error: error.message
        })
      })

      return { success: true, taskId, savePath }
    })
  })

  // ========== 另存为 ==========
  ipcMain.handle('transfer:saveAs', async (_event, { fileName, userId }) => {
    return handleIPC(async () => {
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
        return { success: false, canceled: true }
      }

      const selectedDir = path.dirname(result.filePath)
      preferencesService.saveLastDownloadPath(userId, selectedDir)

      return { success: true, savePath: result.filePath }
    })
  })

  // ========== 取消上传 ==========
  ipcMain.handle('transfer:cancel', async (_event, taskId: number) => {
    return handleIPC(async () => queueService.cancelUploadTask(taskId))
  })

  // ========== 恢复上传 ==========
  ipcMain.handle('transfer:resume', async (_event, { taskId, userToken, username }) => {
    return handleIPC(async () => {
      const task = await transferService.getTask(taskId)
      if (!task) throw new Error('任务不存在')
      if (!task.resumable) throw new Error('该任务不支持恢复')

      await transferService.resumeTask(taskId)
      await queueService.addUploadTask({
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
    })
  })

  // ========== 自动重试所有失败任务 ==========
  ipcMain.handle('transfer:auto-retry-all', async (_event, { userId, userToken, username }) => {
    return handleIPC(async () => {
      const count = await queueService.autoRetryAllUploads(userId, userToken, username)
      return { success: true, retriedCount: count }
    })
  })

  // ========== 下载队列管理 ==========
  ipcMain.handle('transfer:initDownloadQueue', async (_event, { userId, userToken }) => {
    return handleIPC(async () => {
      queueService.setDownloadCredentials(userId, userToken)
      const restoredCount = await queueService.restoreDownloadQueue(userId, userToken)
      downloadQueueManager.setProgressCallback((data) => {
        _event.sender.send('transfer:download-progress', data)
      })
      return { success: true, restoredCount }
    })
  })

  ipcMain.handle('transfer:queueDownload', async (_event, taskData) => {
    return handleIPC(async () => {
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

      const dbId = await queueService.addDownloadTask(task)
      return { success: true, taskId: task.id, dbId }
    })
  })

  ipcMain.handle('transfer:batchQueueDownload', async (_event, { remotePaths }: { remotePaths: string[] }) => {
    return handleIPC(async () => {
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

      const batchResult = await queueService.addBatchDownloadTasks(tasks)
      return { success: true, successCount: batchResult.length, failedCount: 0 }
    })
  })

  ipcMain.handle('transfer:getDownloadQueue', async () => {
    return handleIPC(async () => {
      const state = await queueService.getDownloadQueueState()
      return { success: true, state }
    })
  })

  ipcMain.handle('transfer:pauseDownloadQueue', async () => {
    return handleIPC(async () => {
      queueService.pauseDownloadQueue()
      return { success: true }
    })
  })

  ipcMain.handle('transfer:resumeDownloadQueue', async () => {
    return handleIPC(async () => {
      queueService.resumeDownloadQueue()
      return { success: true }
    })
  })

  ipcMain.handle('transfer:clearDownloadQueue', async () => {
    return handleIPC(async () => {
      await queueService.clearDownloadQueue()
      return { success: true }
    })
  })

  ipcMain.handle('transfer:clearPendingQueue', async () => {
    return handleIPC(async () => {
      await queueService.clearPendingQueue()
      return { success: true }
    })
  })

  ipcMain.handle('transfer:clearActiveQueue', async () => {
    return handleIPC(async () => {
      await queueService.clearActiveQueue()
      return { success: true }
    })
  })

  // ========== 下载恢复和取消 ==========
  ipcMain.handle('transfer:resumeDownload', async (_event, { taskId }) => {
    return handleIPC(async () => {
      const downloadManager = new DownloadManager()
      const taskInfo = await transferService.getTask(Number(taskId))

      await downloadManager.resumeDownload(taskId, (progress) => {
        _event.sender.send('transfer:download-progress', {
          taskId,
          progress: progress.percentage,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
          speed: progress.speed
        })
      })

      _event.sender.send('transfer:download-completed', {
        taskId,
        fileName: taskInfo?.fileName || '',
        savePath: taskInfo?.filePath || ''
      })

      return { success: true }
    })
  })

  ipcMain.handle('transfer:cancelDownload', async (_event, { taskId }) => {
    return handleIPC(async () => {
      const downloadManager = new DownloadManager()
      await downloadManager.cancelDownload(taskId)
      await transferService.cancelTask(Number(taskId))
      await queueService.removeDownloadFromQueue(taskId.toString())
      _event.sender.send('transfer:download-cancelled', { taskId })
      return { success: true }
    })
  })

  ipcMain.handle('transfer:cancelAllDownloads', async (_event, { userId }) => {
    return handleIPC(async () => {
      await transferService.cancelAllUserTasks(userId, 'download')
      await queueService.clearDownloadQueue()
      return { success: true }
    })
  })
}
