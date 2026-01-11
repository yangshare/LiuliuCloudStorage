import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, type User } from '@/stores/authStore'

// Mock electronAPI
const mockGetUsers = vi.fn()

global.window = {
  ...global.window,
  electronAPI: {
    auth: {
      getUsers: mockGetUsers
    }
  }
} as any

describe('authStore - 管理员权限功能', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('isAdmin getter', () => {
    it('当用户为管理员时应该返回true', () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'test-token',
        isAdmin: true
      }

      // Act
      authStore.user = adminUser

      // Assert
      expect(authStore.isAdmin).toBe(true)
    })

    it('当用户不是管理员时应该返回false', () => {
      // Arrange
      const authStore = useAuthStore()
      const normalUser: User = {
        id: 2,
        username: 'user',
        token: 'test-token',
        isAdmin: false
      }

      // Act
      authStore.user = normalUser

      // Assert
      expect(authStore.isAdmin).toBe(false)
    })

    it('当用户为null时应该返回false', () => {
      // Arrange
      const authStore = useAuthStore()

      // Act
      authStore.user = null

      // Assert
      expect(authStore.isAdmin).toBe(false)
    })

    it('当用户isAdmin字段为undefined时应该返回false', () => {
      // Arrange
      const authStore = useAuthStore()
      const userWithoutAdminFlag: User = {
        id: 3,
        username: 'testuser',
        token: 'test-token'
        // isAdmin未定义
      }

      // Act
      authStore.user = userWithoutAdminFlag

      // Assert
      expect(authStore.isAdmin).toBe(false)
    })
  })

  describe('checkAdminPermission方法', () => {
    it('当用户未登录时应该返回false', async () => {
      // Arrange
      const authStore = useAuthStore()
      authStore.user = null

      // Act
      const result = await authStore.checkAdminPermission()

      // Assert
      expect(result).toBe(false)
      expect(mockGetUsers).not.toHaveBeenCalled()
    })

    it('当IPC调用成功时应该返回true', async () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'test-token',
        isAdmin: true
      }
      authStore.user = adminUser
      mockGetUsers.mockResolvedValueOnce({ success: true, data: [] })

      // Act
      const result = await authStore.checkAdminPermission()

      // Assert
      expect(result).toBe(true)
      expect(mockGetUsers).toHaveBeenCalledTimes(1)
    })

    it('当IPC调用失败时应该返回false', async () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'test-token',
        isAdmin: true
      }
      authStore.user = adminUser
      mockGetUsers.mockResolvedValueOnce({ success: false })

      // Act
      const result = await authStore.checkAdminPermission()

      // Assert
      expect(result).toBe(false)
    })

    it('当IPC抛出异常时应该返回false', async () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'test-token',
        isAdmin: true
      }
      authStore.user = adminUser
      mockGetUsers.mockRejectedValueOnce(new Error('IPC error'))

      // Act
      const result = await authStore.checkAdminPermission()

      // Assert
      expect(result).toBe(false)
    })
  })
})
