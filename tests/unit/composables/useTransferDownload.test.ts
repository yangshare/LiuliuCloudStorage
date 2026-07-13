import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const notificationSuccess = vi.fn()
const notificationError = vi.fn()
const messageError = vi.fn()
const messageSuccess = vi.fn()

vi.mock('element-plus', () => ({
  ElNotification: {
    success: notificationSuccess,
    error: notificationError
  },
  ElMessage: {
    error: messageError,
    success: messageSuccess
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

vi.mock('@/utils/openFileDirectory', () => ({
  openFileDirectory: vi.fn()
}))

type Listener = (data: any) => void

describe('useTransferDownload 批量下载通知', () => {
  const listeners = new Map<string, Listener>()
  const nativeNotificationShow = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    vi.clearAllMocks()
    listeners.clear()
    localStorage.clear()
    setActivePinia(createPinia())

    ;(window as any).electronAPI = {
      invoke: vi.fn(),
      on: vi.fn((channel: string, callback: Listener) => {
        listeners.set(channel, callback)
      }),
      removeListener: vi.fn(),
      notification: {
        show: nativeNotificationShow
      }
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function setupModule() {
    const { useTransferDownload } = await import('@/features/transfer/composables/useTransferDownload')
    const { useTransferStore } = await import('@/features/transfer/stores/transferStore')
    useTransferDownload()
    const store = useTransferStore()
    return { store }
  }

  function getCompletedListener() {
    const l = listeners.get('transfer:download:completed')
    expect(l).toBeDefined()
    return l!
  }

  function getFailedListener() {
    const l = listeners.get('transfer:download:failed')
    expect(l).toBeDefined()
    return l!
  }

  function getCancelledListener() {
    const l = listeners.get('transfer:download:cancelled')
    expect(l).toBeDefined()
    return l!
  }

  it('同批次 3 个完成 → 仅弹 1 条成功通知', async () => {
    await setupModule()
    const completed = getCompletedListener()

    completed({ taskId: 'd1', fileName: 'a.txt', savePath: 'C:\\a.txt', batchId: 'b1', batchTotal: 3 })
    completed({ taskId: 'd2', fileName: 'b.txt', savePath: 'C:\\b.txt', batchId: 'b1', batchTotal: 3 })
    completed({ taskId: 'd3', fileName: 'c.txt', savePath: 'C:\\c.txt', batchId: 'b1', batchTotal: 3 })

    expect(notificationSuccess).toHaveBeenCalledTimes(1)
    expect(nativeNotificationShow).toHaveBeenCalledWith({
      title: '溜溜网盘',
      body: '3 个文件下载完成'
    })
  })

  it('2 完成 + 1 失败 → 单条合并通知 "2 完成 / 1 失败"', async () => {
    await setupModule()
    const completed = getCompletedListener()
    const failed = getFailedListener()

    completed({ taskId: 'd1', fileName: 'a.txt', savePath: 'C:\\a.txt', batchId: 'b1', batchTotal: 3 })
    completed({ taskId: 'd2', fileName: 'b.txt', savePath: 'C:\\b.txt', batchId: 'b1', batchTotal: 3 })
    failed({ taskId: 'd3', fileName: 'c.txt', error: 'err', batchId: 'b1', batchTotal: 3 })

    expect(notificationSuccess).toHaveBeenCalledTimes(1)
    expect(nativeNotificationShow).toHaveBeenCalledWith({
      title: '溜溜网盘',
      body: '2 个文件下载完成 / 1 个文件下载失败'
    })
  })

  it('2 完成 + 1 取消 → 单条合并通知 "2 完成 / 1 已取消"', async () => {
    await setupModule()
    const completed = getCompletedListener()
    const cancelled = getCancelledListener()

    completed({ taskId: 'd1', fileName: 'a.txt', savePath: 'C:\\a.txt', batchId: 'b1', batchTotal: 3 })
    completed({ taskId: 'd2', fileName: 'b.txt', savePath: 'C:\\b.txt', batchId: 'b1', batchTotal: 3 })
    cancelled({ taskId: 'd3', fileName: 'c.txt', batchId: 'b1', batchTotal: 3 })

    expect(notificationSuccess).toHaveBeenCalledTimes(1)
    expect(nativeNotificationShow).toHaveBeenCalledWith({
      title: '溜溜网盘',
      body: '2 个文件下载完成 / 1 个已取消'
    })
  })

  it('单文件下载（无 batchId）→ 走 legacy 3s 防抖，3s 后弹通知', async () => {
    await setupModule()
    const completed = getCompletedListener()

    completed({ taskId: 'd_single', fileName: 'single.txt', savePath: 'C:\\single.txt' })

    // 3s 内不弹
    vi.advanceTimersByTime(2000)
    expect(notificationSuccess).not.toHaveBeenCalled()

    // 3s 后弹
    vi.advanceTimersByTime(2000)
    expect(notificationSuccess).toHaveBeenCalledTimes(1)
  })

  it('同 taskId 收到两次 completed → 批次 settled 只计 1', async () => {
    await setupModule()
    const completed = getCompletedListener()

    completed({ taskId: 'd_dup', fileName: 'dup.txt', savePath: 'C:\\dup.txt', batchId: 'b1', batchTotal: 2 })
    completed({ taskId: 'd_dup', fileName: 'dup.txt', savePath: 'C:\\dup.txt', batchId: 'b1', batchTotal: 2 })
    completed({ taskId: 'd2', fileName: 'b.txt', savePath: 'C:\\b.txt', batchId: 'b1', batchTotal: 2 })

    expect(notificationSuccess).toHaveBeenCalledTimes(1)
    expect(nativeNotificationShow).toHaveBeenCalledWith({
      title: '溜溜网盘',
      body: '2 个文件下载完成'
    })
  })

  it('批次完成后迟到 completed → 不重生 Map 条目（_settledBatchIds 防护）', async () => {
    await setupModule()
    const completed = getCompletedListener()

    // 完成批次
    completed({ taskId: 'd1', fileName: 'a.txt', savePath: 'C:\\a.txt', batchId: 'b_late', batchTotal: 1 })
    expect(notificationSuccess).toHaveBeenCalledTimes(1)

    // 清空 mock 以便验证没有新通知
    notificationSuccess.mockClear()
    nativeNotificationShow.mockClear()

    // 迟到事件
    completed({ taskId: 'd2', fileName: 'b.txt', savePath: 'C:\\b.txt', batchId: 'b_late', batchTotal: 1 })

    // 不应再弹通知
    expect(notificationSuccess).not.toHaveBeenCalled()
  })

  it('批次永远收不全 → 30s 后兜底 flush', async () => {
    await setupModule()
    const completed = getCompletedListener()

    completed({ taskId: 'd1', fileName: 'a.txt', savePath: 'C:\\a.txt', batchId: 'b_timeout', batchTotal: 3 })

    // 30s 内不弹
    vi.advanceTimersByTime(29000)
    expect(notificationSuccess).not.toHaveBeenCalled()

    // 30s 后兜底 flush
    vi.advanceTimersByTime(2000)
    expect(notificationSuccess).toHaveBeenCalledTimes(1)
    expect(nativeNotificationShow).toHaveBeenCalledWith({
      title: '溜溜网盘',
      body: '1 个文件下载完成'
    })
  })

  it('失败事件不带 batchId → 走 legacy 1.5s 失败防抖', async () => {
    await setupModule()
    const failed = getFailedListener()

    failed({ taskId: 'd_fail', fileName: 'fail.txt', error: 'network error' })

    // 1.5s 内不弹
    vi.advanceTimersByTime(1000)
    expect(notificationError).not.toHaveBeenCalled()

    // 1.5s 后弹
    vi.advanceTimersByTime(1000)
    expect(notificationError).toHaveBeenCalledTimes(1)
  })

  it('批次全部失败 → 弹出失败通知而非成功通知', async () => {
    await setupModule()
    const failed = getFailedListener()

    failed({ taskId: 'd1', fileName: 'a.txt', error: 'err', batchId: 'b_all_fail', batchTotal: 2 })
    failed({ taskId: 'd2', fileName: 'b.txt', error: 'err', batchId: 'b_all_fail', batchTotal: 2 })

    expect(notificationError).toHaveBeenCalledTimes(1)
    expect(notificationSuccess).not.toHaveBeenCalled()
  })

  it('认证失败只显示 Alist 认证失效通知，不追加普通下载失败通知', async () => {
    await setupModule()

    function getAuthFailedListener() {
      const l = listeners.get('transfer:download:auth-failed')
      expect(l).toBeDefined()
      return l!
    }

    const authFailed = getAuthFailedListener()
    const failed = getFailedListener()

    authFailed({ error: 'Alist 登录已过期，请重新登录后恢复下载' })
    failed({ taskId: 'd_auth', fileName: 'auth.zip', error: 'Alist 登录已过期' })

    vi.advanceTimersByTime(2000)

    expect(notificationError).toHaveBeenCalledTimes(1)
    expect(notificationError).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Alist 认证失效',
      message: 'Alist 登录已过期，请重新登录后恢复下载',
      duration: 0
    }))
  })
})
