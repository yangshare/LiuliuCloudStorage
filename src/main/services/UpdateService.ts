import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'

class UpdateService {
  private mainWindow: BrowserWindow | null = null
  private updateDownloaded = false

  init(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow

    // 配置：不自动下载，手动控制
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    // 事件监听
    autoUpdater.on('update-available', (info) => {
      console.log('[UpdateService] 发现新版本:', info.version)
      this.sendToRenderer('update:available', info)
      autoUpdater.downloadUpdate() // 开始静默下载
    })

    autoUpdater.on('update-not-available', () => {
      console.log('[UpdateService] 已是最新版本')
      this.sendToRenderer('update:not-available', undefined)
    })

    autoUpdater.on('download-progress', (progress) => {
      console.log('[UpdateService] 下载进度:', progress.percent.toFixed(2) + '%')
      this.sendToRenderer('update:download-progress', progress)
    })

    autoUpdater.on('update-downloaded', () => {
      console.log('[UpdateService] 更新下载完成')
      this.updateDownloaded = true
      this.sendToRenderer('update:downloaded', undefined)
    })

    autoUpdater.on('error', (error) => {
      console.error('[UpdateService] 更新错误:', error)
      let message = error.message

      // 友好化错误信息
      if (error.message.includes('net::') || error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
        message = '网络连接失败，请检查网络后重试'
      } else if (error.message.includes('ENOSPC')) {
        message = '磁盘空间不足，请清理后重试'
      } else if (error.message.includes('ECONNRESET') || error.message.includes('ECONNREFUSED')) {
        message = '下载中断，请重启应用重试'
      } else if (error.message.includes('ERR_UPDATER_INVALID_RELEASE_FEED')) {
        message = '更新源配置错误，请联系开发者'
      } else if (error.message.includes('ERR_UPDATER_ZIP_FILE_NOT_FOUND')) {
        message = '更新文件损坏，请重启应用重试'
      }

      this.sendToRenderer('update:error', message)
    })
  }

  async checkForUpdates() {
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      console.error('[UpdateService] 检查更新失败:', error)
      const message = error instanceof Error ? error.message : '检查更新失败'
      this.sendToRenderer('update:error', message)
    }
  }

  installNow() {
    if (this.updateDownloaded) {
      console.log('[UpdateService] 准备安装更新并重启应用')
      autoUpdater.quitAndInstall(false, true)
    }
  }

  installOnQuit() {
    if (this.updateDownloaded) {
      autoUpdater.autoInstallOnAppQuit = true
    }
  }

  private sendToRenderer(channel: string, data?: any) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('[UpdateService] 无法发送消息到渲染进程: 窗口不存在或已销毁', channel)
      return
    }
    this.mainWindow.webContents.send(channel, data)
  }
}

export const updateService = new UpdateService()
