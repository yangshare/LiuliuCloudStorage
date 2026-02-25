import { ipcMain, net } from 'electron'
import { getDatabase } from '../../database'
import { cryptoService } from '../../services/CryptoService'
import { alistService } from '../../services/AlistService'
import { activityService, ActionType } from '../../services/ActivityService'
import { loggerService } from '../../services/LoggerService'
import { preferencesService } from '../../services/PreferencesService'
import { DEFAULT_QUOTA } from '../../../shared/constants'
import { loadConfig } from '../../config'

let currentSession: { userId: number; username: string; token: string } | null = null

// 缓存 N8N Webhook URL，避免重复计算
let cachedN8nWebhookUrl: string | null = null

function getN8nWebhookUrl(): string {
  if (!cachedN8nWebhookUrl) {
    const config = loadConfig()
    cachedN8nWebhookUrl = `${config.n8nBaseUrl}/webhook/liuliu`
  }
  return cachedN8nWebhookUrl
}

async function callWebhook(endpoint: string, data: object): Promise<any> {
  return new Promise((resolve) => {
    const N8N_WEBHOOK_URL = getN8nWebhookUrl()
    const url = `${N8N_WEBHOOK_URL}/${endpoint}`
    const postData = JSON.stringify(data)

    try {
      const request = net.request({ method: 'POST', url })
      request.setHeader('Content-Type', 'application/json')

      let responseData = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { responseData += chunk.toString() })
        response.on('end', () => {
          try {
            resolve(JSON.parse(responseData))
          } catch {
            resolve({ success: false, message: '服务器响应格式错误' })
          }
        })
        response.on('error', () => {
          resolve({ success: false, message: '网络连接中断' })
        })
      })
      request.on('error', (err) => {
        loggerService.error('AuthHandler', `Webhook request error: ${err.message}`)
        resolve({ success: false, message: '无法连接到服务器，请检查网络' })
      })
      request.write(postData)
      request.end()
    } catch (err) {
      loggerService.error('AuthHandler', `Webhook error: ${err}`)
      resolve({ success: false, message: '请求发送失败' })
    }
  })
}

function saveSession(userId: number, username: string, token: string, basePath: string): void {
  const db = getDatabase()
  const encryptedToken = cryptoService.encrypt(token)
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  db.prepare('INSERT INTO sessions (user_id, token_encrypted, expires_at, created_at, base_path) VALUES (?, ?, ?, ?, ?)')
    .run(userId, encryptedToken, expiresAt, Date.now(), basePath)

  currentSession = { userId, username, token }

  // 初始化 AlistService
  loggerService.info('AuthHandler', `Initializing AlistService for user: ${username}, basePath: ${basePath}`)
  alistService.setToken(token)
  alistService.setBasePath(basePath)
  alistService.setUserId(userId)
  loggerService.info('AuthHandler', 'AlistService initialized')
}

