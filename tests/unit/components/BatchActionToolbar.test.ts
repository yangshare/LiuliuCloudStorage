import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BatchActionToolbar from '../../../src/renderer/src/components/file/BatchActionToolbar.vue'
import { useFileStore } from '../../../src/renderer/src/features/file/stores/fileStore'

const mocks = vi.hoisted(() => ({
  batchQueueDownload: vi.fn(),
  messageInfo: vi.fn(),
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
  messageError: vi.fn(),
  alert: vi.fn()
}))

vi.mock('@/features/transfer/composables/useTransferDownload', () => ({
  useTransferDownload: () => ({
    batchQueueDownload: mocks.batchQueueDownload
  })
}))

vi.mock('element-plus', () => ({
  ElText: { template: '<span><slot /></span>' },
  ElButton: { template: '<button :disabled="loading" @click="$emit(\'click\')"><slot /></button>', props: ['loading', 'icon', 'type'] },
  ElDialog: { template: '<section v-if="modelValue"><slot /><footer><slot name="footer" /></footer></section>', props: ['modelValue'] },
  ElIcon: { template: '<i><slot /></i>' },
  ElSpace: { template: '<div><slot /></div>' },
  ElInput: { template: '<input />', props: ['modelValue', 'placeholder', 'clearable', 'prefixIcon'] },
  ElMessage: {
    info: mocks.messageInfo,
    success: mocks.messageSuccess,
    warning: mocks.messageWarning,
    error: mocks.messageError
  },
  ElMessageBox: {
    alert: mocks.alert
  }
}))

vi.mock('@element-plus/icons-vue', () => ({
  Download: {},
  Refresh: {},
  Search: {},
  Loading: { template: '<span />' }
}))

describe('BatchActionToolbar', () => {
  let progressListener: ((data: { sessionId: string; count: number }) => void) | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    progressListener = undefined
    mocks.batchQueueDownload.mockResolvedValue({ success: true, successCount: 1000 })
    mocks.alert.mockResolvedValue(undefined)

    ;(window as any).electronAPI = {
      file: {
        getAllFilesInDirectory: vi.fn((_remotePath: string, _maxFiles: number, sessionId: string) => {
          if (_remotePath.endsWith('/dir-a')) {
            progressListener?.({ sessionId, count: 800 })
            return Promise.resolve({ success: true, data: { files: makePaths(800, '/dir-a'), truncated: false, cancelled: false } })
          }
          return new Promise((resolve) => {
            progressListener?.({ sessionId, count: 200 })
            pendingSecondScanResolve = () => resolve({ success: true, data: { files: makePaths(200, '/dir-b'), truncated: false, cancelled: false } })
          })
        }),
        cancelGetAllFiles: vi.fn(),
        onGetAllFilesProgress: vi.fn((callback) => {
          progressListener = callback
        }),
        removeGetAllFilesProgressListener: vi.fn((callback) => {
          if (progressListener === callback) progressListener = undefined
        })
      }
    }
  })

  it('扫描多个目录时按已加入的目录文件数累计显示进度', async () => {
    pendingSecondScanResolve = undefined
    const store = useFileStore()
    store.currentPath = '/'
    store.selectedFiles.push(
      { name: 'dir-a', size: 0, isDir: true, modified: '' },
      { name: 'dir-b', size: 0, isDir: true, modified: '' }
    )

    const wrapper = mount(BatchActionToolbar)

    await wrapper.findAll('button')[0].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('已找到 1000 个文件')

    pendingSecondScanResolve?.()
    await flushPromises()
    expect(mocks.batchQueueDownload).toHaveBeenCalledWith(expect.arrayContaining(['/dir-a/f0.txt', '/dir-b/f199.txt']))
  })
})

let pendingSecondScanResolve: (() => void) | undefined

function makePaths(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}/f${i}.txt`)
}
