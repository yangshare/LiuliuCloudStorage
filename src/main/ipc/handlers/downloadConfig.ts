import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { downloadConfigService } from '../../services/downloadConfigService'
import fs from 'fs/promises'
import path from 'path'

export function registerDownloadConfigHandlers(): void {
  // 选择下载目录
  ipcMain.handle('downloadConfig:selectDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: '选择下载目录'
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]

      try {
        // 检查目录是否存在
        await fs.access(selectedPath)

        // 检查写入权限
        await fs.access(selectedPath, fs.constants.W_OK)

        // 更新配置
        const config = downloadConfigService.updateConfig({ defaultPath: selectedPath })
        return { success: true, path: config.defaultPath }
      } catch (error: any) {
        // 目录不存在，询问是否创建
        if (error.code === 'ENOENT') {
          return {
            success: false,
            error: '目录不存在',
            needsCreation: true,
            path: selectedPath
          }
        }
        // 没有写入权限
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          return {
            success: false,
            error: '没有写入权限，请选择其他目录'
          }
        }
        return { success: false, error: error.message }
      }
    }

    return { success: false }
  })

  // 获取下载配置
  ipcMain.handle('downloadConfig:get', async () => {
    return downloadConfigService.getConfig()
  })

  // 更新下载配置
  ipcMain.handle('downloadConfig:update', async (_event, updates) => {
    return downloadConfigService.updateConfig(updates)
  })

  // 打开下载目录
  ipcMain.handle('downloadConfig:openDirectory', async () => {
    const config = downloadConfigService.getConfig()
    const dirPath = config.defaultPath

    try {
      // 检查目录是否存在
      await fs.access(dirPath)
      // 打开目录
      await shell.openPath(dirPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: '目录不存在' }
    }
  })

  // 打开文件所在目录
  ipcMain.handle('downloadConfig:openFileDirectory', async (_event, filePath: string) => {
    try {
      const dirPath = path.dirname(filePath)
      await fs.access(dirPath)
      await shell.openPath(dirPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: '目录不存在' }
    }
  })

  // 创建目录
  ipcMain.handle('downloadConfig:createDirectory', async (_event, dirPath: string) => {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      const config = downloadConfigService.updateConfig({ defaultPath: dirPath })
      return { success: true, path: config.defaultPath }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 重置下载配置
  ipcMain.handle('downloadConfig:reset', async () => {
    try {
      const config = downloadConfigService.resetToDefault()
      return { success: true, config }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