async function restoreSession(): Promise<{ userId: number; username: string; token: string } | null> {
  if (currentSession) return currentSession

  const db = getDatabase()
  // Story: Auto Login - Get the latest session regardless of expiry
  const row = db.prepare(`
    SELECT s.user_id, s.token_encrypted, s.expires_at, s.base_path, u.username
    FROM sessions s JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC LIMIT 1
  `).get() as { user_id: number; token_encrypted: string; expires_at: number; username: string; base_path: string } | undefined

  if (!row) return null

  // Check auto-login preference
  const autoLogin = preferencesService.getValue(`auto_login_${row.username}`) === 'true'
  if (!autoLogin) {
    loggerService.info('AuthHandler', `Auto login disabled for user: ${row.username}`)
    return null
  }

  // Helper to restore alist service
  const restoreAlist = (token: string, basePath: string) => {
    loggerService.info('AuthHandler', `Restoring AlistService for user: ${row.username}, basePath: ${basePath}`)
    alistService.setToken(token)
    alistService.setBasePath(basePath)
    alistService.setUserId(row.user_id)
    loggerService.info('AuthHandler', 'AlistService restored')
  }

  // 1. Session valid?
  if (row.expires_at > Date.now()) {
    try {
      const token = cryptoService.decrypt(row.token_encrypted)
      currentSession = { userId: row.user_id, username: row.username, token }
      restoreAlist(token, row.base_path || '/')
      return currentSession
    } catch (e) {
      loggerService.error('AuthHandler', `Session decryption failed: ${e}`)
      // Fall through to try password login
    }
  }

  // 2. Session expired or invalid, try to re-login with stored credentials
  loggerService.info('AuthHandler', `Session expired or invalid for ${row.username}, attempting auto-login...`)
  const encryptedPwd = preferencesService.getValue(`auth_password_${row.username}`)
  
  if (encryptedPwd) {
    try {
      const password = cryptoService.decrypt(encryptedPwd)
      const result = await alistService.login(row.username, password)
      
      if (result.success && result.token) {
        loggerService.info('AuthHandler', `Auto-login successful for ${row.username}`)
        
        // Get user info to get base path
        let basePath = '/'
        try {
           const userInfo = await alistService.getMe()
           basePath = userInfo.basePath || '/'
        } catch (e) {
           loggerService.warn('AuthHandler', `Failed to get user info during auto-login, using default path: ${e}`)
        }

        saveSession(row.user_id, row.username, result.token, basePath)
        return currentSession
      } else {
        loggerService.warn('AuthHandler', `Auto-login failed for ${row.username}: ${result.message}`)
      }
    } catch (e) {
      loggerService.error('AuthHandler', `Auto-login exception for ${row.username}: ${e}`)
    }
  } else {
    loggerService.info('AuthHandler', `No stored password for ${row.username}`)
  }

  return null
}

function clearSession(): void {
  if (currentSession) {
    const db = getDatabase()
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(currentSession.userId)
  }
  currentSession = null

  // 清除 AlistService 配置
  alistService.setToken('')
  alistService.setBasePath('')
}

// 导出获取当前会话的函数，供其他handlers使用
export function getCurrentSession(): { userId: number; username: string; token: string } | null {
  return currentSession
}

/**
 * 确保用户存在，如果不存在则创建 (Story 6.3 - CRITICAL FIX: 添加并发保护)
 *
 * 使用 INSERT OR IGNORE 避免并发情况下的重复用户创建
 */
