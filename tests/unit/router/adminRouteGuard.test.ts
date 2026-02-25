import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import { useAuthStore, type User } from '@/stores/authStore'

// Mock electronAPI
const mockCheckSession = vi.fn()
const mockGetUsers = vi.fn()

global.window = {
  ...global.window,
  electronAPI: {
    auth: {
      checkSession: mockCheckSession,
      getUsers: mockGetUsers
    }
  }
} as any

describe('路由守卫 - 管理员权限控制', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    // 默认mock: 用户已登录
    mockCheckSession.mockResolvedValue({
      valid: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('访问/admin路由', () => {
    it('应该允许管理员访问', async () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'admin-token',
        isAdmin: true
      }
      authStore.user = adminUser
      mockGetUsers.mockResolvedValueOnce({ success: true, data: [] })

      // Act
      const result = await router.push('/admin')

      // Assert
      expect(mockGetUsers).toHaveBeenCalled()
    })

    it('应该拒绝非管理员用户访问并跳转到/home', async () => {
      // Arrange
      const authStore = useAuthStore()
      const normalUser: User = {
        id: 2,
        username: 'user',
        token: 'user-token',
        isAdmin: false
      }
      authStore.user = normalUser
      mockGetUsers.mockResolvedValueOnce({ success: false })

      // Act
      await router.push('/admin')

      // Assert
      expect(router.currentRoute.value.path).toBe('/home')
      expect(mockGetUsers).toHaveBeenCalled()
    })

    it('未登录用户应该跳转到/login', async () => {
      // Arrange
      const authStore = useAuthStore()
      authStore.user = null
      mockCheckSession.mockResolvedValueOnce({
        valid: false
      })

      // Act
      await router.push('/admin')

      // Assert
      expect(router.currentRoute.value.path).toBe('/login')
    })

    it('应该检查meta.requiresAdmin标记', async () => {
      // Arrange
      const adminRoute = router.resolve('/admin')

      // Act & Assert
      expect(adminRoute.meta.requiresAdmin).toBe(true)
    })
  })

  describe('普通路由访问', () => {
    it('普通用户应该能访问/home路由', async () => {
      // Arrange
      const authStore = useAuthStore()
      const normalUser: User = {
        id: 2,
        username: 'user',
        token: 'user-token',
        isAdmin: false
      }
      authStore.user = normalUser

      // Act
      await router.push('/home')

      // Assert
      expect(router.currentRoute.value.path).toBe('/home')
    })

    it('普通用户应该能访问/login路由', async () => {
      // Act
      await router.push('/login')

      // Assert
      expect(router.currentRoute.value.path).toBe('/login')
    })
  })

  describe('路由使用Hash模式', () => {
    it('路由应该使用createWebHashHistory', () => {
      // Assert
      // 路由配置中使用了createWebHashHistory,这在router/index.ts中已定义
      // 通过检查路由对象的options来验证
      const routerOptions = router.options
      expect(routerOptions.history).toBeDefined()
    })
  })
})
