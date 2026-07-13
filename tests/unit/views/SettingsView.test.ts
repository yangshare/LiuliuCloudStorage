import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import SettingsView from '../../../src/renderer/src/views/SettingsView.vue'

const mockElectronAPI = {
  platform: 'win32',
  app: {
    getLoginItemSettings: vi.fn(),
    setLoginItemSettings: vi.fn(),
    getVersion: vi.fn(),
    openLogsDirectory: vi.fn()
  },
  downloadConfig: {
    get: vi.fn(),
    update: vi.fn(),
    selectDirectory: vi.fn(),
    openDirectory: vi.fn(),
    reset: vi.fn(),
    createDirectory: vi.fn()
  },
  cache: {
    getInfo: vi.fn(),
    clear: vi.fn()
  },
  config: {
    get: vi.fn(),
    save: vi.fn(),
    reinit: vi.fn()
  },
  auth: {
    logout: vi.fn()
  }
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
      { path: '/settings', component: SettingsView }
    ]
  })
}

async function mountSettingsView() {
  const router = createTestRouter()
  await router.push('/settings')
  await router.isReady()

  const wrapper = mount(SettingsView, {
    global: {
      plugins: [createPinia(), router, ElementPlus]
    }
  })

  await flushPromises()
  return wrapper
}

async function clickButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper
    .findAll('button')
    .find((item) => item.text().includes(text))

  expect(button, `button "${text}" should exist`).toBeTruthy()
  await button!.trigger('click')
  await flushPromises()
}

describe('SettingsView - 设置页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).electronAPI = mockElectronAPI
    localStorage.clear()

    mockElectronAPI.app.getLoginItemSettings.mockResolvedValue({ success: true, openAtLogin: false })
    mockElectronAPI.app.getVersion.mockResolvedValue('1.0.0')
    mockElectronAPI.downloadConfig.get.mockResolvedValue({
      defaultPath: 'C:\\Downloads',
      autoCreateDateFolder: false
    })
    mockElectronAPI.cache.getInfo.mockResolvedValue({
      success: true,
      size: '128 MB',
      directory: 'C:\\Users\\test\\AppData\\Roaming\\liuliu-cloud-storage\\Cache',
      lastCleanup: ''
    })
    mockElectronAPI.cache.clear.mockResolvedValue({
      success: true,
      clearedSize: '128 MB',
      remainingSize: '0 B',
      filesDeleted: 3
    })
    mockElectronAPI.config.get.mockResolvedValue({
      alistBaseUrl: 'http://localhost:5244',
      ambApiBaseUrl: 'https://amb.example.com/prod-api',
      ambTransferToken: ''
    })

    vi.spyOn(ElMessage, 'success').mockImplementation(vi.fn() as any)
    vi.spyOn(ElMessage, 'error').mockImplementation(vi.fn() as any)
    vi.spyOn(ElMessage, 'warning').mockImplementation(vi.fn() as any)
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm')
  })

  it('应该显示"按日期自动分类"复选框', async () => {
    const wrapper = await mountSettingsView()

    const checkbox = wrapper.find('[data-testid="auto-create-date-folder-checkbox"]')
    expect(checkbox.exists()).toBe(true)
  })

  it('应该显示功能说明提示文本', async () => {
    const wrapper = await mountSettingsView()

    const helpText = wrapper.find('[data-testid="auto-create-date-folder-help"]')
    expect(helpText.exists()).toBe(true)
    expect(helpText.text()).toContain('按日期分类')
  })

  it('应该从配置中加载初始状态', async () => {
    mockElectronAPI.downloadConfig.get.mockResolvedValue({
      defaultPath: 'C:\\Downloads',
      autoCreateDateFolder: true
    })

    const wrapper = await mountSettingsView()

    const checkbox = wrapper.find('[data-testid="auto-create-date-folder-checkbox"]')
    expect(checkbox.classes()).toContain('is-checked')
  })

  it('应该在复选框变化时调用更新配置', async () => {
    const wrapper = await mountSettingsView()

    const checkboxInput = wrapper.find('[data-testid="auto-create-date-folder-checkbox"] input[type="checkbox"]')
    await checkboxInput.setValue(true)
    await flushPromises()

    expect(mockElectronAPI.downloadConfig.update).toHaveBeenCalledWith({
      autoCreateDateFolder: true
    })
  })

  it('应该加载并展示缓存信息', async () => {
    const wrapper = await mountSettingsView()

    expect(mockElectronAPI.cache.getInfo).toHaveBeenCalled()
    expect(wrapper.text()).toContain('当前缓存：128 MB')
    expect(wrapper.text()).toContain('C:\\Users\\test\\AppData\\Roaming\\liuliu-cloud-storage\\Cache')
    expect(wrapper.text()).toContain('上次清理：从未清理')
  })

  it('确认后应该调用缓存清理并刷新缓存信息', async () => {
    mockElectronAPI.cache.getInfo
      .mockResolvedValueOnce({
        success: true,
        size: '128 MB',
        directory: 'C:\\Users\\test\\AppData\\Roaming\\liuliu-cloud-storage\\Cache',
        lastCleanup: ''
      })
      .mockResolvedValueOnce({
        success: true,
        size: '128 MB',
        directory: 'C:\\Users\\test\\AppData\\Roaming\\liuliu-cloud-storage\\Cache',
        lastCleanup: ''
      })
      .mockResolvedValueOnce({
        success: true,
        size: '0 B',
        directory: 'C:\\Users\\test\\AppData\\Roaming\\liuliu-cloud-storage\\Cache',
        lastCleanup: '刚刚'
      })

    const wrapper = await mountSettingsView()

    await clickButtonByText(wrapper, '清理缓存')

    expect(ElMessageBox.confirm).toHaveBeenCalledWith(
      expect.stringContaining('当前缓存大小：128 MB'),
      '⚠️ 确认清理缓存',
      expect.objectContaining({ confirmButtonText: '确认清理' })
    )
    expect(mockElectronAPI.cache.clear).toHaveBeenCalledTimes(1)
    expect(ElMessage.success).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '缓存清理完成！已清理 128 MB，删除 3 个文件'
      })
    )
    expect(wrapper.text()).toContain('当前缓存：0 B')
    expect(wrapper.text()).toContain('上次清理：刚刚')
  })
})
