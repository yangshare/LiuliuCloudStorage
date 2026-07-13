import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import { useAuthStore, type User } from '@/features/auth/stores/authStore'

const mockCheckSession = vi.fn()
const mockGetUsers = vi.fn()
const mockConfigCheck = vi.fn()
const mockStartupRun = vi.fn()

function installElectronApi() {
  ;(window as any).electronAPI = {
    config: {
      check: mockConfigCheck
    },
    auth: {
      checkSession: mockCheckSession,
      getUsers: mockGetUsers
    },
    autoSync: {
      startupRun: mockStartupRun
    }
  }
}

describe('路由守卫 - 管理员权限控制', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    installElectronApi()
    window.history.replaceState({}, '', '/')

    mockConfigCheck.mockResolvedValue({ complete: true })
    mockCheckSession.mockResolvedValue({ valid: true })
    mockStartupRun.mockResolvedValue({ success: true, executed: 0, total: 0 })

    await router.replace('/')
  })

  describe('访问/admin路由', () => {
    it('应该允许管理员访问', async () => {
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'admin-token',
        isAdmin: true
      }
      authStore.user = adminUser

      await router.push('/admin')

      expect(router.currentRoute.value.path).toBe('/admin/dashboard')
      expect(mockGetUsers).not.toHaveBeenCalled()
    })

    it('应该拒绝非管理员用户访问并跳转到首页', async () => {
      const authStore = useAuthStore()
      const normalUser: User = {
        id: 2,
        username: 'user',
        token: 'user-token',
        isAdmin: false
      }
      authStore.user = normalUser
      mockGetUsers.mockResolvedValueOnce({ success: false })

      await router.push('/admin')

      expect(router.currentRoute.value.path).toBe('/')
      expect(mockGetUsers).toHaveBeenCalled()
    })

    it('未登录用户应该跳转到/login', async () => {
      const authStore = useAuthStore()
      authStore.user = null
      mockCheckSession.mockResolvedValueOnce({ valid: false })

      await router.push('/admin')

      expect(router.currentRoute.value.path).toBe('/login')
    })

    it('应该检查meta.requiresAdmin标记', async () => {
      const adminRoute = router.resolve('/admin')

      expect(adminRoute.meta.requiresAdmin).toBe(true)
    })
  })

  describe('普通路由访问', () => {
    it('普通用户应该能访问首页路由', async () => {
      const authStore = useAuthStore()
      const normalUser: User = {
        id: 2,
        username: 'user',
        token: 'user-token',
        isAdmin: false
      }
      authStore.user = normalUser

      await router.push('/')

      expect(router.currentRoute.value.path).toBe('/')
    })

    it('普通用户应该能访问/login路由', async () => {
      await router.push('/login')

      expect(router.currentRoute.value.path).toBe('/login')
    })
  })

  describe('路由使用Hash模式', () => {
    it('路由应该使用createWebHashHistory', () => {
      expect(router.options.history).toBeDefined()
    })
  })
})
