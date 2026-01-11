import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminView from '@/views/AdminView.vue'
import { useAuthStore, type User } from '@/stores/authStore'

// Mock electronAPI
const mockGetUsers = vi.fn()
const mockPush = vi.fn()

global.window = {
  ...global.window,
  electronAPI: {
    auth: {
      getUsers: mockGetUsers
    }
  }
} as any

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock AdminLayout component
vi.mock('@/components/admin/AdminLayout.vue', () => ({
  default: {
    name: 'AdminLayout',
    template: '<div class="admin-layout-mock"><slot /></div>'
  }
}))

describe('AdminView - 管理员界面组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('组件挂载时的权限验证', () => {
    it('当用户有管理员权限时应该正常渲染', async () => {
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
      const wrapper = mount(AdminView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AdminLayout: true
          }
        }
      })

      // 等待onMounted完成
      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(wrapper.exists()).toBe(true)
      expect(mockGetUsers).toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('当用户没有管理员权限时应该跳转到home页', async () => {
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
      const wrapper = mount(AdminView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AdminLayout: true
          }
        }
      })

      // 等待onMounted完成
      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(mockGetUsers).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
    })

    it('当IPC调用失败时应该跳转到home页', async () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'admin-token',
        isAdmin: true
      }
      authStore.user = adminUser
      mockGetUsers.mockRejectedValueOnce(new Error('IPC error'))

      // Act
      const wrapper = mount(AdminView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AdminLayout: true
          }
        }
      })

      // 等待onMounted完成
      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      expect(mockGetUsers).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
    })
  })

  describe('组件渲染', () => {
    it('应该渲染管理员控制台标题', () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'admin-token',
        isAdmin: true
      }
      authStore.user = adminUser

      // Act
      const wrapper = mount(AdminView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AdminLayout: true,
            'n-card': { template: '<div class="n-card-mock"><slot /></div>' },
            'n-space': { template: '<div class="n-space-mock"><slot /></div>' },
            'n-text': { template: '<span><slot /></span>' },
            'n-list': { template: '<div class="n-list-mock"><slot /></div>' },
            'n-list-item': { template: '<div class="n-list-item-mock"><slot /></div>' }
          }
        }
      })

      // Assert
      const cards = wrapper.findAll('.n-card-mock')
      expect(cards.length).toBeGreaterThan(0)
    })

    it('应该显示功能导航列表', () => {
      // Arrange
      const authStore = useAuthStore()
      const adminUser: User = {
        id: 1,
        username: 'admin',
        token: 'admin-token',
        isAdmin: true
      }
      authStore.user = adminUser

      // Act
      const wrapper = mount(AdminView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AdminLayout: true,
            'n-card': { template: '<div class="n-card-mock"><slot /></div>' },
            'n-space': { template: '<div class="n-space-mock"><slot /></div>' },
            'n-text': { template: '<span><slot /></span>' },
            'n-list': { template: '<div class="n-list-mock"><slot /></div>' },
            'n-list-item': { template: '<div class="n-list-item-mock"><slot /></div>' }
          }
        }
      })

      // Assert
      const textContent = wrapper.text()
      expect(textContent).toContain('用户管理')
      expect(textContent).toContain('存储监控')
      expect(textContent).toContain('配额管理')
    })
  })

  describe('双重验证机制', () => {
    it('应该在组件挂载时调用checkAdminPermission进行二次验证', async () => {
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
      mount(AdminView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AdminLayout: true
          }
        }
      })

      // 等待onMounted完成
      await new Promise(resolve => setTimeout(resolve, 0))

      // Assert
      // 验证IPC调用被执行,说明进行了双重验证
      expect(mockGetUsers).toHaveBeenCalledTimes(1)
    })
  })
})
