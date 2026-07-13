import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '../../../src/renderer/src/views/HomeView.vue'
import { useFileStore } from '../../../src/renderer/src/features/file/stores/fileStore'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} })
}))

const initDownloadQueueMock = vi.fn()

vi.mock('@/features/transfer/composables/useTransferUpload', () => ({
  useTransferUpload: () => ({
    addToUploadQueue: vi.fn()
  })
}))

vi.mock('@/features/transfer/composables/useTransferDownload', () => ({
  useTransferDownload: () => ({
    initDownloadQueue: initDownloadQueueMock
  })
}))

const stubs = {
  FileList: { template: '<div />' },
  Breadcrumb: { template: '<div />' },
  FileDetail: { template: '<div />' },
  OfflineBanner: { template: '<div />' },
  TransferProgressList: { template: '<div />' },
  DownloadQueuePanel: { template: '<div />' },
  CreateFolderModal: { template: '<div />' },
  BatchActionToolbar: { template: '<div />' },
  UpdateButton: { template: '<button />' },
  ElContainer: { template: '<div><slot /></div>' },
  ElMain: { template: '<main><slot /></main>' },
  ElCard: { template: '<section><slot name="header" /><slot /></section>' },
  ElButton: { template: '<button><slot /></button>' },
  ElIcon: { template: '<i><slot /></i>' },
  ElText: { template: '<span><slot /></span>' },
  ElDrawer: { template: '<aside><slot name="header" /><slot /></aside>' },
  ElDropdown: { template: '<div><slot /><slot name="dropdown" /></div>' },
  ElDropdownMenu: { template: '<div><slot /></div>' },
  ElDropdownItem: { template: '<div><slot /></div>' },
  ElBadge: { template: '<div><slot /></div>' }
}

async function mountHomeAtPath(path: string) {
  const wrapper = mount(HomeView, {
    global: {
      plugins: [createPinia()],
      stubs
    }
  })
  await flushPromises()

  const fileStore = useFileStore()
  fileStore.currentPath = path

  return { wrapper, fileStore }
}

describe('HomeView - Keyboard Shortcuts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(window as any).electronAPI = {
      file: {
        list: vi.fn().mockResolvedValue({ success: true, data: { content: [], total: 0 } })
      },
      tray: {
        onTrayQuickUpload: vi.fn()
      }
    }
  })

  it('应该在按下Backspace时调用goUp', async () => {
    const { wrapper, fileStore } = await mountHomeAtPath('/folder')
    const goUpSpy = vi.spyOn(fileStore, 'goUp')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))

    expect(goUpSpy).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('应该在按下Alt+Left时调用goUp', async () => {
    const { wrapper, fileStore } = await mountHomeAtPath('/folder')
    const goUpSpy = vi.spyOn(fileStore, 'goUp')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }))

    expect(goUpSpy).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('应该在INPUT元素中阻止快捷键触发', async () => {
    const { wrapper, fileStore } = await mountHomeAtPath('/folder')
    const goUpSpy = vi.spyOn(fileStore, 'goUp')

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })
    Object.defineProperty(event, 'target', { value: input, enumerable: true })
    window.dispatchEvent(event)

    expect(goUpSpy).not.toHaveBeenCalled()

    document.body.removeChild(input)
    wrapper.unmount()
  })

  it('应该在TEXTAREA元素中阻止快捷键触发', async () => {
    const { wrapper, fileStore } = await mountHomeAtPath('/folder')
    const goUpSpy = vi.spyOn(fileStore, 'goUp')

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })
    Object.defineProperty(event, 'target', { value: textarea, enumerable: true })
    window.dispatchEvent(event)

    expect(goUpSpy).not.toHaveBeenCalled()

    document.body.removeChild(textarea)
    wrapper.unmount()
  })

  it('初始化下载队列时传入 authStore.user.token', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const { useAuthStore } = await import('../../../src/renderer/src/features/auth/stores/authStore')
    const authStore = useAuthStore()
    authStore.setUser({ id: 7, username: 'alice', token: 'user-token', isAdmin: false })

    mount(HomeView, {
      global: {
        plugins: [pinia],
        stubs
      }
    })
    await flushPromises()

    expect(initDownloadQueueMock).toHaveBeenCalledWith(7, 'user-token')
  })
})
