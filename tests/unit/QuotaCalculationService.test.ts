import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QuotaCalculationService } from '@/main/services/QuotaCalculationService'
import { alistService } from '@/main/services/AlistService'
import axios from 'axios'

// Mock dependencies
vi.mock('@/main/services/AlistService', () => ({
  alistService: {
    listFiles: vi.fn()
  }
}))

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}))

describe('QuotaCalculationService', () => {
  let service: QuotaCalculationService

  beforeEach(() => {
    service = new QuotaCalculationService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('calculateQuota', () => {
    it('应该通过 n8n Webhook 成功计算配额', async () => {
      // Arrange
      const userId = 1
      const username = 'testuser'
      const expectedQuota = 1024000

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { quotaUsed: expectedQuota }
      } as any)

      // Act
      const result = await service.calculateQuota(userId, username)

      // Assert
      expect(result).toBe(expectedQuota)
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/quota/calculate'),
        {
          userId,
          username,
          path: `/root/users/${username}/`
        },
        { timeout: 5000 }
      )
    })

    it('应该在 n8n Webhook 失败时降级到 Alist API', async () => {
      // Arrange
      const userId = 1
      const username = 'testuser'
      const expectedQuota = 2048000

      // n8n Webhook 失败
      vi.mocked(axios.post).mockRejectedValueOnce(new Error('n8n unavailable'))

      // Alist API 成功
      vi.mocked(alistService.listFiles).mockResolvedValueOnce({
        content: [
          { name: 'file1.txt', size: 1024000, isDir: false, modified: '2024-01-01' },
          { name: 'file2.txt', size: 1024000, isDir: false, modified: '2024-01-01' }
        ],
        total: 2,
        readme: '',
        write: true,
        provider: 'local'
      })

      // Act
      const result = await service.calculateQuota(userId, username)

      // Assert
      expect(result).toBe(expectedQuota)
      expect(alistService.listFiles).toHaveBeenCalled()
    })

    it('应该正确处理递归目录大小计算', async () => {
      // Arrange
      const userId = 1
      const username = 'testuser'

      // n8n Webhook 失败
      vi.mocked(axios.post).mockRejectedValueOnce(new Error('n8n unavailable'))

      // Mock Alist API 调用序列
      vi.mocked(alistService.listFiles)
        // 第一次调用：根目录
        .mockResolvedValueOnce({
          content: [
            { name: 'file1.txt', size: 1000, isDir: false, modified: '2024-01-01' },
            { name: 'subfolder', size: 0, isDir: true, modified: '2024-01-01' }
          ],
          total: 2,
          readme: '',
          write: true,
          provider: 'local'
        })
        // 第二次调用：子目录
        .mockResolvedValueOnce({
          content: [
            { name: 'file2.txt', size: 2000, isDir: false, modified: '2024-01-01' }
          ],
          total: 1,
          readme: '',
          write: true,
          provider: 'local'
        })

      // Act
      const result = await service.calculateQuota(userId, username)

      // Assert
      expect(result).toBe(3000) // 1000 + 2000
      expect(alistService.listFiles).toHaveBeenCalledTimes(2)
    })

    it('应该处理空目录', async () => {
      // Arrange
      const userId = 1
      const username = 'testuser'

      vi.mocked(axios.post).mockRejectedValueOnce(new Error('n8n unavailable'))
      vi.mocked(alistService.listFiles).mockResolvedValueOnce({
        content: [],
        total: 0,
        readme: '',
        write: true,
        provider: 'local'
      })

      // Act
      const result = await service.calculateQuota(userId, username)

      // Assert
      expect(result).toBe(0)
    })

    it('应该在所有方法失败时抛出错误', async () => {
      // Arrange
      const userId = 1
      const username = 'testuser'

      vi.mocked(axios.post).mockRejectedValueOnce(new Error('n8n unavailable'))
      vi.mocked(alistService.listFiles).mockRejectedValueOnce(new Error('Alist error'))

      // Act & Assert
      await expect(service.calculateQuota(userId, username)).rejects.toThrow('计算配额失败')
    })
  })

  describe('getPathSize', () => {
    it('应该计算单个路径的文件大小总和', async () => {
      // Arrange
      const path = '/test/path'

      vi.mocked(alistService.listFiles).mockResolvedValueOnce({
        content: [
          { name: 'file1.txt', size: 1000, isDir: false, modified: '2024-01-01' },
          { name: 'file2.txt', size: 2000, isDir: false, modified: '2024-01-01' },
          { name: 'folder', size: 0, isDir: true, modified: '2024-01-01' } // 不应递归
        ],
        total: 3,
        readme: '',
        write: true,
        provider: 'local'
      })

      // Act
      const result = await service.getPathSize(path)

      // Assert
      expect(result).toBe(3000) // 只计算文件，不递归子目录
    })

    it('应该在 API 失败时返回 0', async () => {
      // Arrange
      const path = '/test/path'

      vi.mocked(alistService.listFiles).mockRejectedValueOnce(new Error('API error'))

      // Act
      const result = await service.getPathSize(path)

      // Assert
      expect(result).toBe(0)
    })
  })
})
