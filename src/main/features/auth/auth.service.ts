// src/main/features/auth/auth.service.ts

import { eq, desc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getDatabase } from '../../database'
import { users, sessions } from '../../database/schema'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'
import { alistService } from '../../services/AlistService'
import { cryptoService } from '../../services/CryptoService'
import { activityService, ActionType } from '../../services/ActivityService'
import { loggerService } from '../../services/LoggerService'
import { autoSyncService } from '../../services/AutoSyncService'
import { preferencesService } from '../../services/PreferencesService'
import { DEFAULT_QUOTA } from '../../../shared/constants'
import type {
  AuthLoginResult,
  AuthSessionResult,
  LoginParams
} from '../../../shared/types/auth'

// 内存中的当前会话缓存
let currentSession: { userId: number; username: string; token: string } | null = null

export interface LoginPreferences {
  username: string
  password: string
  autoLogin: boolean
}

export interface CurrentUserResult {
  id: number
  username: string
  isAdmin: boolean
  quotaTotal: number
  quotaUsed: number
}

export class AuthService {
  private get db() {
    return drizzle(getDatabase())
  }

  /**
   * 登录：调用 Alist 接口验证，保存会话，记录日志
   */
  async login(params: LoginParams & { autoLogin?: boolean }): Promise<AuthLoginResult> {
    const { username, password, autoLogin = false } = params

    loggerService.info('AuthService', '[login] ========== 开始登录流程 ==========')
    loggerService.info('AuthService', `[login] 用户名: ${username}, 自动登录: ${autoLogin}`)

    try {
      // 1. 调用 Alist 登录接口
      const result = await alistService.login(username, password)
      loggerService.info(
        'AuthService',
        `[login] Alist 登录结果: success=${result.success}, hasToken=${!!result.token}, tokenLength=${result.token?.length || 0}, message=${result.message}`
      )

      if (!result.success || !result.token) {
        loggerService.info('AuthService', '[login] ========== 登录失败 ==========')
        return { success: false, error: result.message || '登录失败' }
      }

      // 2. 获取用户信息
      loggerService.info('AuthService', '[login] ========== 调用 getMe() 获取用户信息 ==========')
      const userInfo = await alistService.getMe()
      loggerService.info(
        'AuthService',
        `[login] 成功获取用户信息: username=${userInfo.username}, basePath=${userInfo.basePath}, id=${userInfo.id}`
      )
      const basePath = userInfo.basePath || '/'

      // 3. 确保本地用户存在
      const userId = await this.ensureUser(username)
      loggerService.info('AuthService', `[login] 本地用户ID: ${userId}`)

      // 4. 保存会话
      this.saveSession(userId, username, result.token, basePath)

      // 5. 记录最近登录用户名（用于登录页面回填）
      preferencesService.setValue('last_login_username', username)

      // 6. 处理自动登录设置
      if (autoLogin) {
        preferencesService.setValue(`auto_login_${username}`, 'true')
        preferencesService.setValue(`auth_password_${username}`, cryptoService.encrypt(password))
      } else {
        preferencesService.setValue(`auto_login_${username}`, 'false')
        preferencesService.deleteValue(`auth_password_${username}`)
      }

      loggerService.info('AuthService', '[login] ========== 登录成功 ==========')

      // 7. 记录登录操作日志
      activityService
        .logActivity({
          userId,
          actionType: ActionType.LOGIN,
          fileCount: 0,
          fileSize: 0,
          details: { username }
        })
        .catch((err) => loggerService.error('AuthService', `记录登录日志失败: ${err}`))

      return {
        success: true,
        data: {
          id: userId,
          username,
          token: result.token,
          isAdmin: userInfo.role?.includes(2) ?? false
        }
      }
    } catch (err: any) {
      loggerService.error('AuthService', `[login] ========== 登录异常: ${err}`)
      throw new IPCError(err.message || '网络错误，请稍后重试', IPCErrorCode.NETWORK)
    }
  }

  /**
   * 获取登录偏好（上次登录用户名、自动登录状态、密码）
   */
  async getLoginPreferences(): Promise<LoginPreferences> {
    const username = preferencesService.getValue('last_login_username')
    if (!username) {
      return { username: '', password: '', autoLogin: false }
    }

    const autoLogin = preferencesService.getValue(`auto_login_${username}`) === 'true'
    let password = ''
    if (autoLogin) {
      const encrypted = preferencesService.getValue(`auth_password_${username}`)
      if (encrypted) {
        try {
          password = cryptoService.decrypt(encrypted)
        } catch (e) {
          loggerService.warn('AuthService', `解密登录密码失败: ${e}`)
        }
      }
    }

    return { username, password, autoLogin }
  }

  /**
   * 登出：清除会话、重置自动同步状态、记录日志
   */
  async logout(): Promise<{ success: boolean }> {
    const userId = currentSession?.userId
    const username = currentSession?.username

    this.clearSession()

    if (userId) {
      autoSyncService.resetStartupExecuted(userId)
    }

    // 记录登出操作日志
    if (userId && username) {
      activityService
        .logActivity({
          userId,
          actionType: ActionType.LOGOUT,
          fileCount: 0,
          fileSize: 0,
          details: { username }
        })
        .catch((err) => loggerService.error('AuthService', `记录登出日志失败: ${err}`))
    }

    return { success: true }
  }

  /**
   * 检查/恢复会话：从数据库恢复，支持自动重新登录
   */
  async checkSession(): Promise<AuthSessionResult> {
    const session = await this.restoreSession()

    if (!session) {
      return { success: true, data: { valid: false } }
    }

    return {
      success: true,
      data: {
        valid: true,
        user: {
          id: session.userId,
          username: session.username,
          token: session.token,
          isAdmin: false // 恢复会话时不重新获取角色信息，需要时调用 getCurrentUser
        }
      }
    }
  }

