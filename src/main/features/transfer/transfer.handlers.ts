import { ipcMain } from 'electron'
import { transferService } from './transfer.service'
import { queueService } from './queue.service'
import { handleIPC } from '../../core/ipc/error-handler'
import type { QueueTask } from './transfer-queue.manager'

export function registerTransferHandlers(): void {
  // ========== 上传 ==========
  ipcMain.handle('transfer:upload:file', async (_event, params) => {
    const onProgress = (data: any) => _event.sender.send('transfer:upload:progress', data)
    return handleIPC(() => transferService.uploadFile(params, onProgress))
  })

  // ========== 下载 ==========
  ipcMain.handle('transfer:download:file', async (_event, params) => {
    const onProgress = (data: any) => _event.sender.send('transfer:download:progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download:completed', data)
    const onFailed = (data: any) => _event.sender.send('transfer:download:failed', data)
    return handleIPC(() => transferService.downloadFile(params, onProgress, onCompleted, onFailed))
  })

  // ========== 队列管理（上传） ==========
  ipcMain.handle('transfer:upload:add-to-queue', async (_event, task: QueueTask) => {
    return handleIPC(() => queueService.addUploadTask(task))
  })

  ipcMain.handle('transfer:upload:queue-status', async () => {
    return handleIPC(() => Promise.resolve(queueService.getUploadQueueStatus()))
  })

  // ========== 任务列表 ==========
  ipcMain.handle('transfer:task:list', async (_event, userId: number) => {
    return handleIPC(() => transferService.getTasksByUser(userId))
  })

  // ========== 恢复队列 ==========
  ipcMain.handle('transfer:upload:restore-queue', async (_event, { userId, userToken, username }) => {
    return handleIPC(() => queueService.restoreUploadQueue(userId, userToken, username))
  })

  // ========== 另存为 ==========
  ipcMain.handle('transfer:download:saveAs', async (_event, { fileName, userId }) => {
    return handleIPC(() => transferService.saveAs(fileName, userId))
  })

  // ========== 取消上传 ==========
  ipcMain.handle('transfer:upload:cancel', async (_event, taskId: number) => {
    return handleIPC(() => queueService.cancelUploadTask(taskId))
  })

  // ========== 恢复上传 ==========
  ipcMain.handle('transfer:upload:resume', async (_event, { taskId, userToken, username }) => {
    return handleIPC(() => queueService.resumeUploadTask(taskId, userToken, username))
  })

  // ========== 自动重试所有失败任务 ==========
  ipcMain.handle('transfer:upload:auto-retry-all', async (_event, { userId, userToken, username }) => {
    return handleIPC(async () => {
      const retriedCount = await queueService.autoRetryAllUploads(userId, userToken, username)
      return { retriedCount }
    })
  })

  // ========== 下载队列管理 ==========
  ipcMain.handle('transfer:download:init-queue', async (_event, { userId, userToken }) => {
    return handleIPC(async () => {
      const restoredCount = await queueService.restoreDownloadQueue(userId, userToken)
      const { downloadQueueManager } = await import('./download-queue.manager')
      downloadQueueManager.setProgressCallback((data: any) => {
        _event.sender.send('transfer:download:progress', data)
      })
      return { restoredCount }
    })
  })

  ipcMain.handle('transfer:download:queue', async (_event, taskData) => {
    return handleIPC(() => queueService.queueDownloadWithSession(taskData))
  })

  ipcMain.handle('transfer:download:batch-queue', async (_event, { remotePaths }: { remotePaths: string[] }) => {
    return handleIPC(() => queueService.batchQueueDownloadWithSession(remotePaths))
  })

  ipcMain.handle('transfer:download:get-queue', async () => {
    return handleIPC(() => queueService.getDownloadQueueState())
  })

  ipcMain.handle('transfer:download:pause-queue', async () => {
    return handleIPC(() => {
      queueService.pauseDownloadQueue()
      return Promise.resolve()
    })
  })

  ipcMain.handle('transfer:download:resume-queue', async () => {
    return handleIPC(() => queueService.resumeDownloadQueue())
  })

  ipcMain.handle('transfer:download:clear-queue', async () => {
    return handleIPC(() => queueService.clearDownloadQueue())
  })

  ipcMain.handle('transfer:download:clear-pending', async () => {
    return handleIPC(() => queueService.clearPendingQueue())
  })

  ipcMain.handle('transfer:download:clear-active', async () => {
    return handleIPC(() => queueService.clearActiveQueue())
  })

  // ========== 下载恢复和取消 ==========
  ipcMain.handle('transfer:download:resume', async (_event, { taskId }) => {
    const onProgress = (data: any) => _event.sender.send('transfer:download:progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download:completed', data)
    return handleIPC(() => transferService.resumeDownload(taskId, onProgress, onCompleted))
  })

  ipcMain.handle('transfer:download:cancel', async (_event, { taskId }) => {
    return handleIPC(() => queueService.cancelDownloadTask(taskId))
  })

  ipcMain.handle('transfer:download:cancel-all', async (_event, { userId }) => {
    return handleIPC(async () => {
      await transferService.cancelAllUserTasks(userId, 'download')
      await queueService.clearDownloadQueue()
      await queueService.cancelAllActiveDownloads()
    })
  })
}
