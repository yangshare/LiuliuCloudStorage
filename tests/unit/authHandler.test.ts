import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_QUOTA } from '@shared/constants'
import { AuthService } from '../../src/main/features/auth/auth.service'

const {
  mockDb,
  mockInsertValues,
  mockSelectGet,
  mockAlistService,
  mockCryptoService,
  mockPreferencesService,
  mockActivityService,
  mockLoggerService
} = vi.hoisted(() => {
  const mockInsertRun = vi.fn()
  const mockInsertValues = vi.fn(() => ({
    onConflictDoNothing: vi.fn(() => ({ run: mockInsertRun })),
    run: mockInsertRun
  }))
  const mockSelectGet = vi.fn()
  const mockDb = {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockSelectGet
        }))
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: vi.fn()
      }))
    }))
  }

  return {
    mockDb,
    mockInsertValues,
    mockSelectGet,
    mockAlistService: {
      login: vi.fn(),
      getMe: vi.fn(),
      setToken: vi.fn(),
      setBasePath: vi.fn(),
      setUserId: vi.fn()
    },
    mockCryptoService: {
      encrypt: vi.fn((value: string) => `encrypted_${value}`)
    },
    mockPreferencesService: {
      setValue: vi.fn(),
      deleteValue: vi.fn(),
      getValue: vi.fn()
    },
    mockActivityService: {
      logActivity: vi.fn().mockResolvedValue(true)
    },
    mockLoggerService: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  }
})

vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: vi.fn(() => mockDb)
}))

vi.mock('../../src/main/database', () => ({
  getDatabase: vi.fn(() => ({}))
}))

vi.mock('../../src/main/core/api/alist.service', () => ({
  alistService: mockAlistService
}))

vi.mock('../../src/main/core/crypto/crypto.service', () => ({
  cryptoService: mockCryptoService
}))

vi.mock('../../src/main/core/preferences/preferences.service', () => ({
  preferencesService: mockPreferencesService
}))

vi.mock('../../src/main/features/activity/activity.core.service', () => ({
  activityService: mockActivityService,
  ActionType: {
    LOGIN: 'login',
    LOGOUT: 'logout'
  }
}))

vi.mock('../../src/main/core/logger/logger.service', () => ({
  loggerService: mockLoggerService
}))

describe('auth handler - ensureUser function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAlistService.login.mockResolvedValue({ success: true, token: 'token' })
    mockAlistService.getMe.mockResolvedValue({ username: 'testuser', basePath: '/', id: 1, role: [] })
    mockSelectGet.mockReturnValue({ id: 123 })
  })

  it('应该为本地用户设置默认配额（10GB）', async () => {
    const service = new AuthService()

    await service.login({ username: 'newuser', password: 'password' })

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'newuser',
        passwordHash: '',
        quotaTotal: DEFAULT_QUOTA,
        quotaUsed: 0
      })
    )
  })

  it('应该返回已存在用户的ID', async () => {
    const service = new AuthService()
    mockSelectGet.mockReturnValueOnce({ id: 456 })

    const result = await service.login({ username: 'existinguser', password: 'password' })

    expect(result.success).toBe(true)
    expect(result.data?.id).toBe(456)
  })

  it('DEFAULT_QUOTA应该等于10GB', () => {
    const tenGBInBytes = 10 * 1024 * 1024 * 1024
    expect(DEFAULT_QUOTA).toBe(tenGBInBytes)
    expect(DEFAULT_QUOTA).toBe(10737418240)
  })
})
