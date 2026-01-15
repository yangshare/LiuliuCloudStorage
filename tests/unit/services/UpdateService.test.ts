import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

// Mock electron-updater
vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn()
  }
}))

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: vi.fn()
}))

describe('UpdateService', () => {
  let mockWindow: any
  let updateService: any
  let eventHandlers: Map<string, Function>

  beforeEach(async () => {
    // 重置所有 mock
    vi.clearAllMocks()
    eventHandlers = new Map()

    // Mock BrowserWindow
    mockWindow = {
      webContents: {
        send: vi.fn()
      }
    }

    // 捕获事件处理器
    vi.mocked(autoUpdater.on).mockImplementation((event: string, handler: Function) => {
      eventHandlers.set(event, handler)
      return autoUpdater
    })

    // 动态导入 UpdateService 以确保 mock 生效
    const module = await import('../../../src/main/services/UpdateService')
    updateService = module.updateService
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('init()', () => {
    it('应该正确配置 autoUpdater', () => {
      updateService.init(mockWindow)

      expect(autoUpdater.autoDownload).toBe(false)
      expect(autoUpdater.autoInstallOnAppQuit).toBe(false)
    })

    it('应该注册所有必需的事件监听器', () => {
      updateService.init(mockWindow)

      expect(autoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function))
      expect(autoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function))
      expect(autoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function))
      expect(autoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function))
      expect(autoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function))
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

      const progress = { percent: 50, bytesPerSecond: 1024 }
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
    it('应该调用 autoUpdater.checkForUpdates', async () => {
      await updateService.checkForUpdates()

      expect(autoUpdater.checkForUpdates).toHaveBeenCalled()
    })
  })

  describe('installNow()', () => {
    it('当更新已下载时应该立即安装', () => {
      updateService.init(mockWindow)

      // 模拟更新已下载
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

      // 模拟更新已下载
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
