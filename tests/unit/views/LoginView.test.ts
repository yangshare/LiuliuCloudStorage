import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '../../../src/renderer/src/views/LoginView.vue'
import { useAuthStore } from '../../../src/renderer/src/features/auth'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push })
}))

const stubs = {
  ElForm: { template: '<form @submit.prevent="$emit(`submit`)"><slot /></form>' },
  ElFormItem: { template: '<div><slot /></div>' },
  ElInput: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(`update:modelValue`, $event.target.value)" />' },
  ElCheckbox: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input type="checkbox" :checked="modelValue" @change="$emit(`update:modelValue`, $event.target.checked)" />' },
  ElButton: { template: '<button><slot /></button>' }
}

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() }
}))

vi.mock('@element-plus/icons-vue', () => ({ User: {}, Lock: {} }))

describe('LoginView token persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window as any).electronAPI = {
      auth: {
        getLoginPreferences: vi.fn().mockResolvedValue({ success: true, data: { username: '', password: '', autoLogin: false } }),
        login: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 7, username: 'alice', token: 'login-token', isAdmin: false }
        }),
        getCurrentUser: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 7, username: 'alice', isAdmin: false, quotaTotal: 1, quotaUsed: 0 }
        })
      }
    }
  })

  it('登录成功后保存 auth.login 返回的 token', async () => {
    const wrapper = mount(LoginView, { global: { stubs } })
    await flushPromises()

    // 设置表单数据后调用 handleLogin
    const vm = wrapper.vm as any
    vm.formData.username = 'alice'
    vm.formData.password = 'password'
    await vm.handleLogin()
    await flushPromises()

    const authStore = useAuthStore()
    expect(authStore.user?.token).toBe('login-token')
    expect(push).toHaveBeenCalledWith('/')
  })
})
