import { ipcMain, dialog, BrowserWindow } from 'electron'
import { downloadConfigFeatureService } from './downloadConfig.service'

export function registerDownloadConfigHandlers(): void {
  ipcMain.handle('downloadConfig:selectDirectory', async () => {
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

  ipcMain.handle('downloadConfig:get', async () => {
    return downloadConfigFeatureService.getConfig()
  })

  ipcMain.handle('downloadConfig:update', async (_event, updates) => {
    return downloadConfigFeatureService.updateConfig(updates)
  })

  ipcMain.handle('downloadConfig:openDirectory', async () => {
    const config = downloadConfigFeatureService.getConfig()
    return downloadConfigFeatureService.openDirectory(config.defaultPath)
  })

  ipcMain.handle('downloadConfig:openFileDirectory', async (_event, filePath: string) => {
    return downloadConfigFeatureService.openFileDirectory(filePath)
  })

  ipcMain.handle('downloadConfig:createDirectory', async (_event, dirPath: string) => {
    return downloadConfigFeatureService.createDirectory(dirPath)
  })

  ipcMain.handle('downloadConfig:reset', async () => {
    return downloadConfigFeatureService.resetToDefault()
  })
}
