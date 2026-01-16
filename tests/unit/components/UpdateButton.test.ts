import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UpdateButton from '../../../src/renderer/src/components/common/UpdateButton.vue'
import { useUpdateStore } from '../../../src/renderer/src/stores/updateStore'

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    template: '<button @click="$attrs.onClick"><slot /></button>'
  },
  useDialog: () => ({
    error: vi.fn()
  })
}))

const mockCheck = vi.fn()
const mockInstallNow = vi.fn()
const mockInstallOnQuit = vi.fn()
const mockOnAvailable = vi.fn()
const mockOnDownloadProgress = vi.fn()
const mockOnDownloaded = vi.fn()
const mockOnError = vi.fn()

Object.defineProperty(window, 'updateAPI', {
  value: {
    check: mockCheck,
    installNow: mockInstallNow,
    installOnQuit: mockInstallOnQuit,
    onAvailable: mockOnAvailable,
    onDownloadProgress: mockOnDownloadProgress,
    onDownloaded: mockOnDownloaded,
    onError: mockOnError
  },
  writable: true
})

describe('UpdateButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('当 updateDownloaded 为 false 时不显示按钮', () => {
    const wrapper = mount(UpdateButton)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('当 updateDownloaded 为 true 时显示按钮', async () => {
    const store = useUpdateStore()
    store.updateDownloaded = true

    const wrapper = mount(UpdateButton)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.text()).toContain('重启并更新')
  })

  it('点击按钮时调用 installNow', async () => {
    const store = useUpdateStore()
    store.updateDownloaded = true

    const wrapper = mount(UpdateButton)
    await wrapper.vm.$nextTick()

    await wrapper.find('button').trigger('click')
    expect(mockInstallNow).toHaveBeenCalledTimes(1)
  })
})