function ensureUser(username: string): number {
  const db = getDatabase()

  // Story 6.3: 为新用户分配默认配额
  // 使用 INSERT OR IGNORE 避免并发问题
  db.prepare(`
    INSERT OR IGNORE INTO users
    (username, password_hash, quota_total, quota_used, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username, '', DEFAULT_QUOTA, 0, Date.now(), Date.now())

  // 查询用户ID（无论是刚创建的还是已存在的）
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined

  if (!user) {
    throw new Error('创建用户失败')
  }

  return user.id
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, username: string, password: string, autoLogin: boolean = false) => {
    try {
      loggerService.info('AuthHandler', '[login] ========== 开始登录流程 ==========')
      loggerService.info('AuthHandler', `[login] 用户名: ${username}, 自动登录: ${autoLogin}`)

      // 直接调用 Alist 登录接口
      const result = await alistService.login(username, password)
      loggerService.info('AuthHandler', `[login] Alist 登录结果: success=${result.success}, hasToken=${!!result.token}, tokenLength=${result.token?.length || 0}, message=${result.message}`)

      if (result.success && result.token) {
        try {
          loggerService.info('AuthHandler', '[login] ========== 调用 getMe() 获取用户信息 ==========')
          const userInfo = await alistService.getMe()
          loggerService.info('AuthHandler', `[login] 成功获取用户信息: username=${userInfo.username}, basePath=${userInfo.basePath}, id=${userInfo.id}`)
          const basePath = userInfo.basePath || '/'
          const userId = ensureUser(username)
          loggerService.info('AuthHandler', `[login] 本地用户ID: ${userId}`)
          saveSession(userId, username, result.token, basePath)
          
          // 记录最近登录用户名（用于登录页面回填）
          preferencesService.setValue('last_login_username', username)

          // 处理自动登录设置
          if (autoLogin) {
            preferencesService.setValue(`auto_login_${username}`, 'true')
            preferencesService.setValue(`auth_password_${username}`, cryptoService.encrypt(password))
          } else {
            preferencesService.setValue(`auto_login_${username}`, 'false')
            preferencesService.deleteValue(`auth_password_${username}`)
          }

          loggerService.info('AuthHandler', '[login] ========== 登录成功 ==========')

          // Story 9.2 CRITICAL FIX: 记录登录操作日志
          activityService.logActivity({
            userId,
            actionType: ActionType.LOGIN,
            fileCount: 0,
            fileSize: 0,
            details: { username }
          }).catch(err => loggerService.error('AuthHandler', `记录登录日志失败: ${err}`))

          return { success: true }
        } catch (err: any) {
          loggerService.error('AuthHandler', `[login] ========== 获取用户信息失败: code=${err.code}, message=${err.message}`)
          return { success: false, message: err.message || '获取用户信息失败' }
        }
      }

      loggerService.info('AuthHandler', '[login] ========== 登录失败 ==========')
      return result
    } catch (err) {
      loggerService.error('AuthHandler', `[login] ========== 登录异常: ${err}`)
      return { success: false, message: '网络错误，请稍后重试' }
    }
  })

  // 获取上次登录的用户名、自动登录状态和密码（用于登录页面回填）
  ipcMain.handle('auth:get-login-preferences', async () => {
    const username = preferencesService.getValue('last_login_username')
    if (!username) return { username: '', password: '', autoLogin: false }

    const autoLogin = preferencesService.getValue(`auto_login_${username}`) === 'true'
    let password = ''
    if (autoLogin) {
      const encrypted = preferencesService.getValue(`auth_password_${username}`)
      if (encrypted) {
        try { password = cryptoService.decrypt(encrypted) } catch (e) {
          loggerService.warn('AuthHandler', `解密登录密码失败: ${e}`)
        }
      }
    }
    return { username, password, autoLogin }
  })

  ipcMain.handle('auth:logout', async () => {
    const userId = currentSession?.userId
    const username = currentSession?.username

    clearSession()

    // Story 9.2 CRITICAL FIX: 记录登出操作日志
    if (userId && username) {
      activityService.logActivity({
        userId,
        actionType: ActionType.LOGOUT,
        fileCount: 0,
        fileSize: 0,
        details: { username }
      }).catch(err => loggerService.error('AuthHandler', `记录登出日志失败: ${err}`))
    }

    return { success: true }
  })

  ipcMain.handle('auth:check-session', async () => {
    const session = await restoreSession()
    if (!session) return { valid: false }

    return {
      valid: true,
      username: session.username
    }
  })

  /**
   * 获取当前用户信息
   */
  ipcMain.handle('auth:get-current-user', async () => {
    try {
      const session = await restoreSession()
      if (!session) {
        return { success: false, message: '用户未登录' }
      }

      const db = getDatabase()
      const user = db.prepare(`
        SELECT id, username, is_admin as isAdmin, quota_total as quotaTotal, quota_used as quotaUsed
        FROM users WHERE id = ?
      `).get(session.userId) as {
        id: number
        username: string
        isAdmin: number
        quotaTotal: number
        quotaUsed: number
      } | undefined

      if (!user) {
        return { success: false, message: '用户不存在' }
      }

      return {
        success: true,
        data: {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin === 1,
          quotaTotal: user.quotaTotal,
          quotaUsed: user.quotaUsed
        }
      }
    } catch (error: any) {
      loggerService.error('AuthHandler', `获取当前用户信息失败: ${error.message || error}`)
      return { success: false, message: error.message || '获取用户信息失败' }
    }
  })

  /**
   * 获取所有用户列表（管理员功能）
   * 支持分页和搜索
   */
  ipcMain.handle('auth:get-users', async (_event, params: { page?: number; pageSize?: number; search?: string } = {}) => {
    try {
      const session = await restoreSession()

      if (!session) {
        throw new Error('用户未登录')
      }

      const db = getDatabase()

      // 检查当前用户是否为管理员
      const adminUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(session.userId) as { is_admin: number } | undefined

      if (!adminUser || adminUser.is_admin !== 1) {
        throw new Error('权限不足：仅管理员可以查看用户列表')
      }

      // 解析参数
      const page = params.page || 1
      const pageSize = params.pageSize || 20
      const search = params.search || ''

      // 构建查询条件
      let whereClause = ''
      let queryParams: any[] = []

      if (search) {
        whereClause = 'WHERE username LIKE ?'
        queryParams.push(`%${search}%`)
      }

      // 获取总数
      const countResult = db.prepare(`SELECT COUNT(*) as total FROM users ${whereClause}`)
        .get(...queryParams) as { total: number }

      // 获取分页数据
      const offset = (page - 1) * pageSize
      const users = db.prepare(`
        SELECT
          id,
          username,
          quota_total as quotaTotal,
          quota_used as quotaUsed,
          is_admin as isAdmin,
          created_at as createdAt
        FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(...queryParams, pageSize, offset) as Array<{
        id: number
        username: string
        quotaTotal: number
        quotaUsed: number
        isAdmin: number
        createdAt: number
      }>

      return {
        success: true,
        data: {
          list: users,
          total: countResult.total,
          page,
          pageSize
        }
      }
    } catch (error: any) {
      loggerService.error('AuthHandler', `获取用户列表失败: ${error.message || error}`)
      throw new Error(error.message || '获取用户列表失败')
    }
  })

  /**
   * 获取存储统计信息（管理员功能）
   * Story 7.4 CRITICAL FIX: 通过 n8n Webhook 获取存储统计 (Dual-Flow Architecture)
   */
  ipcMain.handle('auth:get-storage-stats', async () => {
    try {
      const session = await restoreSession()

      if (!session) {
        throw new Error('用户未登录')
      }

      const db = getDatabase()

      // 检查当前用户是否为管理员
      const adminUser = db.prepare('SELECT is_admin, username FROM users WHERE id = ?').get(session.userId) as { is_admin: number; username: string } | undefined

      if (!adminUser || adminUser.is_admin !== 1) {
        throw new Error('权限不足：仅管理员可以查看存储统计')
      }

      // Story 7.4 CRITICAL FIX: 调用 n8n Webhook 获取存储统计 (Dual-Flow Architecture)
      try {
        const webhookResult = await callWebhook('admin/storage/stats', {
          adminUserId: session.userId,
          adminUsername: adminUser.username,
          timestamp: Date.now()
        })

        if (webhookResult.success && webhookResult.data) {
          loggerService.info('AuthHandler', '使用 n8n Webhook 获取存储统计')
          return webhookResult
        }
      } catch (n8nError) {
        loggerService.warn('AuthHandler', `n8n Webhook 调用失败，降级到本地查询: ${n8nError}`)
      }

      // 降级方案: 直接查询数据库
      const users = db.prepare(`
        SELECT
          id,
          username,
          quota_total as quotaTotal,
          quota_used as quotaUsed
        FROM users
        ORDER BY quota_used DESC
      `).all() as Array<{
        id: number
        username: string
        quotaTotal: number
        quotaUsed: number
      }>

      // 计算总量
      const totalQuota = users.reduce((sum, user) => sum + user.quotaTotal, 0)
      const totalUsed = users.reduce((sum, user) => sum + user.quotaUsed, 0)
      const remaining = totalQuota - totalUsed
      const usageRate = totalQuota > 0 ? (totalUsed / totalQuota) * 100 : 0

      return {
        success: true,
        data: {
          totalQuota,
          totalUsed,
          remaining,
          usageRate,
          userCount: users.length,
          topUsers: users.slice(0, 10) // Top 10 users by quota used
        }
      }
    } catch (error: any) {
      loggerService.error('AuthHandler', `获取存储统计失败: ${error.message || error}`)
      throw new Error(error.message || '获取存储统计失败')
    }
  })
}
