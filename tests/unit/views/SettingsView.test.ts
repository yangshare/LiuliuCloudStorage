import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createApp } from 'vue'
import { NMessageProvider } from 'naive-ui'
import SettingsView from '../../../src/renderer/src/views/SettingsView.vue'

// Mock window.electronAPI
const mockElectronAPI = {
  app: {
    getLoginItemSettings: vi.fn(),
    setLoginItemSettings: vi.fn(),
    getVersion: vi.fn()
  },
  downloadConfig: {
    get: vi.fn(),
    update: vi.fn(),
    selectDirectory: vi.fn()
  },
  platform: 'win32'
}

// Mock window.$message
const mockMessage = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}

describe('SettingsView - 按日期自动分类', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).electronAPI = mockElectronAPI
    ;(window as any).$message = mockMessage
    mockElectronAPI.app.getLoginItemSettings.mockResolvedValue({ success: true, openAtLogin: false })
    mockElectronAPI.app.getVersion.mockResolvedValue('1.0.0')
    mockElectronAPI.downloadConfig.get.mockResolvedValue({
      defaultPath: 'C:\\Downloads',
      autoCreateDateFolder: false
    })
  })

  it('应该显示"按日期自动分类"复选框', async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          NCard: false,
          NSpace: false,
          NFormItem: false,
          NCheckbox: false,
          NText: false,
          NDivider: false
        },
        mocks: {
          $message: mockMessage
        }
      }
    })
    await new Promise(resolve => setTimeout(resolve, 100))

    const checkbox = wrapper.find('[data-testid="auto-create-date-folder-checkbox"]')
    expect(checkbox.exists()).toBe(true)
  })

  it('应该显示功能说明提示文本', async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          NCard: false,
          NSpace: false,
          NFormItem: false,
          NCheckbox: false,
          NText: false,
          NDivider: false
        },
        mocks: {
          $message: mockMessage
        }
      }
    })
    await new Promise(resolve => setTimeout(resolve, 100))

    const helpText = wrapper.find('[data-testid="auto-create-date-folder-help"]')
    expect(helpText.exists()).toBe(true)
    expect(helpText.text()).toContain('按月份分类')
  })

  it('应该从配置中加载初始状态', async () => {
    mockElectronAPI.downloadConfig.get.mockResolvedValue({
      defaultPath: 'C:\\Downloads',
      autoCreateDateFolder: true
    })

    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          NCard: false,
          NSpace: false,
          NFormItem: false,
          NCheckbox: false,
          NText: false,
          NDivider: false
        },
        mocks: {
          $message: mockMessage
        }
      }
    })
    await new Promise(resolve => setTimeout(resolve, 100))

    const checkbox = wrapper.find('[data-testid="auto-create-date-folder-checkbox"]')
    expect(checkbox.attributes('aria-checked')).toBe('true')
  })

  it('应该在复选框变化时调用更新配置', async () => {
    mockElectronAPI.downloadConfig.update.mockResolvedValue({ success: true })

    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          NCard: false,
          NSpace: false,
          NFormItem: false,
          NCheckbox: false,
          NText: false,
          NDivider: false
        },
        mocks: {
          $message: mockMessage
        }
      }
    })
    await new Promise(resolve => setTimeout(resolve, 100))

    const checkbox = wrapper.find('[data-testid="auto-create-date-folder-checkbox"]')
    await checkbox.trigger('click')
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(mockElectronAPI.downloadConfig.update).toHaveBeenCalledWith({
      autoCreateDateFolder: true
    })
  })
})
