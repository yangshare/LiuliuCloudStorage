import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

// Mock electron
const { mockIpcMain, mockNet } = vi.hoisted(() => {
  return {
    mockIpcMain: {
      handle: vi.fn(),
      invoke: vi.fn()
    },
    mockNet: {
      request: vi.fn()
    }
  }
})

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  net: mockNet,
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
    setPath: vi.fn(),
    commandLine: { appendSwitch: vi.fn() }
  }
}))

// Mock database
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    prepare: vi.fn()
  }
}))
// 使用相对路径避免 alias 问题
vi.mock('../../src/main/database', () => ({
  getDatabase: () => mockDb
}))

// Mock services
const { mockCryptoService, mockAlistService, mockPreferencesService, mockLoggerService, mockActivityService } = vi.hoisted(() => ({
  mockCryptoService: {
    encrypt: vi.fn(s => `encrypted_${s}`),
    decrypt: vi.fn(s => s.replace('encrypted_', '')),
    initialize: vi.fn()
  },
  mockAlistService: {
    setToken: vi.fn(),
    setBasePath: vi.fn(),
    setUserId: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
    initialize: vi.fn()
  },
  mockPreferencesService: {
    getValue: vi.fn(),
    setValue: vi.fn(),
    deleteValue: vi.fn()
  },
  mockLoggerService: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  mockActivityService: {
    logActivity: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('../../src/main/services/CryptoService', () => ({
  cryptoService: mockCryptoService
}))

vi.mock('../../src/main/services/AlistService', () => ({
  alistService: mockAlistService
}))

vi.mock('../../src/main/services/PreferencesService', () => ({
  preferencesService: mockPreferencesService
}))

vi.mock('../../src/main/services/LoggerService', () => ({
  loggerService: mockLoggerService
}))

vi.mock('../../src/main/services/ActivityService', () => ({
  activityService: mockActivityService,
  ActionType: { LOGIN: 'login', LOGOUT: 'logout' }
}))

// Import the module under test
import { registerAuthHandlers } from '../../src/main/ipc/handlers/auth'

describe('Auto Login Feature', () => {
  let handlers: Record<string, Function> = {}

  beforeEach(async () => {
    vi.resetAllMocks()
    handlers = {}
    
    // Restore basic implementations
    mockIpcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler
    })
    mockDb.prepare.mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    })
    mockCryptoService.encrypt.mockImplementation(s => `encrypted_${s}`)
    mockCryptoService.decrypt.mockImplementation(s => s.replace('encrypted_', ''))
    mockActivityService.logActivity.mockResolvedValue(true)
    
    // Register handlers
    registerAuthHandlers()
    
    // Ensure session is cleared
    if (handlers['auth:logout']) {
      await handlers['auth:logout']()
    }
  })

  describe('auth:check-session (restoreSession)', () => {
    it('应该在未启用自动登录时返回无效会话', async () => {
      // Arrange
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue({
          user_id: 1,
          token_encrypted: 'encrypted_token',
          expires_at: Date.now() + 10000,
          username: 'testuser',
          base_path: '/'
        })
      })
      mockPreferencesService.getValue.mockReturnValue('false') // auto_login disabled

      // Act
      const result = await handlers['auth:check-session']()

      // Assert
      expect(result).toEqual({ valid: false })
      expect(mockLoggerService.info).toHaveBeenCalledWith('AuthHandler', expect.stringContaining('Auto login disabled'))
    })

    it('应该在启用自动登录且Token有效时恢复会话', async () => {
      // Arrange
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue({
          user_id: 1,
          token_encrypted: 'encrypted_token',
          expires_at: Date.now() + 10000, // Valid
          username: 'testuser',
          base_path: '/'
        })
      })
      mockPreferencesService.getValue.mockReturnValue('true') // auto_login enabled

      // Mock user query for onboarding status
      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('SELECT onboarding_completed')) {
          return { get: vi.fn().mockReturnValue({ onboarding_completed: 1 }) }
        }
        // Default for session query
        return {
           get: vi.fn().mockReturnValue({
            user_id: 1,
            token_encrypted: 'encrypted_token',
            expires_at: Date.now() + 10000,
            username: 'testuser',
            base_path: '/'
          })
        }
      })

      // Act
      const result = await handlers['auth:check-session']()

      // Assert
      expect(result).toEqual({ 
        valid: true, 
        username: 'testuser', 
        onboardingCompleted: true 
      })
      expect(mockAlistService.setToken).toHaveBeenCalledWith('token')
    })

    it('应该在启用自动登录且Token过期时自动重新登录', async () => {
      // Arrange
      // 1. Session expired
      const sessionQueryMock = {
        get: vi.fn().mockReturnValue({
          user_id: 1,
          token_encrypted: 'encrypted_oldtoken',
          expires_at: Date.now() - 10000, // Expired
          username: 'testuser',
          base_path: '/'
        })
      }
      
      // 2. Mock DB calls
      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('SELECT s.user_id')) return sessionQueryMock
        if (sql.includes('DELETE FROM sessions')) return { run: vi.fn() }
        if (sql.includes('INSERT INTO sessions')) return { run: vi.fn() }
        if (sql.includes('SELECT onboarding_completed')) return { get: vi.fn().mockReturnValue({ onboarding_completed: 1 }) }
        return { get: vi.fn(), run: vi.fn() }
      })

      // 3. Mock Preferences
      mockPreferencesService.getValue.mockImplementation((key) => {
        if (key === 'auto_login_testuser') return 'true'
        if (key === 'auth_password_testuser') return 'encrypted_password'
        return null
      })

      // 4. Mock Alist Login
      mockAlistService.login.mockResolvedValue({
        success: true,
        token: 'new_token'
      })
      mockAlistService.getMe.mockResolvedValue({
        username: 'testuser',
        basePath: '/new',
        id: 1
      })

      // Act
      const result = await handlers['auth:check-session']()

      // Debug: Check if logger was called
      // console.log('Logger calls:', mockLoggerService.info.mock.calls)

      // Assert
      expect(result).toEqual({ 
        valid: true, 
        username: 'testuser', 
        onboardingCompleted: true 
      })
      
      // Verify decrypt was called
      expect(mockCryptoService.decrypt).toHaveBeenCalledWith('encrypted_password')
      
      expect(mockAlistService.login).toHaveBeenCalledWith('testuser', 'password')
      expect(mockAlistService.setToken).toHaveBeenCalledWith('new_token')
      expect(mockLoggerService.info).toHaveBeenCalledWith('AuthHandler', expect.stringContaining('Auto-login successful'))
    })
  })

  describe('auth:login', () => {
    it('应该在登录成功且勾选自动登录时保存偏好', async () => {
      // Arrange
      mockAlistService.login.mockResolvedValue({ success: true, token: 'token' })
      mockAlistService.getMe.mockResolvedValue({ username: 'testuser', basePath: '/', id: 1 })
      
      // Mock ensureUser
      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('INSERT OR IGNORE INTO users')) return { run: vi.fn() }
        if (sql.includes('SELECT id FROM users')) return { get: vi.fn().mockReturnValue({ id: 1 }) }
        if (sql.includes('DELETE FROM sessions')) return { run: vi.fn() }
        if (sql.includes('INSERT INTO sessions')) return { run: vi.fn() }
        return { get: vi.fn(), run: vi.fn() }
      })

      // Act
      await handlers['auth:login']({}, 'testuser', 'password', true) // autoLogin = true

      // Assert
      expect(mockPreferencesService.setValue).toHaveBeenCalledWith('auto_login_testuser', 'true')
      expect(mockPreferencesService.setValue).toHaveBeenCalledWith('auth_password_testuser', 'encrypted_password')
    })

    it('应该在未勾选自动登录时清除偏好', async () => {
      // Arrange
      mockAlistService.login.mockResolvedValue({ success: true, token: 'token' })
      mockAlistService.getMe.mockResolvedValue({ username: 'testuser', basePath: '/', id: 1 })
      
      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('INSERT OR IGNORE INTO users')) return { run: vi.fn() }
        if (sql.includes('SELECT id FROM users')) return { get: vi.fn().mockReturnValue({ id: 1 }) }
        if (sql.includes('DELETE FROM sessions')) return { run: vi.fn() }
        if (sql.includes('INSERT INTO sessions')) return { run: vi.fn() }
        return { get: vi.fn(), run: vi.fn() }
      })

      // Act
      await handlers['auth:login']({}, 'testuser', 'password', false) // autoLogin = false

      // Assert
      expect(mockPreferencesService.setValue).toHaveBeenCalledWith('auto_login_testuser', 'false')
      expect(mockPreferencesService.deleteValue).toHaveBeenCalledWith('auth_password_testuser')
    })
  })
})
