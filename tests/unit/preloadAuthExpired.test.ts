import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockContextBridge, mockIpcRenderer } = vi.hoisted(() => ({
  mockContextBridge: {
    exposeInMainWorld: vi.fn()
  },
  mockIpcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  }
}))

vi.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer
}))

async function loadPreloadAPI(): Promise<any> {
  await import('../../src/preload/index')
  return mockContextBridge.exposeInMainWorld.mock.calls[0][1]
}

describe('preload 鉴权失效通知', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('只把 UNAUTHORIZED 作为会话失效事件，FORBIDDEN 由业务层处理', async () => {
    const api = await loadPreloadAPI()
    const handler = vi.fn()
    api.onAuthExpired(handler)

    mockIpcRenderer.invoke.mockResolvedValueOnce({
      success: false,
      error: '权限不足',
      code: 'FORBIDDEN'
    })
    await api.quota.adminUpdate(1, 10)
    await vi.runAllTimersAsync()

    expect(handler).not.toHaveBeenCalled()

    mockIpcRenderer.invoke.mockResolvedValueOnce({
      success: false,
      error: '登录已过期',
      code: 'UNAUTHORIZED'
    })
    await api.file.list('/')
    await vi.runAllTimersAsync()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('UNAUTHORIZED')
  })

  it('捕获异步鉴权失效订阅者的异常，避免未处理 Promise rejection', async () => {
    const api = await loadPreloadAPI()
    const error = new Error('async handler failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    api.onAuthExpired(async () => {
      await Promise.resolve()
      throw error
    })

    mockIpcRenderer.invoke.mockResolvedValueOnce({
      success: false,
      error: '登录已过期',
      code: 'UNAUTHORIZED'
    })
    await api.file.list('/')
    await vi.runAllTimersAsync()

    expect(consoleError).toHaveBeenCalledWith('[preload] onAuthExpired handler error:', error)
  })
})
