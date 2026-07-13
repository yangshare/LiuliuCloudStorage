import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SetupView from '../../../src/renderer/src/views/SetupView.vue'

// 用 hoisted 共享 mock，便于在每个用例里切换 route.query
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  route: { query: {} as Record<string, string | undefined> }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push }),
  useRoute: () => mocks.route
}))

const stubs = {
  ElForm: { emits: ['submit'], template: '<form @submit="$emit(`submit`, $event)"><slot /></form>' },
  ElFormItem: { template: '<div><slot /></div>' },
  ElInput: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(`update:modelValue`, $event.target.value)" />' },
  ElButton: { template: '<button><slot /></button>' },
  ElIcon: { template: '<span><slot /></span>' }
}

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}))

vi.mock('@element-plus/icons-vue', () => ({ Link: {}, Platform: {}, Key: {}, Loading: {} }))

describe('SetupView 文案与保存', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.route.query = {}
    ;(window as any).electronAPI = {
      config: {
        get: vi.fn().mockResolvedValue({
          alistBaseUrl: 'https://alist.example.com',
          n8nBaseUrl: '',
          ambApiBaseUrl: 'https://amb.example.com/prod-api',
          ambTransferToken: 'tok'
        }),
        save: vi.fn().mockResolvedValue({ success: true }),
        reinit: vi.fn().mockResolvedValue({ success: true })
      }
    }
  })

  it('默认（无 mode）时标题为「欢迎使用溜溜网盘」', async () => {
    const wrapper = mount(SetupView, { global: { stubs } })
    await flushPromises()
    expect(wrapper.find('.setup-header h1').text()).toBe('欢迎使用溜溜网盘')
  })

  it('mode=edit 时标题为「修改服务器配置」', async () => {
    mocks.route.query = { mode: 'edit' }
    const wrapper = mount(SetupView, { global: { stubs } })
    await flushPromises()
    expect(wrapper.find('.setup-header h1').text()).toBe('修改服务器配置')
  })

  it('保存时依次调用 config.save 与 config.reinit，成功后跳转 /login', async () => {
    const wrapper = mount(SetupView, { global: { stubs } })
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect((window as any).electronAPI.config.save).toHaveBeenCalledTimes(1)
    expect((window as any).electronAPI.config.reinit).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith('/login')
  })
})
