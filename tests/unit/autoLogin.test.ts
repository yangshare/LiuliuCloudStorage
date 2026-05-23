import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIpcMain, mockAuthService } = vi.hoisted(() => ({
  mockIpcMain: {
    handle: vi.fn()
  },
  mockAuthService: {
    login: vi.fn(),
    logout: vi.fn(),
    checkSession: vi.fn(),
    getCurrentUser: vi.fn(),
    getLoginPreferences: vi.fn()
  }
}))

vi.mock('electron', () => ({
  ipcMain: mockIpcMain
}))

vi.mock('../../src/main/core/logger/logger.service', () => ({
  loggerService: {
    error: vi.fn()
  }
}))

vi.mock('../../src/main/features/auth/auth.service', () => ({
  authService: mockAuthService
}))

import { registerAuthHandlers } from '../../src/main/features/auth/auth.handlers'

describe('Auto Login Feature', () => {
  let handlers: Record<string, Function>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    mockIpcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler
    })
    registerAuthHandlers()
  })

  it('应该注册重构后的认证 IPC channels', () => {
    expect(handlers['auth:session:login']).toBeDefined()
    expect(handlers['auth:session:logout']).toBeDefined()
    expect(handlers['auth:session:check']).toBeDefined()
    expect(handlers['auth:user:current']).toBeDefined()
    expect(handlers['auth:preference:login']).toBeDefined()
  })

  it('登录时应该把 autoLogin 选项传给 AuthService', async () => {
    mockAuthService.login.mockResolvedValueOnce({
      success: true,
      data: {
        id: 1,
        username: 'testuser',
        token: 'token',
        isAdmin: false
      }
    })

    const result = await handlers['auth:session:login']({}, 'testuser', 'password', true)

    expect(mockAuthService.login).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password',
      autoLogin: true
    })
    expect(result).toEqual({
      success: true,
      data: {
        id: 1,
        username: 'testuser',
        token: 'token',
        isAdmin: false
      }
    })
  })

  it('检查会话时应该返回 AuthService 的自动登录恢复结果', async () => {
    mockAuthService.checkSession.mockResolvedValueOnce({
      success: true,
      data: {
        valid: true,
        user: {
          id: 1,
          username: 'testuser',
          token: 'restored-token',
          isAdmin: false
        }
      }
    })

    const result = await handlers['auth:session:check']()

    expect(mockAuthService.checkSession).toHaveBeenCalled()
    expect(result).toEqual({
      success: true,
      data: {
        valid: true,
        user: {
          id: 1,
          username: 'testuser',
          token: 'restored-token',
          isAdmin: false
        }
      }
    })
  })

  it('登出时应该委托 AuthService 清理会话', async () => {
    mockAuthService.logout.mockResolvedValueOnce({ success: true })

    const result = await handlers['auth:session:logout']()

    expect(mockAuthService.logout).toHaveBeenCalled()
    expect(result).toEqual({ success: true, data: { success: true } })
  })
})
