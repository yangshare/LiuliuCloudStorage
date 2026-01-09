import { ipcMain, net } from 'electron'
import { getDatabase } from '../../database'
import { cryptoService } from '../../services/CryptoService'
import { alistService } from '../../services/AlistService'

const N8N_WEBHOOK_URL = 'http://10.2.3.7:5678/webhook/liuliu'

let currentSession: { userId: number; username: string; token: string } | null = null

async function callWebhook(endpoint: string, data: object): Promise<any> {
  return new Promise((resolve) => {
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
        console.error('Webhook request error:', err.message)
        resolve({ success: false, message: '无法连接到服务器，请检查网络' })
      })
      request.write(postData)
      request.end()
    } catch (err) {
      console.error('Webhook error:', err)
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
  console.log('[auth] Initializing AlistService for user:', username, 'basePath:', basePath)
  alistService.setToken(token)
  alistService.setBasePath(basePath)
  alistService.setUserId(userId)
  console.log('[auth] AlistService initialized')
}

function getStoredSession(): { userId: number; username: string; token: string } | null {
  if (currentSession) return currentSession

  const db = getDatabase()
  const row = db.prepare(`
    SELECT s.user_id, s.token_encrypted, s.expires_at, s.base_path, u.username
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.expires_at > ? ORDER BY s.created_at DESC LIMIT 1
  `).get(Date.now()) as { user_id: number; token_encrypted: string; username: string; base_path: string } | undefined

  if (!row) return null

  try {
    const token = cryptoService.decrypt(row.token_encrypted)
    currentSession = { userId: row.user_id, username: row.username, token }

    // 恢复 AlistService 配置
    const basePath = row.base_path || '/'
    console.log('[auth] Restoring AlistService for user:', row.username, 'basePath:', basePath)
    alistService.setToken(token)
    alistService.setBasePath(basePath)
    alistService.setUserId(row.user_id)
    console.log('[auth] AlistService restored')

    return currentSession
  } catch {
    return null
  }
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

function ensureUser(username: string): number {
  const db = getDatabase()
  let user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined
  if (!user) {
    const result = db.prepare('INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(username, '', Date.now(), Date.now())
    return result.lastInsertRowid as number
  }
  return user.id
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    try {
      const result = await callWebhook('login', { username, password })
      if (result.success && result.token) {
        // 设置 token 后获取用户信息
        alistService.setToken(result.token)
        try {
          const userInfo = await alistService.getMe()
          const basePath = userInfo.basePath || '/'
          const userId = ensureUser(username)
          saveSession(userId, username, result.token, basePath)
        } catch (err) {
          console.error('[auth] Failed to get user info:', err)
          return { success: false, message: '获取用户信息失败' }
        }
      }
      return result
    } catch (err) {
      console.error('Login error:', err)
      return { success: false, message: '网络错误，请稍后重试' }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    clearSession()
    return { success: true }
  })

  ipcMain.handle('auth:register', async (_event, username: string, password: string) => {
    try {
      const result = await callWebhook('register', { username, password })
      return result
    } catch (err) {
      console.error('Register error:', err)
      return { success: false, message: '网络错误，请稍后重试' }
    }
  })

  ipcMain.handle('auth:check-session', async () => {
    const session = getStoredSession()
    if (!session) return { valid: false }

    const db = getDatabase()
    const user = db.prepare('SELECT onboarding_completed FROM users WHERE id = ?').get(session.userId) as { onboarding_completed: number } | undefined

    return {
      valid: true,
      username: session.username,
      onboardingCompleted: user?.onboarding_completed === 1
    }
  })

  ipcMain.handle('auth:complete-onboarding', async () => {
    if (!currentSession) return { success: false }
    const db = getDatabase()
    db.prepare('UPDATE users SET onboarding_completed = 1, updated_at = ? WHERE id = ?')
      .run(Date.now(), currentSession.userId)
    return { success: true }
  })
}
