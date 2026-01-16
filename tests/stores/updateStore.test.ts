import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUpdateStore } from '../../src/renderer/src/stores/updateStore'

const mockCheck = vi.fn()
const mockInstallNow = vi.fn()
const mockInstallOnQuit = vi.fn()
const mockOnAvailable = vi.fn()
const mockOnDownloadProgress = vi.fn()
const mockOnDownloaded = vi.fn()
const mockOnError = vi.fn()

Object.defineProperty(window, 'updateAPI', {
  value: {
    check: mockCheck,
    installNow: mockInstallNow,
    installOnQuit: mockInstallOnQuit,
    onAvailable: mockOnAvailable,
    onDownloadProgress: mockOnDownloadProgress,
    onDownloaded: mockOnDownloaded,
    onError: mockOnError
  },
  writable: true
})

describe('UpdateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const store = useUpdateStore()

      expect(store.updateAvailable).toBe(false)
      expect(store.updateDownloaded).toBe(false)
      expect(store.downloadProgress).toBe(0)
      expect(store.errorMessage).toBe(null)
    })
  })

  describe('init', () => {
    it('应该注册所有事件监听器并触发检测', () => {
      const store = useUpdateStore()
      store.init()

      expect(mockOnAvailable).toHaveBeenCalledTimes(1)
      expect(mockOnDownloadProgress).toHaveBeenCalledTimes(1)
      expect(mockOnDownloaded).toHaveBeenCalledTimes(1)
      expect(mockOnError).toHaveBeenCalledTimes(1)
      expect(mockCheck).toHaveBeenCalledTimes(1)
    })

    it('应该在收到 onAvailable 事件时更新状态', () => {
      const store = useUpdateStore()
      store.init()

      const availableCallback = mockOnAvailable.mock.calls[0][0]
      availableCallback()

      expect(store.updateAvailable).toBe(true)
    })

    it('应该在收到 onDownloadProgress 事件时更新进度', () => {
      const store = useUpdateStore()
      store.init()

      const progressCallback = mockOnDownloadProgress.mock.calls[0][0]
      progressCallback({ percent: 50 })

      expect(store.downloadProgress).toBe(50)
    })

    it('应该在收到 onDownloaded 事件时更新状态', () => {
      const store = useUpdateStore()
      store.init()

      const downloadedCallback = mockOnDownloaded.mock.calls[0][0]
      downloadedCallback()

      expect(store.updateDownloaded).toBe(true)
    })

    it('应该在收到 onError 事件时更新错误信息', () => {
      const store = useUpdateStore()
      store.init()

      const errorCallback = mockOnError.mock.calls[0][0]
      errorCallback('网络连接失败')

      expect(store.errorMessage).toBe('网络连接失败')
    })
  })

  describe('installNow', () => {
    it('应该调用 updateAPI.installNow', () => {
      const store = useUpdateStore()
      store.installNow()

      expect(mockInstallNow).toHaveBeenCalledTimes(1)
    })
  })

  describe('installOnQuit', () => {
    it('应该调用 updateAPI.installOnQuit', () => {
      const store = useUpdateStore()
      store.installOnQuit()

      expect(mockInstallOnQuit).toHaveBeenCalledTimes(1)
    })
  })

  describe('clearError', () => {
    it('应该清除错误信息', () => {
      const store = useUpdateStore()
      store.init()

      const errorCallback = mockOnError.mock.calls[0][0]
      errorCallback('测试错误')
      expect(store.errorMessage).toBe('测试错误')

      store.clearError()
      expect(store.errorMessage).toBe(null)
    })
  })
})
