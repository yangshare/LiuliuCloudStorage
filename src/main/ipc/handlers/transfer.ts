import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { alistService } from '../../services/AlistService'
import { orchestrationService } from '../../services/OrchestrationService'
import { transferQueueManager, type QueueTask } from '../../services/TransferQueueManager'
import { TransferService } from '../../services/TransferService'

const transferService = new TransferService()

export function registerTransferHandlers(): void {
  // 直接上传（保留原有逻辑，用于单文件上传）
  ipcMain.handle('transfer:upload', async (_event, { filePath, remotePath, userId, userToken, username, localTaskId }) => {
    try {
      alistService.setToken(userToken)
      alistService.setBasePath(`/root/users/${username}/`)
      alistService.setUserId(userId)

      const fileStats = fs.statSync(filePath)
      const fileName = path.basename(filePath)

      const uploadResult = await alistService.uploadFile(filePath, remotePath)

      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error }
      }

      const success = await orchestrationService.waitForTaskCompletion(
        uploadResult.taskId!,
        (progress) => {
          _event.sender.send('transfer:progress', { taskId: localTaskId, progress })
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

  ipcMain.handle('transfer:download', async (_event, remotePath: string, localPath: string) => {
    // TODO: 实现下载（Story 4.1）
    console.log('transfer:download called', { remotePath, localPath })
    return { taskId: '', error: 'Not implemented' }
  })

  ipcMain.handle('transfer:cancel', async (_event, taskId: string) => {
    // TODO: 实现取消传输（Story 3.8, 4.6）
    console.log('transfer:cancel called', { taskId })
    return { success: false, error: 'Not implemented' }
  })
}
