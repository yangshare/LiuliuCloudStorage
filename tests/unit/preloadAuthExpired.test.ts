import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockContextBridge, mockIpcRenderer, listeners } = vi.hoisted(() => {
  const listenerMap = new Map<string, Function>()

  const mockContextBridge = {
    exposeInMainWorld: vi.fn()
  }

  const mockIpcRenderer = {
    invoke: vi.fn(),
    on: vi.fn((channel: string, listener: Function) => {
      listenerMap.set(channel, listener)
      return mockIpcRenderer
    }),
    removeListener: vi.fn()
  }

  return { mockContextBridge, mockIpcRenderer, listeners: listenerMap }
})

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
    listeners.clear()
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

  it('主进程 auth:session:expired 事件会触发 onAuthExpired 订阅者', async () => {
    const api = await loadPreloadAPI()
    const handler = vi.fn()
    api.onAuthExpired(handler)

    const expiredListener = listeners.get('auth:session:expired')
    expect(expiredListener).toBeDefined()

    expiredListener!({}, { code: 'UNAUTHORIZED', message: 'Alist 登录已过期，请重新登录' })
    await vi.runAllTimersAsync()

    expect(handler).toHaveBeenCalledWith('UNAUTHORIZED')
  })

  it('auth:session:expired payload 无 code 时默认使用 UNAUTHORIZED', async () => {
    const api = await loadPreloadAPI()
    const handler = vi.fn()
    api.onAuthExpired(handler)

    const expiredListener = listeners.get('auth:session:expired')
    expect(expiredListener).toBeDefined()

    expiredListener!({}, {})
    await vi.runAllTimersAsync()

    expect(handler).toHaveBeenCalledWith('UNAUTHORIZED')
  })
})
