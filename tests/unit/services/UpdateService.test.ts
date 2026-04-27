import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { autoUpdater } from 'electron-updater'
import { app } from 'electron'

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(() => Promise.resolve()),
    quitAndInstall: vi.fn()
  }
}))

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  app: {
    isPackaged: true,
    getPath: vi.fn(() => 'C:\\test-user-data')
  }
}))

vi.mock('../../../src/main/config', () => ({
  loadConfig: vi.fn(() => ({ testUpdate: false }))
}))

const originalPlatform = process.platform

describe('UpdateService', () => {
  let mockWindow: any
  let updateService: any
  let eventHandlers: Map<string, Function>

  beforeEach(async () => {
    vi.clearAllMocks()
    eventHandlers = new Map()

    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true
    })

    mockWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn()
      }
    }

    vi.mocked(autoUpdater.on).mockImplementation((event: string, handler: Function) => {
      eventHandlers.set(event, handler)
      return autoUpdater
    })

    const module = await import('../../../src/main/services/UpdateService')
    updateService = module.updateService
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    })
    vi.resetModules()
  })

  describe('init()', () => {
    it('应该正确配置 Windows autoUpdater', () => {
      updateService.init(mockWindow)

      expect(autoUpdater.setFeedURL).toHaveBeenCalledWith({
        provider: 'generic',
        url: 'https://qiniu.yangshare.com/LiuliuCloudStorage/win/x64'
      })
      expect(autoUpdater.autoDownload).toBe(false)
      expect(autoUpdater.autoInstallOnAppQuit).toBe(false)
      expect(app.getPath).toHaveBeenCalledWith('userData')
    })

    it('应该注册所有必需的事件监听器', () => {
      updateService.init(mockWindow)

      expect(autoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function))
      expect(autoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function))
      expect(autoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function))
      expect(autoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function))
      expect(autoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('非 Windows 平台不应该初始化自动更新', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      })

      updateService.init(mockWindow)

      expect(autoUpdater.setFeedURL).not.toHaveBeenCalled()
      expect(autoUpdater.on).not.toHaveBeenCalled()
    })

    it('当检测到更新时应该发送消息到渲染进程并开始下载', () => {
      updateService.init(mockWindow)

      const updateInfo = { version: '1.0.1' }
      const handler = eventHandlers.get('update-available')
      handler!(updateInfo)

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:available', updateInfo)
      expect(autoUpdater.downloadUpdate).toHaveBeenCalled()
    })

    it('当没有更新时应该发送消息到渲染进程', () => {
      updateService.init(mockWindow)

      const handler = eventHandlers.get('update-not-available')
      handler!()

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:not-available', undefined)
    })

    it('应该发送下载进度到渲染进程', () => {
      updateService.init(mockWindow)

      const progress = { percent: 50, bytesPerSecond: 1024, transferred: 100, total: 200 }
      const handler = eventHandlers.get('download-progress')
      handler!(progress)

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:download-progress', progress)
    })

    it('当更新下载完成时应该发送消息到渲染进程', () => {
      updateService.init(mockWindow)

      const handler = eventHandlers.get('update-downloaded')
      handler!()

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:downloaded', undefined)
    })

    it('当发生错误时应该发送错误消息到渲染进程', () => {
      updateService.init(mockWindow)

      const error = new Error('Update failed')
      const handler = eventHandlers.get('error')
      handler!(error)

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:error', 'Update failed')
    })
  })

  describe('checkForUpdates()', () => {
    it('Windows 平台应该调用 autoUpdater.checkForUpdates', async () => {
      await updateService.checkForUpdates()

      expect(autoUpdater.checkForUpdates).toHaveBeenCalled()
    })

    it('非 Windows 平台应该跳过检查更新', async () => {
      updateService.init(mockWindow)

      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      })

      await updateService.checkForUpdates()

      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('update:not-available', undefined)
    })
  })

  describe('installNow()', () => {
    it('当更新已下载时应该立即安装', () => {
      updateService.init(mockWindow)

      const handler = eventHandlers.get('update-downloaded')
      handler!()

      updateService.installNow()

      expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
    })

    it('当更新未下载时不应该安装', () => {
      updateService.init(mockWindow)

      updateService.installNow()

      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    })
  })

  describe('installOnQuit()', () => {
    it('当更新已下载时应该设置退出时安装', () => {
      updateService.init(mockWindow)

      const handler = eventHandlers.get('update-downloaded')
      handler!()

      updateService.installOnQuit()

      expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
    })

    it('当更新未下载时不应该设置退出时安装', () => {
      updateService.init(mockWindow)

      updateService.installOnQuit()

      expect(autoUpdater.autoInstallOnAppQuit).toBe(false)
    })
  })
})
