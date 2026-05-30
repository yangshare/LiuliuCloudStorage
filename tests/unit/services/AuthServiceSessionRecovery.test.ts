import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthService } from '../../../src/main/features/auth/auth.service'

const {
  dbState,
  mockDb,
  mockAlistService,
  mockCryptoService,
  mockPreferencesService,
  mockWebContentsSend
} = vi.hoisted(() => {
  const dbState = {
    user: { id: 7, username: 'alice', isAdmin: false, quotaTotal: 1024, quotaUsed: 0 },
    session: {
      userId: 7,
      tokenEncrypted: 'encrypted_old-token',
      basePath: '/alist/',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date()
    },
    savedSession: null as any
  }

  const selectBuilder = {
    from: vi.fn(() => selectBuilder),
    innerJoin: vi.fn(() => selectBuilder),
    where: vi.fn(() => selectBuilder),
    orderBy: vi.fn(() => selectBuilder),
    limit: vi.fn(() => selectBuilder),
    get: vi.fn(() => ({
      ...dbState.session,
      username: dbState.user.username,
      id: dbState.user.id,
      isAdmin: dbState.user.isAdmin,
      quotaTotal: dbState.user.quotaTotal,
      quotaUsed: dbState.user.quotaUsed
    }))
  }

  const mockDb = {
    select: vi.fn(() => selectBuilder),
    insert: vi.fn(() => ({
      values: vi.fn((value) => {
        dbState.savedSession = value
        return {
          onConflictDoNothing: vi.fn(() => ({ run: vi.fn() })),
          run: vi.fn()
        }
      })
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => ({ run: vi.fn() })) }))
  }

  return {
    dbState,
    mockDb,
    mockAlistService: {
      login: vi.fn(),
      getMe: vi.fn(),
      setToken: vi.fn(),
      setBasePath: vi.fn(),
      setUserId: vi.fn()
    },
    mockCryptoService: {
      encrypt: vi.fn((value: string) => `encrypted_${value}`),
      decrypt: vi.fn((value: string) => value.replace(/^encrypted_/, ''))
    },
    mockPreferencesService: {
      getValue: vi.fn(),
      setValue: vi.fn(),
      deleteValue: vi.fn()
    },
    mockWebContentsSend: vi.fn()
  }
})

vi.mock('drizzle-orm/better-sqlite3', () => ({ drizzle: vi.fn(() => mockDb) }))
vi.mock('../../../src/main/database', () => ({ getDatabase: vi.fn(() => ({})) }))
vi.mock('../../../src/main/core/api/alist.service', () => ({ alistService: mockAlistService }))
vi.mock('../../../src/main/core/crypto/crypto.service', () => ({ cryptoService: mockCryptoService }))
vi.mock('../../../src/main/core/preferences/preferences.service', () => ({ preferencesService: mockPreferencesService }))
vi.mock('../../../src/main/features/activity/activity.core.service', () => ({ activityService: { logActivity: vi.fn() }, ActionType: { LOGIN: 'login', LOGOUT: 'logout' } }))
vi.mock('../../../src/main/features/autoSync/auto-sync.core.service', () => ({ autoSyncService: { resetStartupExecuted: vi.fn() } }))
vi.mock('../../../src/main/core/logger/logger.service', () => ({ loggerService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{ isDestroyed: () => false, webContents: { send: mockWebContentsSend } }])
  }
}))

describe('AuthService.ensureValidSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPreferencesService.getValue.mockImplementation((key: string) => {
      if (key === 'auto_login_alice') return 'true'
      if (key === 'auth_password_alice') return 'encrypted_password'
      return ''
    })
    mockAlistService.getMe.mockResolvedValue({ id: 7, username: 'alice', basePath: '/alist/', role: [], disabled: false, permission: 0 })
  })

  it('本地 session token 在 Alist 仍有效时返回当前 session', async () => {
    const service = new AuthService()

    const session = await service.ensureValidSession()

    expect(session).toMatchObject({ userId: 7, username: 'alice', token: 'old-token', basePath: '/alist/' })
    expect(mockAlistService.login).not.toHaveBeenCalled()
    expect(mockAlistService.setToken).toHaveBeenCalledWith('old-token')
  })

  it('本地 session 未过期但 Alist token 已失效且有凭据时自动刷新 token', async () => {
    mockAlistService.getMe
      .mockRejectedValueOnce({ code: 'ALIST_401', message: 'token is expired' })
      .mockResolvedValueOnce({ id: 7, username: 'alice', basePath: '/alist/', role: [], disabled: false, permission: 0 })
    mockAlistService.login.mockResolvedValue({ success: true, token: 'new-token' })

    const service = new AuthService()
    const session = await service.ensureValidSession({ forceRefresh: true })

    expect(session?.token).toBe('new-token')
    expect(mockAlistService.login).toHaveBeenCalledWith('alice', 'password')
    expect(mockWebContentsSend).not.toHaveBeenCalledWith('auth:session:expired', expect.anything())
  })

  it('Alist token 已失效且没有可用凭据时返回 null 并广播认证失效', async () => {
    mockPreferencesService.getValue.mockImplementation((key: string) => {
      if (key === 'auto_login_alice') return 'false'
      return ''
    })
    mockAlistService.getMe.mockRejectedValue({ code: 'ALIST_401', message: 'token is expired' })

    const service = new AuthService()
    const session = await service.ensureValidSession({ forceRefresh: true })

    expect(session).toBeNull()
    expect(mockWebContentsSend).toHaveBeenCalledWith('auth:session:expired', {
      code: 'UNAUTHORIZED',
      message: 'Alist 登录已过期，请重新登录'
    })
  })
})