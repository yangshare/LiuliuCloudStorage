import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { isProxy } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import ShareTransferView from '../../../src/renderer/src/views/ShareTransferView.vue'
import { useAuthStore } from '../../../src/renderer/src/features/auth'

const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

const stubs = {
  ElCard: { template: '<section><slot name="header" /><slot /></section>' },
  ElForm: { template: '<form><slot /></form>' },
  ElFormItem: { template: '<div><slot /></div>' },
  ElInput: { template: '<input />' },
  ElSwitch: { template: '<button type="button"><slot /></button>' },
  ElRadioGroup: { template: '<div><slot /></div>' },
  ElRadioButton: { template: '<button type="button"><slot /></button>' },
  ElDatePicker: { template: '<input />' },
  ElAlert: { template: '<div><slot name="title" /></div>' },
  ElDivider: { template: '<hr />' },
  ElSpace: { template: '<div><slot /></div>' },
  ElIcon: { template: '<i><slot /></i>' },
  ElTag: { template: '<span><slot /></span>' },
  ElTable: {
    name: 'ElTable',
    props: ['data'],
    template: '<table><slot /></table>'
  },
  ElTableColumn: { template: '<col />' },
  ElPagination: { template: '<nav />' },
  ElDialog: { template: '<dialog><slot /><slot name="footer" /></dialog>' },
  ElProgress: { template: '<div />' },
  ElButton: {
    name: 'ElButton',
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button type="button" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>'
  }
}

const mockElectronAPI = {
  shareTransfer: {
    list: vi.fn(),
    exec: vi.fn(),
    delete: vi.fn(),
    batchDelete: vi.fn()
  },
  autoSync: {
    listPlans: vi.fn(),
    createPlanAndRun: vi.fn(),
    runPlan: vi.fn(),
    pausePlan: vi.fn(),
    resumePlan: vi.fn(),
    deletePlan: vi.fn(),
    onProgress: vi.fn(),
    removeProgressListener: vi.fn()
  },
  downloadConfig: {
    get: vi.fn(),
    selectDirectory: vi.fn(),
    createDirectory: vi.fn()
  }
}

async function mountShareTransferView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  authStore.setUser({ id: 7, username: 'tester', token: 'token' })

  const wrapper = mount(ShareTransferView, {
    global: {
      plugins: [pinia],
      stubs
    }
  })

  await flushPromises()
  return wrapper
}

function findButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper
    .findAll('button')
    .find((button) => button.text().includes(text))
}

describe('ShareTransferView - 批量删除转存记录', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).electronAPI = mockElectronAPI

    mockElectronAPI.shareTransfer.list.mockResolvedValue({
      success: true,
      records: [
        { id: 11, shareUrl: 'https://pan.baidu.com/s/a?pwd=1111', status: 'completed', createdAt: '2026-05-13T13:19:36.000Z' },
        { id: 12, shareUrl: 'https://pan.baidu.com/s/b?pwd=2222', status: 'failed', createdAt: '2026-04-30T13:20:06.000Z' }
      ],
      total: 2
    })
    mockElectronAPI.shareTransfer.batchDelete.mockResolvedValue({ success: true })
    mockElectronAPI.autoSync.listPlans.mockResolvedValue({ success: true, plans: [] })
    mockElectronAPI.downloadConfig.get.mockResolvedValue({ defaultPath: 'D:\\Downloads' })

    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm')
    vi.spyOn(ElMessage, 'success').mockImplementation(vi.fn() as any)
    vi.spyOn(ElMessage, 'error').mockImplementation(vi.fn() as any)
  })

  it('没有选择记录时显示禁用的批量删除按钮', async () => {
    const wrapper = await mountShareTransferView()

    const batchDeleteButton = findButtonByText(wrapper, '批量删除 (0)')

    expect(batchDeleteButton, '批量删除按钮应该存在').toBeTruthy()
    expect(batchDeleteButton!.attributes('disabled')).toBeDefined()
  })

  it('选中记录后批量删除所选记录并刷新列表', async () => {
    mockElectronAPI.shareTransfer.batchDelete.mockImplementation(async ({ ids }) => {
      if (isProxy(ids)) {
        throw new Error('An object could not be cloned.')
      }
      return { success: true }
    })

    const wrapper = await mountShareTransferView()

    wrapper.findComponent({ name: 'ElTable' }).vm.$emit('selection-change', [
      { id: 11 },
      { id: 12 }
    ])
    await flushPromises()

    const batchDeleteButton = findButtonByText(wrapper, '批量删除 (2)')
    expect(batchDeleteButton, '选中后按钮应该显示数量').toBeTruthy()
    expect(batchDeleteButton!.attributes('disabled')).toBeUndefined()

    await batchDeleteButton!.trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalledWith(
      '确定要删除选中的 2 条记录吗？',
      '确认批量删除',
      expect.objectContaining({ type: 'warning' })
    )
    expect(mockElectronAPI.shareTransfer.batchDelete).toHaveBeenCalledWith({
      ids: [11, 12],
      userId: 7
    })
    expect(ElMessage.success).toHaveBeenCalledWith('批量删除成功')
    expect(mockElectronAPI.shareTransfer.list).toHaveBeenCalledTimes(2)
  })
})