  /**
   * 获取当前用户详情
   */
  async getCurrentUser(): Promise<{ success: boolean; data?: CurrentUserResult; error?: string }> {
    const session = await this.restoreSession()
    if (!session) {
      return { success: false, error: '用户未登录' }
    }

    const user = this.db
      .select({
        id: users.id,
        username: users.username,
        isAdmin: users.isAdmin,
        quotaTotal: users.quotaTotal,
        quotaUsed: users.quotaUsed
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()

    if (!user) {
      return { success: false, error: '用户不存在' }
    }

    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin ?? false,
        quotaTotal: user.quotaTotal ?? DEFAULT_QUOTA,
        quotaUsed: user.quotaUsed ?? 0
      }
    }
  }

  /**
   * 获取当前会话（供其他服务使用）
   */
  getCurrentSession(): { userId: number; username: string; token: string } | null {
    return currentSession
  }

  // ==================== 私有方法 ====================

  /**
   * 确保用户存在，不存在则创建
   */
  private async ensureUser(username: string): Promise<number> {
    // 使用 INSERT OR IGNORE 避免并发问题
    this.db
      .insert(users)
      .values({
        username,
        passwordHash: '',
        quotaTotal: DEFAULT_QUOTA,
        quotaUsed: 0
      })
      .onConflictDoNothing()
      .run()

    const user = this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .get()

    if (!user) {
      throw new IPCError('创建用户失败', IPCErrorCode.INTERNAL)
    }

    return user.id
  }

  /**
   * 保存会话到数据库和内存
   */
  private saveSession(userId: number, username: string, token: string, basePath: string): void {
    const encryptedToken = cryptoService.encrypt(token)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天

    // 删除旧会话
    this.db.delete(sessions).where(eq(sessions.userId, userId)).run()

    // 插入新会话
    this.db
      .insert(sessions)
      .values({
        userId,
        tokenEncrypted: encryptedToken,
        basePath,
        expiresAt
      })
      .run()

    currentSession = { userId, username, token }

    // 初始化 AlistService
    loggerService.info('AuthService', `Initializing AlistService for user: ${username}, basePath: ${basePath}`)
    alistService.setToken(token)
    alistService.setBasePath(basePath)
    alistService.setUserId(userId)
    loggerService.info('AuthService', 'AlistService initialized')
  }

  /**
   * 从数据库恢复会话
   */
  private async restoreSession(): Promise<{ userId: number; username: string; token: string } | null> {
    if (currentSession) return currentSession

    // 获取最新会话
    const row = this.db
      .select({
        userId: sessions.userId,
        tokenEncrypted: sessions.tokenEncrypted,
        expiresAt: sessions.expiresAt,
        basePath: sessions.basePath,
        username: users.username
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .orderBy(desc(sessions.createdAt))
      .limit(1)
      .get()

    if (!row) return null

    // 检查自动登录偏好
    const autoLogin = preferencesService.getValue(`auto_login_${row.username}`) === 'true'
    if (!autoLogin) {
      loggerService.info('AuthService', `Auto login disabled for user: ${row.username}`)
      return null
    }

    const restoreAlist = (token: string, basePath: string) => {
      loggerService.info(
        'AuthService',
        `Restoring AlistService for user: ${row.username}, basePath: ${basePath}`
      )
      alistService.setToken(token)
      alistService.setBasePath(basePath)
      alistService.setUserId(row.userId)
      loggerService.info('AuthService', 'AlistService restored')
    }

    // 1. 会话未过期？
    if (row.expiresAt && row.expiresAt.getTime() > Date.now()) {
      try {
        const token = cryptoService.decrypt(row.tokenEncrypted)
        currentSession = { userId: row.userId, username: row.username, token }
        restoreAlist(token, row.basePath || '/')
        return currentSession
      } catch (e) {
        loggerService.error('AuthService', `Session decryption failed: ${e}`)
        // 继续尝试自动重新登录
      }
    }

    // 2. 会话过期或无效，尝试用存储的密码自动重新登录
    loggerService.info(
      'AuthService',
      `Session expired or invalid for ${row.username}, attempting auto-login...`
    )
    const encryptedPwd = preferencesService.getValue(`auth_password_${row.username}`)

    if (encryptedPwd) {
      try {
        const password = cryptoService.decrypt(encryptedPwd)
        const result = await alistService.login(row.username, password)

        if (result.success && result.token) {
          loggerService.info('AuthService', `Auto-login successful for ${row.username}`)

          let basePath = '/'
          try {
            const userInfo = await alistService.getMe()
            basePath = userInfo.basePath || '/'
          } catch (e) {
            loggerService.warn(
              'AuthService',
              `Failed to get user info during auto-login, using default path: ${e}`
            )
          }

          this.saveSession(row.userId, row.username, result.token, basePath)
          return currentSession
        } else {
          loggerService.warn('AuthService', `Auto-login failed for ${row.username}: ${result.message}`)
        }
      } catch (e) {
        loggerService.error('AuthService', `Auto-login exception for ${row.username}: ${e}`)
      }
    } else {
      loggerService.info('AuthService', `No stored password for ${row.username}`)
    }

    return null
  }

  /**
   * 清除会话
   */
  private clearSession(): void {
    if (currentSession) {
      this.db.delete(sessions).where(eq(sessions.userId, currentSession.userId)).run()
    }
    currentSession = null

    // 清除 AlistService 配置
    alistService.setToken('')
    alistService.setBasePath('')
  }
}

export const authService = new AuthService()
