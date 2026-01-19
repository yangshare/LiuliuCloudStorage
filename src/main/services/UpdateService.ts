import { autoUpdater } from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import { join } from 'path'
import { loggerService } from './LoggerService'

class UpdateService {
  private mainWindow: BrowserWindow | null = null
  private updateDownloaded = false

  init(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow

    // 仅在开发环境允许从开发更新源检查更新
    if (!app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true
      loggerService.info('UpdateService', '开发模式：已启用开发更新源')
    }

    // 配置更新缓存路径：使用用户数据目录，避免权限问题
    const userDataPath = app.getPath('userData')
    autoUpdater.cacheDir = join(userDataPath, 'updates')

    loggerService.info('UpdateService', `更新缓存目录: ${autoUpdater.cacheDir}`)
    loggerService.info('UpdateService', `更新源: github-proxy.yangshare.cn/yangshare/LiuliuCloudStorage`)

    // 配置更新源：使用 GitHub provider 配合代理
    // 代理脚本已修复，现在支持 /api/v3/ 路径
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'yangshare',
      repo: 'LiuliuCloudStorage',
      host: 'github-proxy.yangshare.cn'
    })

    // 配置：不自动下载，手动控制
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    loggerService.info('UpdateService', '自动更新服务已初始化')

    // 事件监听
    autoUpdater.on('update-available', (info) => {
      loggerService.info('UpdateService', `发现新版本: ${info.version}`)
      this.sendToRenderer('update:available', info)
      autoUpdater.downloadUpdate() // 开始静默下载
    })

    autoUpdater.on('update-not-available', () => {
      loggerService.info('UpdateService', '当前已是最新版本')
      this.sendToRenderer('update:not-available', undefined)
    })

    autoUpdater.on('download-progress', (progress) => {
      const percent = progress.percent.toFixed(2)
      const transferred = this.formatBytes(progress.transferred)
      const total = this.formatBytes(progress.total)
      loggerService.debug('UpdateService', `下载进度: ${percent}% (${transferred}/${total})`)
      this.sendToRenderer('update:download-progress', progress)
    })

    autoUpdater.on('update-downloaded', () => {
      loggerService.info('UpdateService', '更新下载完成，准备安装')
      this.updateDownloaded = true
      this.sendToRenderer('update:downloaded', undefined)
    })

    autoUpdater.on('error', (error) => {
      loggerService.error('UpdateService', `更新错误: ${error.message}`, error)
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
      loggerService.info('UpdateService', '开始检查更新...')
      await autoUpdater.checkForUpdates()
      loggerService.info('UpdateService', '检查更新完成')
    } catch (error) {
      loggerService.error('UpdateService', '检查更新失败', error as Error)
      const message = error instanceof Error ? error.message : '检查更新失败'
      this.sendToRenderer('update:error', message)
    }
  }

  installNow() {
    if (this.updateDownloaded) {
      loggerService.info('UpdateService', '用户选择立即安装更新，应用将重启')
      autoUpdater.quitAndInstall(false, true)
    }
  }

  installOnQuit() {
    if (this.updateDownloaded) {
      loggerService.info('UpdateService', '已设置应用退出时自动安装更新')
      autoUpdater.autoInstallOnAppQuit = true
    }
  }

  /**
   * 格式化字节数为可读格式
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private sendToRenderer(channel: string, data?: any) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      loggerService.warn('UpdateService', `无法发送消息到渲染进程: 窗口不存在或已销毁 (${channel})`)
      return
    }
    this.mainWindow.webContents.send(channel, data)
  }
}

export const updateService = new UpdateService()
