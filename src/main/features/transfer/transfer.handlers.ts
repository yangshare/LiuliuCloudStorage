import { ipcMain } from 'electron'
import { transferService } from './transfer.service'
import { queueService } from './queue.service'
import { handleIPC } from '../../core/ipc/error-handler'
import type { QueueTask } from '../../services/TransferQueueManager'

export function registerTransferHandlers(): void {
  // ========== 直接上传 ==========
  ipcMain.handle('transfer:upload', async (_event, { filePath, remotePath, userId, userToken, username: _username, localTaskId }) => {
    const onProgress = (data: any) => _event.sender.send('transfer:progress', data)
    return transferService.uploadFile({ filePath, remotePath, userId, userToken, localTaskId }, onProgress)
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
    return queueService.restoreUploadQueue(userId, userToken, username)
  })

  // ========== 直接下载 ==========
  ipcMain.handle('transfer:download', async (_event, { remotePath, fileName, userId, userToken, username: _username, savePath: customSavePath }) => {
    const onProgress = (data: any) => _event.sender.send('transfer:download-progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download-completed', data)
    const onFailed = (data: any) => _event.sender.send('transfer:download-failed', data)
    return transferService.downloadFile({ remotePath, fileName, userId, userToken, savePath: customSavePath }, onProgress, onCompleted, onFailed)
  })

  // ========== 另存为 ==========
  ipcMain.handle('transfer:saveAs', async (_event, { fileName, userId }) => {
    return transferService.saveAs(fileName, userId)
  })

  // ========== 取消上传 ==========
  ipcMain.handle('transfer:cancel', async (_event, taskId: number) => {
    return handleIPC(async () => queueService.cancelUploadTask(taskId))
  })

  // ========== 恢复上传 ==========
  ipcMain.handle('transfer:resume', async (_event, { taskId, userToken, username }) => {
    return queueService.resumeUploadTask(taskId, userToken, username)
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
      const { downloadQueueManager } = await import('../../services/DownloadQueueManager')
      downloadQueueManager.setProgressCallback((data) => {
        _event.sender.send('transfer:download-progress', data)
      })
      return { success: true, restoredCount }
    })
  })

  ipcMain.handle('transfer:queueDownload', async (_event, taskData) => {
    return queueService.queueDownloadWithSession(taskData)
  })

  ipcMain.handle('transfer:batchQueueDownload', async (_event, { remotePaths }: { remotePaths: string[] }) => {
    return queueService.batchQueueDownloadWithSession(remotePaths)
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
    const onProgress = (data: any) => _event.sender.send('transfer:download-progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download-completed', data)
    return transferService.resumeDownload(taskId, onProgress, onCompleted)
  })

  ipcMain.handle('transfer:cancelDownload', async (_event, { taskId }) => {
    return handleIPC(async () => {
      await queueService.cancelDownloadTask(taskId)
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
