import { ipcMain } from 'electron'
import { transferService } from './transfer.service'
import { queueService } from './queue.service'
import { handleIPC } from '../../core/ipc/error-handler'
import type { QueueTask } from '../../services/TransferQueueManager'

export function registerTransferHandlers(): void {
  // ========== 上传 ==========
  ipcMain.handle('transfer:upload', async (_event, params) => {
    const onProgress = (data: any) => _event.sender.send('transfer:progress', data)
    return handleIPC(() => transferService.uploadFile(params, onProgress))
  })

  // ========== 下载 ==========
  ipcMain.handle('transfer:download', async (_event, params) => {
    const onProgress = (data: any) => _event.sender.send('transfer:download-progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download-completed', data)
    const onFailed = (data: any) => _event.sender.send('transfer:download-failed', data)
    return handleIPC(() => transferService.downloadFile(params, onProgress, onCompleted, onFailed))
  })

  // ========== 队列管理（上传） ==========
  ipcMain.handle('transfer:add-to-queue', async (_event, task: QueueTask) => {
    return handleIPC(() => queueService.addUploadTask(task))
  })

  ipcMain.handle('transfer:queue-status', async () => {
    return handleIPC(() => Promise.resolve(queueService.getUploadQueueStatus()))
  })

  // ========== 任务列表 ==========
  ipcMain.handle('transfer:list', async (_event, userId: number) => {
    return handleIPC(() => transferService.getTasksByUser(userId))
  })

  // ========== 恢复队列 ==========
  ipcMain.handle('transfer:restore-queue', async (_event, { userId, userToken, username }) => {
    return handleIPC(() => queueService.restoreUploadQueue(userId, userToken, username))
  })

  // ========== 另存为 ==========
  ipcMain.handle('transfer:saveAs', async (_event, { fileName, userId }) => {
    return handleIPC(() => transferService.saveAs(fileName, userId))
  })

  // ========== 取消上传 ==========
  ipcMain.handle('transfer:cancel', async (_event, taskId: number) => {
    return handleIPC(() => queueService.cancelUploadTask(taskId))
  })

  // ========== 恢复上传 ==========
  ipcMain.handle('transfer:resume', async (_event, { taskId, userToken, username }) => {
    return handleIPC(() => queueService.resumeUploadTask(taskId, userToken, username))
  })

  // ========== 自动重试所有失败任务 ==========
  ipcMain.handle('transfer:auto-retry-all', async (_event, { userId, userToken, username }) => {
    return handleIPC(async () => {
      const retriedCount = await queueService.autoRetryAllUploads(userId, userToken, username)
      return { retriedCount }
    })
  })

  // ========== 下载队列管理 ==========
  ipcMain.handle('transfer:initDownloadQueue', async (_event, { userId, userToken }) => {
    return handleIPC(async () => {
      queueService.setDownloadCredentials(userId, userToken)
      const restoredCount = await queueService.restoreDownloadQueue(userId, userToken)
      const { downloadQueueManager } = await import('../../services/DownloadQueueManager')
      downloadQueueManager.setProgressCallback((data: any) => {
        _event.sender.send('transfer:download-progress', data)
      })
      return { restoredCount }
    })
  })

  ipcMain.handle('transfer:queueDownload', async (_event, taskData) => {
    return handleIPC(() => queueService.queueDownloadWithSession(taskData))
  })

  ipcMain.handle('transfer:batchQueueDownload', async (_event, { remotePaths }: { remotePaths: string[] }) => {
    return handleIPC(() => queueService.batchQueueDownloadWithSession(remotePaths))
  })

  ipcMain.handle('transfer:getDownloadQueue', async () => {
    return handleIPC(() => queueService.getDownloadQueueState())
  })

  ipcMain.handle('transfer:pauseDownloadQueue', async () => {
    return handleIPC(() => {
      queueService.pauseDownloadQueue()
      return Promise.resolve()
    })
  })

  ipcMain.handle('transfer:resumeDownloadQueue', async () => {
    return handleIPC(() => {
      queueService.resumeDownloadQueue()
      return Promise.resolve()
    })
  })

  ipcMain.handle('transfer:clearDownloadQueue', async () => {
    return handleIPC(() => queueService.clearDownloadQueue())
  })

  ipcMain.handle('transfer:clearPendingQueue', async () => {
    return handleIPC(() => queueService.clearPendingQueue())
  })

  ipcMain.handle('transfer:clearActiveQueue', async () => {
    return handleIPC(() => queueService.clearActiveQueue())
  })

  // ========== 下载恢复和取消 ==========
  ipcMain.handle('transfer:resumeDownload', async (_event, { taskId }) => {
    const onProgress = (data: any) => _event.sender.send('transfer:download-progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download-completed', data)
    return handleIPC(() => transferService.resumeDownload(taskId, onProgress, onCompleted))
  })

  ipcMain.handle('transfer:cancelDownload', async (_event, { taskId }) => {
    return handleIPC(async () => {
      await queueService.cancelDownloadTask(taskId)
      _event.sender.send('transfer:download-cancelled', { taskId })
    })
  })

  ipcMain.handle('transfer:cancelAllDownloads', async (_event, { userId }) => {
    return handleIPC(async () => {
      await transferService.cancelAllUserTasks(userId, 'download')
      await queueService.clearDownloadQueue()
    })
  })
}
