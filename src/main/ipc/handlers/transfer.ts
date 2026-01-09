import { ipcMain } from 'electron'

export function registerTransferHandlers(): void {
  ipcMain.handle('transfer:upload', async (_event, filePath: string, remotePath: string) => {
    // TODO: 实现上传（Story 3.4）
    console.log('transfer:upload called', { filePath, remotePath })
    return { taskId: '', error: 'Not implemented' }
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

  ipcMain.handle('transfer:list', async () => {
    // TODO: 实现传输列表（Story 3.5）
    return []
  })
}
