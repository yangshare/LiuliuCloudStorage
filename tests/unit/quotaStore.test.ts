import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useQuotaStore } from '@/renderer/src/stores/quotaStore'

// Mock window.electronAPI
const mockQuotaAPI = {
  get: vi.fn(),
  update: vi.fn(),
  calculate: vi.fn()
}

Object.defineProperty(window, 'electronAPI', {
  value: {
    quota: mockQuotaAPI
  },
  writable: true
})

describe('quotaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('loadQuota', () => {
    it('应该成功加载配额信息', async () => {
      // Arrange
      const mockQuotaData = {
        quotaUsed: 1024000,
        quotaTotal: 10737418240
      }
      mockQuotaAPI.get.mockResolvedValueOnce(mockQuotaData)

      const store = useQuotaStore()

      // Act
      await store.loadQuota()

      // Assert
      expect(store.quotaUsed).toBe(mockQuotaData.quotaUsed)
      expect(store.quotaTotal).toBe(mockQuotaData.quotaTotal)
      expect(store.hasLoaded).toBe(true)
      expect(store.isLoading).toBe(false)
      expect(mockQuotaAPI.get).toHaveBeenCalledTimes(1)
    })

    it('应该使用缓存数据（5分钟内）', async () => {
      // Arrange
      const mockQuotaData = {
        quotaUsed: 1024000,
        quotaTotal: 10737418240
      }
      mockQuotaAPI.get.mockResolvedValueOnce(mockQuotaData)

      const store = useQuotaStore()

      // Act - 第一次加载
      await store.loadQuota()
      const firstCallCount = mockQuotaAPI.get.mock.calls.length

      // Act - 第二次加载（缓存有效）
      await store.loadQuota()

      // Assert
      expect(mockQuotaAPI.get).toHaveBeenCalledTimes(firstCallCount) // 不应该再次调用
    })

    it('应该在 forceRefresh 时强制刷新缓存', async () => {
      // Arrange
      const mockQuotaData = {
        quotaUsed: 1024000,
        quotaTotal: 10737418240
      }
      mockQuotaAPI.get.mockResolvedValue(mockQuotaData)

      const store = useQuotaStore()

      // Act - 第一次加载
      await store.loadQuota()
      const firstCallCount = mockQuotaAPI.get.mock.calls.length

      // Act - 强制刷新
      await store.loadQuota(true)

      // Assert
      expect(mockQuotaAPI.get).toHaveBeenCalledTimes(firstCallCount + 1) // 应该再次调用
    })

    it('应该在缓存过期后重新加载', async () => {
      // Arrange
      const mockQuotaData = {
        quotaUsed: 1024000,
        quotaTotal: 10737418240
      }
      mockQuotaAPI.get.mockResolvedValue(mockQuotaData)

      const store = useQuotaStore()

      // Act - 第一次加载
      await store.loadQuota()
      const firstCallCount = mockQuotaAPI.get.mock.calls.length

      // Act - 前进6分钟（超过5分钟缓存）
      vi.advanceTimersByTime(6 * 60 * 1000)
      await store.loadQuota()

      // Assert
      expect(mockQuotaAPI.get).toHaveBeenCalledTimes(firstCallCount + 1) // 应该再次调用
    })

    it('应该处理加载失败', async () => {
      // Arrange
      mockQuotaAPI.get.mockRejectedValueOnce(new Error('Network error'))

      const store = useQuotaStore()

      // Act & Assert
      await expect(store.loadQuota()).rejects.toThrow('Network error')
      expect(store.hasLoaded).toBe(false)
      expect(store.isLoading).toBe(false)
    })
  })

  describe('refreshQuota', () => {
    it('应该强制刷新配额', async () => {
      // Arrange
      const mockQuotaData = {
        quotaUsed: 2048000,
        quotaTotal: 10737418240
      }
      mockQuotaAPI.get.mockResolvedValueOnce(mockQuotaData)

      const store = useQuotaStore()
      await store.loadQuota()

      // Act
      mockQuotaAPI.get.mockResolvedValueOnce({
        quotaUsed: 3072000,
        quotaTotal: 10737418240
      })
      await store.refreshQuota()

      // Assert
      expect(store.quotaUsed).toBe(3072000)
      expect(mockQuotaAPI.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('calculateQuota', () => {
    it('应该成功计算并更新配额', async () => {
      // Arrange
      const mockQuotaData = {
        quotaUsed: 5120000,
        quotaTotal: 10737418240
      }
      mockQuotaAPI.calculate.mockResolvedValueOnce(mockQuotaData)

      const store = useQuotaStore()

      // Act
      await store.calculateQuota()

      // Assert
      expect(store.quotaUsed).toBe(mockQuotaData.quotaUsed)
      expect(store.quotaTotal).toBe(mockQuotaData.quotaTotal)
      expect(store.isLoading).toBe(false)
      expect(mockQuotaAPI.calculate).toHaveBeenCalledTimes(1)
    })

    it('应该更新缓存时间戳', async () => {
      // Arrange
      const mockQuotaData = {
        quotaUsed: 5120000,
        quotaTotal: 10737418240
      }
      mockQuotaAPI.calculate.mockResolvedValueOnce(mockQuotaData)

      const store = useQuotaStore()
      const beforeTimestamp = Date.now()

      // Act
      await store.calculateQuota()

      // Assert
      expect(store.lastUpdated).toBeGreaterThanOrEqual(beforeTimestamp)
    })

    it('应该处理计算失败', async () => {
      // Arrange
      mockQuotaAPI.calculate.mockRejectedValueOnce(new Error('Calculation failed'))

      const store = useQuotaStore()

      // Act & Assert
      await expect(store.calculateQuota()).rejects.toThrow('Calculation failed')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('updateQuotaUsage', () => {
    it('应该成功更新配额使用量', async () => {
      // Arrange
      const newQuotaUsed = 8192000
      mockQuotaAPI.update.mockResolvedValueOnce({ success: true })

      const store = useQuotaStore()
      store.quotaUsed = 5120000

      // Act
      await store.updateQuotaUsage(newQuotaUsed)

      // Assert
      expect(store.quotaUsed).toBe(newQuotaUsed)
      expect(mockQuotaAPI.update).toHaveBeenCalledWith(newQuotaUsed)
    })

    it('应该处理更新失败', async () => {
      // Arrange
      mockQuotaAPI.update.mockRejectedValueOnce(new Error('Update failed'))

      const store = useQuotaStore()

      // Act & Assert
      await expect(store.updateQuotaUsage(8192000)).rejects.toThrow('Update failed')
    })
  })

  describe('缓存机制', () => {
    it('应该在5分钟内使用缓存', async () => {
      // Arrange
      mockQuotaAPI.get.mockResolvedValue({
        quotaUsed: 1024000,
        quotaTotal: 10737418240
      })

      const store = useQuotaStore()

      // Act
      await store.loadQuota()
      const firstTimestamp = store.lastUpdated

      // 4分钟后再次加载
      vi.advanceTimersByTime(4 * 60 * 1000)
      await store.loadQuota()

      // Assert
      expect(store.lastUpdated).toBe(firstTimestamp) // 时间戳未更新，使用了缓存
    })

    it('应该在5分钟后重新加载', async () => {
      // Arrange
      mockQuotaAPI.get
        .mockResolvedValueOnce({
          quotaUsed: 1024000,
          quotaTotal: 10737418240
        })
        .mockResolvedValueOnce({
          quotaUsed: 2048000,
          quotaTotal: 10737418240
        })

      const store = useQuotaStore()

      // Act
      await store.loadQuota()
      const firstTimestamp = store.lastUpdated

      // 6分钟后再次加载
      vi.advanceTimersByTime(6 * 60 * 1000)
      await store.loadQuota()

      // Assert
      expect(store.lastUpdated).toBeGreaterThan(firstTimestamp) // 时间戳已更新
      expect(store.quotaUsed).toBe(2048000) // 使用了新数据
    })
  })
})
