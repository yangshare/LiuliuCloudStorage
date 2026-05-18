import { ipcMain, dialog, BrowserWindow } from 'electron'
import { downloadConfigFeatureService } from './downloadConfig.service'

export function registerDownloadConfigHandlers(): void {
  ipcMain.handle('downloadConfig:directory:select', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: '选择下载目录'
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return downloadConfigFeatureService.selectDirectory(result.filePaths[0])
    }
    return { success: false }
  })

  ipcMain.handle('downloadConfig:data:get', async () => {
    return downloadConfigFeatureService.getConfig()
  })

  ipcMain.handle('downloadConfig:data:update', async (_event, updates) => {
    return downloadConfigFeatureService.updateConfig(updates)
  })

  ipcMain.handle('downloadConfig:directory:open', async () => {
    const config = downloadConfigFeatureService.getConfig()
    return downloadConfigFeatureService.openDirectory(config.defaultPath)
  })

  ipcMain.handle('downloadConfig:directory:openFile', async (_event, filePath: string) => {
    return downloadConfigFeatureService.openFileDirectory(filePath)
  })

  ipcMain.handle('downloadConfig:directory:create', async (_event, dirPath: string) => {
    return downloadConfigFeatureService.createDirectory(dirPath)
  })

  ipcMain.handle('downloadConfig:data:reset', async () => {
    return downloadConfigFeatureService.resetToDefault()
  })
}
