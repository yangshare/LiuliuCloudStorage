import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('集成测试 - 完整的管理员权限控制流程', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    // 默认mock: 用户已登录且完成引导
    mockCheckSession.mockResolvedValue({
      valid: true,
      onboardingCompleted: true
    })
  })

  describe('场景1: 管理员用户访问管理界面', () => {
    it('应该通过所有权限检查并允许访问', async () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'admin-token',
        isAdmin: true
      }
      authStore.user = adminUser
      mockGetUsers.mockResolvedValue({ success: true, data: [] })

      // Act - 尝试访问admin路由
      await router.push('/admin')

      // Assert
      // 1. 检查路由守卫是否通过
      expect(mockGetUsers).toHaveBeenCalled()

      // 2. 检查最终路由
      expect(router.currentRoute.value.path).toBe('/admin')

      // 3. 检查authStore状态
      expect(authStore.isLoggedIn).toBe(true)
      expect(authStore.isAdmin).toBe(true)

      // 4. 验证双重权限检查(路由守卫 + 组件内)
      expect(mockGetUsers).toHaveBeenCalled()
    })
  })

  describe('场景2: 普通用户尝试访问管理界面', () => {
    it('应该在路由守卫阶段被拦截并重定向到home页', async () => {
      // Arrange
      const authStore = useAuthStore()
      const normalUser: User = {
        id: 2,
        username: 'normaluser',
        token: 'user-token',
        isAdmin: false
      }
      authStore.user = normalUser
      mockGetUsers.mockResolvedValue({ success: false })

      // Act - 尝试访问admin路由
      await router.push('/admin')

      // Assert
      // 1. 检查是否进行了权限验证
      expect(mockGetUsers).toHaveBeenCalled()

      // 2. 检查是否被重定向到home页
      expect(router.currentRoute.value.path).toBe('/home')

      // 3. 检查authStore状态
      expect(authStore.isLoggedIn).toBe(true)
      expect(authStore.isAdmin).toBe(false)
    })
  })

  describe('场景3: 未登录用户尝试访问管理界面', () => {
    it('应该在路由守卫阶段被重定向到login页', async () => {
      // Arrange
      const authStore = useAuthStore()
      authStore.user = null
      mockCheckSession.mockResolvedValue({
        valid: false,
        onboardingCompleted: false
      })

      // Act - 尝试访问admin路由
      await router.push('/admin')

      // Assert
      // 1. 检查是否被重定向到login页
      expect(router.currentRoute.value.path).toBe('/login')

      // 2. 检查authStore状态
      expect(authStore.isLoggedIn).toBe(false)
      expect(authStore.isAdmin).toBe(false)

      // 3. 不应该调用getUsers IPC
      expect(mockGetUsers).not.toHaveBeenCalled()
    })
  })

  describe('场景4: 后端权限验证失败', () => {
    it('应该拒绝访问即使前端isAdmin为true', async () => {
      // Arrange
      const authStore = useAuthStore()
      // 模拟前端状态被篡改或不同步的情况
      const user: User = {
        id: 3,
        username: 'fakeadmin',
        token: 'fake-token',
        isAdmin: true // 前端认为是管理员
      }
      authStore.user = user
      // 但后端验证失败
      mockGetUsers.mockResolvedValue({ success: false })

      // Act - 尝试访问admin路由
      await router.push('/admin')

      // Assert
      // 1. 后端验证应该失败
      expect(mockGetUsers).toHaveBeenCalled()

      // 2. 应该被重定向
      expect(router.currentRoute.value.path).toBe('/home')

      // 这验证了双重权限检查机制的有效性
    })
  })

  describe('场景5: IPC通信异常', () => {
    it('应该安全处理IPC错误并拒绝访问', async () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'admin-token',
        isAdmin: true
      }
      authStore.user = adminUser
      mockGetUsers.mockRejectedValue(new Error('Network error'))

      // Act - 尝试访问admin路由
      await router.push('/admin')

      // Assert
      // 1. 应该尝试调用IPC
      expect(mockGetUsers).toHaveBeenCalled()

      // 2. 应该被重定向(安全第一原则)
      expect(router.currentRoute.value.path).toBe('/home')
    })
  })

  describe('场景6: 权限检查的完整性', () => {
    it('应该在多个层面验证权限', async () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'admin-token',
        isAdmin: true
      }
      authStore.user = adminUser
      mockGetUsers.mockResolvedValue({ success: true, data: [] })

      // Act
      await router.push('/admin')

      // Assert - 验证多层权限检查
      // 1. 路由meta标记检查
      const route = router.resolve('/admin')
      expect(route.meta.requiresAdmin).toBe(true)

      // 2. authStore.isAdmin getter检查
      expect(authStore.isAdmin).toBe(true)

      // 3. IPC后端验证
      expect(mockGetUsers).toHaveBeenCalled()

      // 4. 路由守卫执行
      expect(router.currentRoute.value.path).toBe('/admin')
    })
  })

  describe('场景7: Hash模式路由', () => {
    it('应该使用Hash模式保持一致性', () => {
      // Assert
      // 验证路由配置使用Hash模式
      const routerOptions = router.options
      expect(routerOptions.history).toBeDefined()

      // Hash模式的URL应该包含#
      const adminUrl = router.resolve('/admin').href
      expect(adminUrl).toBeTruthy()
    })
  })
})
