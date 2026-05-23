import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AdminView from '@/views/AdminView.vue'

const { mockCheckAdminPermission, mockPush } = vi.hoisted(() => ({
  mockCheckAdminPermission: vi.fn(),
  mockPush: vi.fn()
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    checkAdminPermission: mockCheckAdminPermission
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  }),
  RouterView: {
    name: 'RouterView',
    template: '<div class="router-view-mock" />'
  }
}))

vi.mock('@/components/admin/AdminLayout.vue', () => ({
  default: {
    name: 'AdminLayout',
    template: '<section class="admin-layout-mock"><slot /></section>'
  }
}))

describe('AdminView - 管理员界面组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAdminPermission.mockResolvedValue(true)
  })

  it('当用户有管理员权限时应该渲染布局并保留子路由出口', async () => {
    const wrapper = mount(AdminView, {
      global: {
        stubs: {
          RouterView: { template: '<div class="router-view-mock" />' },
          'router-view': { template: '<div class="router-view-mock" />' }
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.admin-layout-mock').exists()).toBe(true)
    expect(wrapper.find('.router-view-mock').exists()).toBe(true)
    expect(mockCheckAdminPermission).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('当用户没有管理员权限时应该跳转到home页', async () => {
    mockCheckAdminPermission.mockResolvedValueOnce(false)

    mount(AdminView)
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })

  it('权限检查异常时应该跳转到home页', async () => {
    mockCheckAdminPermission.mockRejectedValueOnce(new Error('IPC error'))

    mount(AdminView)
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
  })
})
