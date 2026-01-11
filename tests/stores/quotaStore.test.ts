import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useQuotaStore } from '@/renderer/src/stores/quotaStore'

// Mock window.electronAPI
const mockQuotaGet = vi.fn()
const mockQuotaUpdate = vi.fn()

Object.defineProperty(window, 'electronAPI', {
  value: {
    quota: {
      get: mockQuotaGet,
      update: mockQuotaUpdate
    }
  },
  writable: true
})

describe('QuotaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const store = useQuotaStore()

      expect(store.quotaUsed).toBe(0)
      expect(store.quotaTotal).toBe(0)
      expect(store.isLoading).toBe(true)
      expect(store.hasLoaded).toBe(false)
    })
  })

  describe('loadQuota', () => {
    it('应该成功加载配额信息', async () => {
      const mockQuotaData = {
        quotaUsed: 3221225472, // 3GB
        quotaTotal: 10737418240 // 10GB
      }
      mockQuotaGet.mockResolvedValue(mockQuotaData)

      const store = useQuotaStore()
      await store.loadQuota()

      expect(store.quotaUsed).toBe(mockQuotaData.quotaUsed)
      expect(store.quotaTotal).toBe(mockQuotaData.quotaTotal)
      expect(store.isLoading).toBe(false)
      expect(store.hasLoaded).toBe(true)
    })

    it('应该在加载失败时抛出错误并设置状态', async () => {
      const mockError = new Error('用户未登录')
      mockQuotaGet.mockRejectedValue(mockError)

      const store = useQuotaStore()

      await expect(store.loadQuota()).rejects.toThrow('用户未登录')

      expect(store.isLoading).toBe(false)
      expect(store.hasLoaded).toBe(false)
    })

    it('应该正确设置loading状态', async () => {
      mockQuotaGet.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({ quotaUsed: 0, quotaTotal: 10737418240 }), 100)
      }))

      const store = useQuotaStore()
      const loadPromise = store.loadQuota()

      expect(store.isLoading).toBe(true)

      await loadPromise
      expect(store.isLoading).toBe(false)
    })
  })

  describe('refreshQuota', () => {
    it('应该重新加载配额信息', async () => {
      const mockQuotaData = {
        quotaUsed: 5368709120, // 5GB
        quotaTotal: 10737418240 // 10GB
      }
      mockQuotaGet.mockResolvedValue(mockQuotaData)

      const store = useQuotaStore()
      await store.refreshQuota()

      expect(mockQuotaGet).toHaveBeenCalledTimes(1)
      expect(store.quotaUsed).toBe(mockQuotaData.quotaUsed)
      expect(store.quotaTotal).toBe(mockQuotaData.quotaTotal)
    })
  })

  describe('updateQuotaUsage', () => {
    it('应该成功更新配额使用量', async () => {
      const newQuotaUsed = 6442450944 // 6GB
      mockQuotaUpdate.mockResolvedValue({ success: true })

      const store = useQuotaStore()
      await store.updateQuotaUsage(newQuotaUsed)

      expect(mockQuotaUpdate).toHaveBeenCalledWith(newQuotaUsed)
      expect(store.quotaUsed).toBe(newQuotaUsed)
    })

    it('应该在更新失败时抛出错误', async () => {
      const mockError = new Error('更新失败')
      mockQuotaUpdate.mockRejectedValue(mockError)

      const store = useQuotaStore()

      await expect(store.updateQuotaUsage(1000)).rejects.toThrow('更新失败')
    })
  })

  describe('边界情况测试', () => {
    it('应该正确处理零配额', async () => {
      mockQuotaGet.mockResolvedValue({ quotaUsed: 0, quotaTotal: 0 })

      const store = useQuotaStore()
      await store.loadQuota()

      expect(store.quotaUsed).toBe(0)
      expect(store.quotaTotal).toBe(0)
    })

    it('应该正确处理非常大的配额值', async () => {
      const mockQuotaData = {
        quotaUsed: 1099511627776, // 1TB
        quotaTotal: 2199023255552 // 2TB
      }
      mockQuotaGet.mockResolvedValue(mockQuotaData)

      const store = useQuotaStore()
      await store.loadQuota()

      expect(store.quotaUsed).toBe(mockQuotaData.quotaUsed)
      expect(store.quotaTotal).toBe(mockQuotaData.quotaTotal)
    })

    it('应该正确处理配额已满的情况（100%）', async () => {
      const quotaValue = 10737418240 // 10GB
      mockQuotaGet.mockResolvedValue({
        quotaUsed: quotaValue,
        quotaTotal: quotaValue
      })

      const store = useQuotaStore()
      await store.loadQuota()

      expect(store.quotaUsed).toBe(quotaValue)
      expect(store.quotaTotal).toBe(quotaValue)
      // 在组件中会显示100%
    })
  })
})
