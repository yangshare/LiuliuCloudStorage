# Alist Token 会话恢复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让主进程统一校验和恢复 Alist token，避免认证过期被表现成普通下载失败或自动同步空扫描。

**架构：** 新增共享的 Alist 认证错误分类器，并在 `AuthService.ensureValidSession()` 中集中恢复本地 session、校验 Alist token、自动重新登录和广播会话失效。下载队列和自动同步在访问 Alist 前只从主进程会话权威获取 token，认证失败只重试一次，恢复失败时暂停队列或标记同步 run 失败，并让渲染进程立即跳转登录页。

**技术栈：** Electron + Vue 3 + TypeScript + Pinia + Vitest + Drizzle ORM + better-sqlite3

---

## 文件清单

### Main 侧

| 文件 | 职责 |
|---|---|
| `src/main/core/api/alist-auth-error.ts` | 新增统一的 Alist 认证错误分类器、认证过期文案、认证失败错误类型 |
| `src/main/features/auth/auth.service.ts` | 新增 `ensureValidSession()`，集中恢复、校验、刷新 Alist session，并广播 `auth:session:expired` |
| `src/main/features/transfer/transfer.handlers.ts` | 下载队列初始化和恢复队列前先校验主进程 session |
| `src/main/features/transfer/queue.service.ts` | 排队下载、批量排队和恢复队列改为使用 `ensureValidSession()` |
| `src/main/features/transfer/download-queue.manager.ts` | `getDownloadUrl()` 前确保 session；认证失败时暂停、尝试恢复并重试一次；恢复失败不标记普通 failed |
| `src/main/features/autoSync/auto-sync.core.service.ts` | 自动同步每个 Alist 阶段前校验 session；认证错误重试一次；恢复失败时 run 为 failed 且不发送空扫描成功消息 |
| `src/preload/index.ts` | 新增 `auth:session:expired` 事件转发到现有 `onAuthExpired` 订阅 |

### Renderer 侧

| 文件 | 职责 |
|---|---|
| `src/renderer/src/views/LoginView.vue` | 登录后把 `result.data.token` 写入 `authStore.user.token` |
| `src/renderer/src/views/HomeView.vue` | 初始化下载队列时传 `authStore.user.token`，不访问不存在的 `authStore.token` |
| `src/renderer/src/components/transfer/DownloadQueuePanel.vue` | 恢复队列失败时显示认证过期文案，不先提示“队列已恢复” |
| `src/renderer/src/features/transfer/composables/useTransferDownload.ts` | 纯认证失败显示全局认证通知，并跳过普通下载失败批量通知 |

### 测试

| 文件 | 职责 |
|---|---|
| `tests/unit/services/alistAuthError.test.ts` | 覆盖认证错误分类器 |
| `tests/unit/services/AuthServiceSessionRecovery.test.ts` | 覆盖 session 校验、自动刷新、刷新失败广播 |
| `tests/unit/services/QueueServiceSession.test.ts` | 覆盖下载队列入口忽略 renderer token 并使用主进程 session |
| `tests/unit/services/DownloadQueueManager.test.ts` | 覆盖下载队列认证失败暂停、恢复重试、不标记普通 failed |
| `tests/unit/services/AutoSyncServiceAuthRecovery.test.ts` | 覆盖自动同步扫描认证失败、恢复重试、恢复失败 run 为 failed |
| `tests/unit/preloadAuthExpired.test.ts` | 覆盖 `auth:session:expired` 事件触发 `onAuthExpired` |
| `tests/unit/views/LoginView.test.ts` | 覆盖登录后保存 token |
| `tests/unit/views/HomeView.test.ts` | 覆盖初始化下载队列传入 `authStore.user.token` |
| `tests/unit/composables/useTransferDownload.test.ts` | 覆盖认证失败不追加普通下载失败通知 |

---

## 任务 1：新增 Alist 认证错误分类器

**文件：**
- 创建：`src/main/core/api/alist-auth-error.ts`
- 测试：`tests/unit/services/alistAuthError.test.ts`

- [ ] **步骤 1：编写失败的分类器测试**

```typescript
import { describe, expect, it } from 'vitest'
import {
  ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE,
  ALIST_AUTH_EXPIRED_SYNC_MESSAGE,
  AlistAuthError,
  isAlistAuthError
} from '../../../src/main/core/api/alist-auth-error'

describe('alist auth error classifier', () => {
  it('识别 HTTP 401 状态码', () => {
    expect(isAlistAuthError({ response: { status: 401 }, message: 'Unauthorized' })).toBe(true)
    expect(isAlistAuthError({ status: 401, message: 'Unauthorized' })).toBe(true)
  })

  it('识别 Alist code 401 和 ALIST_401', () => {
    expect(isAlistAuthError({ code: 401, message: 'token is expired' })).toBe(true)
    expect(isAlistAuthError({ code: 'ALIST_401', message: 'failed' })).toBe(true)
    expect(isAlistAuthError('Alist错误(401): token is expired')).toBe(true)
  })

  it('识别 token expired、guest user 和未认证用户消息', () => {
    expect(isAlistAuthError(new Error('token is expired'))).toBe(true)
    expect(isAlistAuthError(new Error('guest user cannot access'))).toBe(true)
    expect(isAlistAuthError(new Error('用户未认证，请登录'))).toBe(true)
  })

  it('不把普通下载错误识别为认证失败', () => {
    expect(isAlistAuthError(new Error('object not found'))).toBe(false)
    expect(isAlistAuthError({ code: 'ALIST_500', message: 'storage unavailable' })).toBe(false)
  })

  it('提供下载和自动同步固定文案', () => {
    expect(ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE).toBe('Alist 登录已过期，请重新登录后恢复下载')
    expect(ALIST_AUTH_EXPIRED_SYNC_MESSAGE).toBe('Alist 登录已过期，请重新登录后重试同步')
    expect(new AlistAuthError(ALIST_AUTH_EXPIRED_SYNC_MESSAGE).name).toBe('AlistAuthError')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/alistAuthError.test.ts`

预期：FAIL，报错包含 `Cannot find module '../../../src/main/core/api/alist-auth-error'`。

- [ ] **步骤 3：实现分类器**

```typescript
export const ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE = 'Alist 登录已过期，请重新登录后恢复下载'
export const ALIST_AUTH_EXPIRED_SYNC_MESSAGE = 'Alist 登录已过期，请重新登录后重试同步'

export class AlistAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AlistAuthError'
  }
}

function readMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const record = error as Record<string, any>
    return [
      record.message,
      record.error,
      record.response?.data?.message,
      record.response?.statusText
    ].filter(Boolean).join(' ')
  }
  return ''
}

function readCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as Record<string, any>
    return String(record.code ?? record.response?.data?.code ?? record.response?.status ?? record.status ?? '')
  }
  return ''
}

export function isAlistAuthError(error: unknown): boolean {
  const code = readCode(error).toUpperCase()
  if (code === '401' || code === 'ALIST_401') return true

  const message = readMessage(error).toLowerCase()
  if (message.includes('alist错误(401)')) return true
  if (message.includes('token is expired')) return true
  if (message.includes('guest user')) return true
  if (message.includes('unauthorized')) return true
  if (message.includes('未认证')) return true
  if (message.includes('未登录')) return true

  return false
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/alistAuthError.test.ts`

预期：PASS，5 个测试通过。

- [ ] **步骤 5：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/core/api/alist-auth-error.ts tests/unit/services/alistAuthError.test.ts
git commit -m "feat: add Alist auth error classifier"
```

---

## 任务 2：实现主进程会话权威

**文件：**
- 修改：`src/main/features/auth/auth.service.ts`
- 测试：`tests/unit/services/AuthServiceSessionRecovery.test.ts`

- [ ] **步骤 1：编写 session 恢复测试**

```typescript
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/AuthServiceSessionRecovery.test.ts`

预期：FAIL，报错包含 `ensureValidSession is not a function`。

- [ ] **步骤 3：扩展 AuthService session 类型和 public 方法**

在 `auth.service.ts` 顶部补充导入：

```typescript
import { BrowserWindow } from 'electron'
import { isAlistAuthError } from '../../core/api/alist-auth-error'
```

替换当前模块级会话类型：

```typescript
export interface AuthSession {
  userId: number
  username: string
  token: string
  basePath: string
}

let currentSession: AuthSession | null = null
```

新增 public 方法，并让 `getCurrentSession()` 返回带 `basePath` 的 session：

```typescript
async ensureValidSession(options: { forceRefresh?: boolean } = {}): Promise<AuthSession | null> {
  const row = await this.getLatestSessionRow()

  if (currentSession && !options.forceRefresh) {
    const valid = await this.validateAlistSession(currentSession)
    if (valid) return currentSession
  }

  if (!row) {
    this.notifyAuthExpired()
    return null
  }

  if (!options.forceRefresh && row.expiresAt && row.expiresAt.getTime() > Date.now()) {
    try {
      const token = cryptoService.decrypt(row.tokenEncrypted)
      const restored = this.applySession(row.userId, row.username, token, row.basePath || '/')
      if (await this.validateAlistSession(restored)) return restored
    } catch (e) {
      loggerService.error('AuthService', `Session restore validation failed: ${e}`)
    }
  }

  const refreshed = await this.tryAutoLogin(row)
  if (refreshed) return refreshed

  this.clearMemorySession()
  this.notifyAuthExpired()
  return null
}

getCurrentSession(): AuthSession | null {
  return currentSession
}
```

- [ ] **步骤 4：新增 AuthService 私有辅助方法**

```typescript
private getLatestSessionRow(): {
  userId: number
  username: string
  tokenEncrypted: string
  expiresAt: Date | null
  basePath: string | null
} | null {
  return this.db
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
    .get() ?? null
}

private applySession(userId: number, username: string, token: string, basePath: string): AuthSession {
  currentSession = { userId, username, token, basePath }
  loggerService.info('AuthService', `Applying Alist session for user: ${username}, basePath: ${basePath}`)
  alistService.setToken(token)
  alistService.setBasePath(basePath)
  alistService.setUserId(userId)
  return currentSession
}

private async validateAlistSession(session: AuthSession): Promise<boolean> {
  try {
    this.applySession(session.userId, session.username, session.token, session.basePath)
    await alistService.getMe()
    return true
  } catch (error) {
    if (isAlistAuthError(error)) return false
    loggerService.warn('AuthService', `Alist session validation failed with non-auth error: ${error}`)
    throw error
  }
}

private async tryAutoLogin(row: {
  userId: number
  username: string
  basePath: string | null
}): Promise<AuthSession | null> {
  const autoLogin = preferencesService.getValue(`auto_login_${row.username}`) === 'true'
  if (!autoLogin) return null

  const encryptedPwd = preferencesService.getValue(`auth_password_${row.username}`)
  if (!encryptedPwd) return null

  try {
    const password = cryptoService.decrypt(encryptedPwd)
    const result = await alistService.login(row.username, password)
    if (!result.success || !result.token) return null

    let basePath = row.basePath || '/'
    try {
      const userInfo = await alistService.getMe()
      basePath = userInfo.basePath || basePath
    } catch (error) {
      loggerService.warn('AuthService', `Failed to get user info after auto-login: ${error}`)
    }

    this.saveSession(row.userId, row.username, result.token, basePath)
    return currentSession
  } catch (error) {
    loggerService.error('AuthService', `Auto-login failed for ${row.username}: ${error}`)
    return null
  }
}

private notifyAuthExpired(): void {
  const payload = { code: 'UNAUTHORIZED', message: 'Alist 登录已过期，请重新登录' }
  BrowserWindow.getAllWindows().forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('auth:session:expired', payload)
    }
  })
}

private clearMemorySession(): void {
  currentSession = null
  alistService.setToken('')
  alistService.setBasePath('')
}
```

- [ ] **步骤 5：改造现有 `saveSession()`、`restoreSession()`、`checkSession()`**

将 `saveSession()` 中手写 currentSession 和 AlistService 初始化替换为：

```typescript
this.applySession(userId, username, token, basePath)
```

将 `restoreSession()` 简化为调用新权威方法：

```typescript
private async restoreSession(): Promise<AuthSession | null> {
  return this.ensureValidSession()
}
```

将 `checkSession()` 保持 IPC 返回形状兼容：

```typescript
async checkSession(): Promise<AuthSessionResult> {
  const session = await this.ensureValidSession()

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
        isAdmin: false
      }
    }
  }
}
```

- [ ] **步骤 6：运行测试验证通过**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/AuthServiceSessionRecovery.test.ts tests/unit/authSessionResult.test.ts`

预期：PASS，新增 session 恢复测试和旧 session 结果归一化测试通过。

- [ ] **步骤 7：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/auth/auth.service.ts tests/unit/services/AuthServiceSessionRecovery.test.ts
git commit -m "feat: centralize Alist session recovery in AuthService"
```

---

## 任务 3：让 preload 转发主进程会话失效事件

**文件：**
- 修改：`src/preload/index.ts`
- 修改：`src/shared/types/electron.d.ts`
- 测试：`tests/unit/preloadAuthExpired.test.ts`

- [ ] **步骤 1：扩展 preload 事件测试**

在 `tests/unit/preloadAuthExpired.test.ts` 添加：

```typescript
it('主进程 auth:session:expired 事件会触发 onAuthExpired 订阅者', async () => {
  const api = await loadPreloadAPI()
  const handler = vi.fn()
  api.onAuthExpired(handler)

  const expiredListener = mockIpcRenderer.on.mock.calls.find(call => call[0] === 'auth:session:expired')?.[1]
  expect(expiredListener).toBeDefined()

  expiredListener({}, { code: 'UNAUTHORIZED', message: 'Alist 登录已过期，请重新登录' })
  await vi.runAllTimersAsync()

  expect(handler).toHaveBeenCalledWith('UNAUTHORIZED')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/preloadAuthExpired.test.ts`

预期：FAIL，`expiredListener` 为 `undefined`。

- [ ] **步骤 3：在 preload 注册事件通道并转发**

在 `validChannels` 中加入：

```typescript
'auth:session:expired',
```

在 `contextBridge.exposeInMainWorld` 之前注册主进程事件监听：

```typescript
ipcRenderer.on('auth:session:expired', (_event, payload: { code?: string } | undefined) => {
  notifyAuthExpired(payload?.code || 'UNAUTHORIZED')
})
```

- [ ] **步骤 4：更新 ElectronAPI 类型声明**

在 `src/shared/types/electron.d.ts` 中保留 `onAuthExpired` 签名不变，不新增渲染进程公开方法；只确保 `validChannels` 的新增通道不会要求 renderer 直接调用。

```typescript
onAuthExpired: (handler: (code: string) => void | Promise<void>) => () => void
```

- [ ] **步骤 5：运行测试验证通过**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/preloadAuthExpired.test.ts`

预期：PASS，3 个 preload 鉴权失效测试通过。

- [ ] **步骤 6：Commit**

```bash
cd LiuliuCloudStorage
git add src/preload/index.ts src/shared/types/electron.d.ts tests/unit/preloadAuthExpired.test.ts
git commit -m "feat: forward main auth expired events to renderer"
```

---

## 任务 4：下载队列入口改用主进程 session

**文件：**
- 修改：`src/main/features/transfer/transfer.handlers.ts`
- 修改：`src/main/features/transfer/queue.service.ts`
- 测试：`tests/unit/services/TransferService.test.ts`

- [ ] **步骤 1：编写 QueueService session 测试**

创建 `tests/unit/services/QueueServiceSession.test.ts`：

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueueService } from '../../../src/main/features/transfer/queue.service'

const { mockEnsureValidSession, mockRestoreQueue, mockAddToQueue } = vi.hoisted(() => ({
  mockEnsureValidSession: vi.fn(),
  mockRestoreQueue: vi.fn(),
  mockAddToQueue: vi.fn()
}))

vi.mock('../../../src/main/features/auth/auth.service', () => ({
  authService: {
    ensureValidSession: mockEnsureValidSession
  }
}))

vi.mock('../../../src/main/features/transfer/download-queue.manager', () => ({
  downloadQueueManager: {
    setCredentials: vi.fn(),
    restoreQueue: mockRestoreQueue,
    addToQueue: mockAddToQueue,
    addBatchToQueue: vi.fn(async () => []),
    getQueueState: vi.fn(),
    pauseQueue: vi.fn(),
    resumeQueue: vi.fn(),
    clearQueue: vi.fn(),
    clearPendingQueue: vi.fn(),
    clearActiveQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    getStatus: vi.fn()
  }
}))

describe('QueueService download session authority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureValidSession.mockResolvedValue({
      userId: 42,
      username: 'alice',
      token: 'authoritative-token',
      basePath: '/alist/'
    })
  })

  it('恢复下载队列时忽略 renderer 传入 token，使用 AuthService token', async () => {
    const service = new QueueService()

    await service.restoreDownloadQueue(1, 'stale-renderer-token')

    expect(mockRestoreQueue).toHaveBeenCalledWith(42, 'authoritative-token')
  })

  it('排队下载时使用 AuthService session', async () => {
    mockAddToQueue.mockResolvedValue(101)
    const service = new QueueService()

    const result = await service.queueDownloadWithSession({
      id: 'download_1',
      fileName: 'a.zip',
      fileSize: 0,
      remotePath: '/a.zip',
      priority: 0
    })

    expect(mockAddToQueue).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      userToken: 'authoritative-token'
    }))
    expect(result).toEqual({ taskId: 'download_1', dbId: 101 })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/QueueServiceSession.test.ts`

预期：FAIL，恢复队列仍使用 renderer token 或测试文件不存在。

- [ ] **步骤 3：修改 QueueService 下载入口**

在 `queue.service.ts` 增加私有方法：

```typescript
private async getValidDownloadSession(): Promise<{ userId: number; username: string; token: string; basePath: string }> {
  const { authService } = await import('../auth/auth.service')
  const session = await authService.ensureValidSession()
  if (!session) throw new IPCError('Alist 登录已过期，请重新登录后恢复下载', IPCErrorCode.UNAUTHORIZED)
  return session
}
```

替换下载相关方法：

```typescript
async restoreDownloadQueue(_userId: number, _userToken: string): Promise<number> {
  const session = await this.getValidDownloadSession()
  downloadQueueManager.setCredentials(session.userId, session.token)
  return downloadQueueManager.restoreQueue(session.userId, session.token)
}

async resumeDownloadQueue(): Promise<void> {
  const session = await this.getValidDownloadSession()
  downloadQueueManager.setCredentials(session.userId, session.token)
  downloadQueueManager.resumeQueue()
}

async queueDownloadWithSession(taskData: any) {
  const session = await this.getValidDownloadSession()

  const task: DownloadQueueTask = {
    id: taskData.id || `download_${Date.now()}_${randomUUID()}`,
    fileName: taskData.fileName,
    fileSize: taskData.fileSize || 0,
    remotePath: taskData.remotePath,
    savePath: taskData.savePath,
    priority: taskData.priority || 0,
    userId: session.userId,
    userToken: session.token
  }

  const dbId = await this.addDownloadTask(task)
  return { taskId: task.id, dbId }
}

async batchQueueDownloadWithSession(remotePaths: string[]) {
  const session = await this.getValidDownloadSession()
  const batchId = `batch_${Date.now()}_${randomUUID()}`
  const tasks: DownloadQueueTask[] = remotePaths.map((remotePath, i) => ({
    id: `download_${Date.now()}_${i}_${randomUUID()}`,
    fileName: remotePath.split('/').pop() || 'unknown',
    fileSize: 0,
    remotePath,
    priority: i,
    userId: session.userId,
    userToken: session.token,
    batchId
  }))

  const batchResult = await this.addBatchDownloadTasks(tasks)
  return {
    successCount: batchResult.length,
    failedCount: tasks.length - batchResult.length,
    batchId
  }
}
```

- [ ] **步骤 4：修改 transfer handlers 的 init 和 resume**

```typescript
ipcMain.handle('transfer:download:init-queue', async (_event, { userId, userToken }) => {
  return handleIPC(async () => {
    const restoredCount = await queueService.restoreDownloadQueue(userId, userToken)
    const { downloadQueueManager } = await import('./download-queue.manager')
    downloadQueueManager.setProgressCallback((data: any) => {
      _event.sender.send('transfer:download:progress', data)
    })
    return { restoredCount }
  })
})

ipcMain.handle('transfer:download:resume-queue', async () => {
  return handleIPC(() => queueService.resumeDownloadQueue())
})
```

- [ ] **步骤 5：运行测试验证通过**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/QueueServiceSession.test.ts`

预期：PASS，2 个 QueueService session 测试通过。

- [ ] **步骤 6：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/transfer/queue.service.ts src/main/features/transfer/transfer.handlers.ts tests/unit/services/QueueServiceSession.test.ts
git commit -m "feat: use authoritative session for download queue entrypoints"
```

---

## 任务 5：下载任务认证失败只重试一次且不标记普通失败

**文件：**
- 修改：`src/main/features/transfer/download-queue.manager.ts`
- 测试：`tests/unit/services/DownloadQueueManager.test.ts`

- [ ] **步骤 1：补充下载队列认证失败测试**

在 `tests/unit/services/DownloadQueueManager.test.ts` 的 hoisted mocks 中新增：

```typescript
mockEnsureValidSession: vi.fn()
```

新增 mock：

```typescript
vi.mock('../../../src/main/features/auth/auth.service', () => ({
  authService: {
    ensureValidSession: mockEnsureValidSession
  }
}))
```

新增测试：

```typescript
it('getDownloadUrl 返回认证失败时暂停队列并只发送 auth-failed，不标记 failed', async () => {
  const sent: Array<{ channel: string; payload: any }> = []
  const { BrowserWindow } = await import('electron')
  ;(BrowserWindow.getAllWindows as any).mockReturnValue([{
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, payload: any) => sent.push({ channel, payload })
    }
  }])

  mockEnsureValidSession
    .mockResolvedValueOnce({ userId: 1, username: 'alice', token: 'old-token', basePath: '/alist/' })
    .mockResolvedValueOnce(null)
  mockGetDownloadUrl.mockResolvedValue({ success: false, error: 'Alist错误(401): token is expired' })

  const task = {
    id: 'download_auth_1',
    fileName: 'expired.zip',
    fileSize: 1024,
    userId: 1,
    userToken: 'old-token',
    remotePath: '/expired.zip',
    priority: 0,
    dbId: 201
  }

  ;(downloadQueueManager as any).activeDownloads.set(task.id, task)
  await (downloadQueueManager as any).startDownload(task)

  expect((downloadQueueManager as any).maxConcurrent).toBe(0)
  expect(mockTransferServiceMethods.markAsFailed).not.toHaveBeenCalled()
  expect(sent.some(e => e.channel === 'transfer:download:auth-failed')).toBe(true)
  expect(sent.some(e => e.channel === 'transfer:download:failed')).toBe(false)
})

it('session 恢复成功时使用新 token 重试当前任务一次', async () => {
  mockEnsureValidSession
    .mockResolvedValueOnce({ userId: 1, username: 'alice', token: 'old-token', basePath: '/alist/' })
    .mockResolvedValueOnce({ userId: 1, username: 'alice', token: 'new-token', basePath: '/alist/' })
  mockGetDownloadUrl
    .mockResolvedValueOnce({ success: false, error: 'Alist错误(401): token is expired' })
    .mockResolvedValueOnce({ success: true, rawUrl: 'https://download/a.zip', fileSize: 1024 })
  mockDownloadManagerStartDownload.mockResolvedValue('C:\\Downloads\\a.zip')

  const task = {
    id: 'download_retry_1',
    fileName: 'a.zip',
    fileSize: 1024,
    userId: 1,
    userToken: 'old-token',
    remotePath: '/a.zip',
    priority: 0,
    dbId: 202
  }

  ;(downloadQueueManager as any).activeDownloads.set(task.id, task)
  await (downloadQueueManager as any).startDownload(task)

  expect(mockGetDownloadUrl).toHaveBeenCalledTimes(2)
  expect(mockDownloadManagerStartDownload).toHaveBeenCalledTimes(1)
  expect(mockTransferServiceMethods.markAsFailed).not.toHaveBeenCalled()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/DownloadQueueManager.test.ts`

预期：FAIL，认证失败仍调用 `markAsFailed` 或发送 `transfer:download:failed`。

- [ ] **步骤 3：修改 DownloadQueueManager 导入和 startDownload 签名**

```typescript
import { authService, type AuthSession } from '../auth/auth.service'
import {
  ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE,
  isAlistAuthError
} from '../../core/api/alist-auth-error'
```

```typescript
private async startDownload(
  task: DownloadQueueTask & { dbId: number },
  authRetryCount = 0
): Promise<void> {
```

- [ ] **步骤 4：在 `getDownloadUrl()` 前使用主进程 session**

替换原来的 `this.userToken` 设置逻辑：

```typescript
const session = await authService.ensureValidSession()
if (!session) {
  throw new Error(ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE)
}
this.applySessionToAlist(session)
task.userId = session.userId
task.userToken = session.token
```

新增私有方法：

```typescript
private applySessionToAlist(session: AuthSession): void {
  this.setCredentials(session.userId, session.token)
  alistService.setToken(session.token)
  alistService.setBasePath(session.basePath)
  alistService.setUserId(session.userId)
}
```

- [ ] **步骤 5：新增认证失败恢复方法**

```typescript
private async handleAuthFailure(
  task: DownloadQueueTask & { dbId: number },
  authRetryCount: number
): Promise<boolean> {
  this.pauseQueue()

  if (authRetryCount === 0) {
    const recovered = await authService.ensureValidSession({ forceRefresh: true })
    if (recovered) {
      this.applySessionToAlist(recovered)
      task.userId = recovered.userId
      task.userToken = recovered.token
      task.url = undefined
      await this.transferService.updateStatus(task.dbId, 'pending')

      this.maxConcurrent = MAX_CONCURRENT_DOWNLOADS
      this.activeDownloads.set(task.id, task)
      await this.startDownload(task, authRetryCount + 1)
      return true
    }
  }

  await this.transferService.updateStatus(task.dbId, 'pending')
  this.queue.set(task.id, { ...task, url: undefined })

  if (!this.authFailedNotified) {
    this.authFailedNotified = true
    loggerService.error('DownloadQueueManager', 'Alist 认证失效，已暂停下载队列')
    BrowserWindow.getAllWindows().forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('transfer:download:auth-failed', {
          error: ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE
        })
      }
    })
  }

  this.emitQueueUpdated()
  return true
}
```

- [ ] **步骤 6：改造 catch 分支，认证错误提前返回**

在 `catch` 中删除先 `markAsFailed` 的顺序，改为：

```typescript
const errMsg: string = error.message || ''

if (isAlistAuthError(error) || isAlistAuthError(errMsg)) {
  const handled = await this.handleAuthFailure(task, authRetryCount)
  if (handled) return
}

try {
  await this.transferService.markAsFailed(task.dbId, errMsg, 0)
} catch (dbErr) {
  loggerService.error('DownloadQueueManager', `更新失败状态失败 - dbId: ${task.dbId}, 错误: ${dbErr}`)
}
```

保留非认证错误清理残留文件、发送 `transfer:download:failed`、继续 `processQueue()` 的现有逻辑。

- [ ] **步骤 7：运行测试验证通过**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/DownloadQueueManager.test.ts`

预期：PASS，原有云端文件不存在测试和新增认证恢复测试全部通过。

- [ ] **步骤 8：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/transfer/download-queue.manager.ts tests/unit/services/DownloadQueueManager.test.ts
git commit -m "feat: recover download queue session on Alist auth failure"
```

---

## 任务 6：自动同步认证失败作为工作流失败处理

**文件：**
- 修改：`src/main/features/autoSync/auto-sync.core.service.ts`
- 测试：`tests/unit/services/AutoSyncServiceAuthRecovery.test.ts`

- [ ] **步骤 1：编写自动同步认证失败测试**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoSyncService } from '../../../src/main/features/autoSync/auto-sync.core.service'

const {
  mockDb,
  mockAlistService,
  mockShareTransferService,
  mockDownloadQueueManager,
  mockEnsureValidSession
} = vi.hoisted(() => {
  const runs: any[] = []
  const plans = new Map<number, any>([[
    1,
    {
      id: 1,
      user_id: 7,
      name: '同步计划',
      share_url: 'https://pan.baidu.com/s/abc',
      share_code: 'abc',
      local_sync_dir: 'C:\\Sync',
      last_alist_path: null,
      status: 'enabled',
      expires_at: Date.now() + 86_400_000,
      auto_run_on_startup: 1,
      conflict_policy: 'skip_existing',
      last_sync_at: null,
      last_success_at: null,
      last_error_message: null,
      created_at: Date.now(),
      updated_at: Date.now()
    }
  ]])

  return {
    mockDb: {
      prepare: vi.fn((sql: string) => ({
        get: vi.fn((...args: any[]) => {
          if (sql.includes('SELECT * FROM auto_sync_plans')) return plans.get(args[0])
          if (sql.includes('INSERT INTO auto_sync_runs') && sql.includes('RETURNING id')) {
            const row = { id: runs.length + 1, plan_id: args[0], user_id: args[1], trigger_type: args[2], status: 'running', started_at: Date.now(), finished_at: null }
            runs.push(row)
            return { id: row.id }
          }
          if (sql.includes('SELECT * FROM auto_sync_runs')) return runs.find(r => r.id === args[0])
          return undefined
        }),
        all: vi.fn(() => []),
        run: vi.fn((...args: any[]) => {
          if (sql.includes('UPDATE auto_sync_runs')) {
            const run = runs.find(r => r.id === args[9])
            if (run) {
              run.status = args[0]
              run.error_message = args[8]
              run.finished_at = args[9]
            }
          }
        })
      }))
    },
    mockAlistService: {
      listFiles: vi.fn()
    },
    mockShareTransferService: {
      execTransfer: vi.fn()
    },
    mockDownloadQueueManager: {
      setCredentials: vi.fn(),
      addBatchToQueue: vi.fn()
    },
    mockEnsureValidSession: vi.fn()
  }
})

vi.mock('../../../src/main/database', () => ({ getDatabase: vi.fn(() => mockDb) }))
vi.mock('../../../src/main/core/api/alist.service', () => ({ alistService: mockAlistService }))
vi.mock('../../../src/main/features/shareTransfer/share-transfer.core.service', () => ({ shareTransferService: mockShareTransferService }))
vi.mock('../../../src/main/features/transfer/download-queue.manager', () => ({ downloadQueueManager: mockDownloadQueueManager }))
vi.mock('../../../src/main/features/auth/auth.service', () => ({ authService: { ensureValidSession: mockEnsureValidSession } }))
vi.mock('../../../src/main/core/logger/logger.service', () => ({ loggerService: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('fs', () => ({ default: { mkdirSync: vi.fn(), accessSync: vi.fn(), constants: { W_OK: 2 } }, mkdirSync: vi.fn(), accessSync: vi.fn(), constants: { W_OK: 2 } }))

describe('AutoSyncService auth recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureValidSession.mockResolvedValue({ userId: 7, username: 'alice', token: 'valid-token', basePath: '/alist/' })
    mockShareTransferService.execTransfer.mockResolvedValue({
      success: true,
      alistPath: 'https://alist.local/d/%E5%88%86%E4%BA%AB'
    })
  })

  it('远程扫描认证失败且 session 恢复失败时，run 为 failed 且不发送空扫描完成', async () => {
    const service = AutoSyncService.getInstance()
    const progress: any[] = []
    service.setProgressCallback((_planId, event) => progress.push(event))

    mockAlistService.listFiles.mockRejectedValue({ code: 'ALIST_401', message: 'token is expired' })
    mockEnsureValidSession
      .mockResolvedValueOnce({ userId: 7, username: 'alice', token: 'old-token', basePath: '/alist/' })
      .mockResolvedValueOnce(null)

    const result = await service.runPlan(1, { userId: 7, username: 'alice', token: 'old-token' }, 'manual')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Alist 登录已过期，请重新登录后重试同步')
    expect(progress.some(e => e.stage === 'scan' && e.status === 'completed' && e.message.includes('扫描完成，共 0 个文件'))).toBe(false)
    expect(progress.some(e => e.stage === 'complete' && e.status === 'failed' && e.message === 'Alist 登录已过期，请重新登录后重试同步')).toBe(true)
  })

  it('远程扫描认证失败但 session 恢复成功时，重试扫描一次', async () => {
    const service = AutoSyncService.getInstance()
    mockEnsureValidSession
      .mockResolvedValueOnce({ userId: 7, username: 'alice', token: 'old-token', basePath: '/alist/' })
      .mockResolvedValueOnce({ userId: 7, username: 'alice', token: 'new-token', basePath: '/alist/' })
    mockAlistService.listFiles
      .mockRejectedValueOnce({ code: 'ALIST_401', message: 'token is expired' })
      .mockResolvedValueOnce({ content: [], total: 0, readme: '', write: false, provider: 'mock' })
    mockDownloadQueueManager.addBatchToQueue.mockResolvedValue([])

    const result = await service.runPlan(1, { userId: 7, username: 'alice', token: 'old-token' }, 'manual')

    expect(mockAlistService.listFiles).toHaveBeenCalledTimes(2)
    expect(result.message).toBe('同步完成，没有新增文件')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/AutoSyncServiceAuthRecovery.test.ts`

预期：FAIL，扫描认证失败被吞掉并产生空扫描结果。

- [ ] **步骤 3：引入认证恢复依赖和类型**

在 `auto-sync.core.service.ts` 顶部新增：

```typescript
import { authService, type AuthSession } from '../auth/auth.service'
import {
  ALIST_AUTH_EXPIRED_SYNC_MESSAGE,
  AlistAuthError,
  isAlistAuthError
} from '../../core/api/alist-auth-error'
```

- [ ] **步骤 4：新增自动同步 session 恢复辅助方法**

```typescript
private async ensureWorkflowSession(session: { userId: number; username: string; token: string }): Promise<AuthSession> {
  const validSession = await authService.ensureValidSession()
  if (!validSession || validSession.userId !== session.userId) {
    throw new AlistAuthError(ALIST_AUTH_EXPIRED_SYNC_MESSAGE)
  }
  return validSession
}

private async withAlistSessionRetry<T>(
  session: AuthSession,
  operation: (activeSession: AuthSession) => Promise<T>
): Promise<{ result: T; session: AuthSession }> {
  try {
    return { result: await operation(session), session }
  } catch (error) {
    if (!isAlistAuthError(error)) throw error
    const recovered = await authService.ensureValidSession({ forceRefresh: true })
    if (!recovered || recovered.userId !== session.userId) {
      throw new AlistAuthError(ALIST_AUTH_EXPIRED_SYNC_MESSAGE)
    }
    return { result: await operation(recovered), session: recovered }
  }
}
```

- [ ] **步骤 5：修改 `runPlan()` 使用 activeSession**

在 `runPlan()` 创建 run 前后引入 `activeSession`：

```typescript
let activeSession = await this.ensureWorkflowSession(session)
```

替换转存阶段：

```typescript
const transferAttempt = await this.withAlistSessionRetry(activeSession, (s) =>
  shareTransferService.execTransfer(plan.shareUrl, s.userId)
)
activeSession = transferAttempt.session
const transfer = transferAttempt.result
```

替换扫描阶段：

```typescript
const scanAttempt = await this.withAlistSessionRetry(activeSession, () =>
  this.scanRemoteFiles(remoteRoot, (scannedFiles, scannedDirs) => {
    this.notifyProgress(planId, {
      stage: 'scan',
      status: 'in_progress',
      message: `已扫描 ${scannedDirs} 个目录，发现 ${scannedFiles} 个文件...`,
      current: 30 + Math.min(scannedFiles, 35),
      total: 100
    })
  })
)
activeSession = scanAttempt.session
const remoteFiles = scanAttempt.result
```

替换入队阶段：

```typescript
const queueAttempt = await this.withAlistSessionRetry(activeSession, (s) =>
  this.queueMissingFiles(newFiles, s)
)
activeSession = queueAttempt.session
const queuedCount = queueAttempt.result
```

在 `catch` 中把认证错误统一成同步文案：

```typescript
const message = error instanceof AlistAuthError || isAlistAuthError(error)
  ? ALIST_AUTH_EXPIRED_SYNC_MESSAGE
  : error.message || '自动同步失败'
```

- [ ] **步骤 6：修改 `scanRemoteFiles()` 不吞认证错误**

在 `scanRemoteFiles()` 中添加：

```typescript
let authError: unknown = null
```

在 `scanDir` 开头添加：

```typescript
if (authError) return
```

将 `listFiles` catch 改为：

```typescript
try {
  result = await alistService.listFiles(current)
} catch (error: any) {
  loggerService.error('AutoSyncService', `扫描目录失败: ${current}, error=${error.message || error}`)
  if (isAlistAuthError(error)) {
    authError = error
  }
  return
}
```

在 `await queue.onIdle()` 后添加：

```typescript
if (authError) throw authError
```

- [ ] **步骤 7：同步改造 `establishBaseline()` 和 `resetBaseline()`**

在 `establishBaseline()` 中与 `runPlan()` 相同地使用：

```typescript
let activeSession = await this.ensureWorkflowSession(session)
const transferAttempt = await this.withAlistSessionRetry(activeSession, (s) =>
  shareTransferService.execTransfer(plan.shareUrl, s.userId)
)
activeSession = transferAttempt.session
const transfer = transferAttempt.result

const scanAttempt = await this.withAlistSessionRetry(activeSession, () =>
  this.scanRemoteFiles(remoteRoot, (scannedFiles, scannedDirs) => {
    this.notifyProgress(planId, {
      stage: 'scan',
      status: 'in_progress',
      message: `已扫描 ${scannedDirs} 个目录，发现 ${scannedFiles} 个文件...`,
      current: 30 + Math.min(scannedFiles, 35),
      total: 100
    })
  })
)
const remoteFiles = scanAttempt.result
```

在 `establishBaseline()` 的 `catch` 中使用同样的 message 归一化：

```typescript
const message = error instanceof AlistAuthError || isAlistAuthError(error)
  ? ALIST_AUTH_EXPIRED_SYNC_MESSAGE
  : error.message || '首次同步失败'
```

- [ ] **步骤 8：运行测试验证通过**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/services/AutoSyncServiceAuthRecovery.test.ts`

预期：PASS，2 个自动同步认证恢复测试通过。

- [ ] **步骤 9：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/autoSync/auto-sync.core.service.ts tests/unit/services/AutoSyncServiceAuthRecovery.test.ts
git commit -m "feat: handle Alist auth recovery in auto sync"
```

---

## 任务 7：修复渲染进程 token 状态和恢复队列提示

**文件：**
- 修改：`src/renderer/src/views/LoginView.vue`
- 修改：`src/renderer/src/views/HomeView.vue`
- 修改：`src/renderer/src/components/transfer/DownloadQueuePanel.vue`
- 测试：`tests/unit/views/LoginView.test.ts`
- 测试：`tests/unit/views/HomeView.test.ts`

- [ ] **步骤 1：编写 LoginView token 测试**

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '../../../src/renderer/src/views/LoginView.vue'
import { useAuthStore } from '../../../src/renderer/src/features/auth/stores/authStore'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push })
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElForm: { template: '<form @submit.prevent="$emit(`submit`)"><slot /></form>' },
  ElFormItem: { template: '<div><slot /></div>' },
  ElInput: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(`update:modelValue`, ($event.target as HTMLInputElement).value)" />' },
  ElCheckbox: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input type="checkbox" :checked="modelValue" @change="$emit(`update:modelValue`, ($event.target as HTMLInputElement).checked)" />' },
  ElButton: { template: '<button><slot /></button>' }
}))

vi.mock('@element-plus/icons-vue', () => ({ User: {}, Lock: {} }))

describe('LoginView token persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window as any).electronAPI = {
      auth: {
        getLoginPreferences: vi.fn().mockResolvedValue({ success: true, data: { username: '', password: '', autoLogin: false } }),
        login: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 7, username: 'alice', token: 'login-token', isAdmin: false }
        }),
        getCurrentUser: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 7, username: 'alice', isAdmin: false, quotaTotal: 1, quotaUsed: 0 }
        })
      }
    }
  })

  it('登录成功后保存 auth.login 返回的 token', async () => {
    const wrapper = mount(LoginView)
    await flushPromises()

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('alice')
    await inputs[1].setValue('password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const authStore = useAuthStore()
    expect(authStore.user?.token).toBe('login-token')
    expect(push).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **步骤 2：扩展 HomeView 初始化队列测试**

在 `tests/unit/views/HomeView.test.ts` 将 `useTransferDownload` mock 提升为可断言函数：

```typescript
const initDownloadQueueMock = vi.fn()

vi.mock('@/features/transfer/composables/useTransferDownload', () => ({
  useTransferDownload: () => ({
    initDownloadQueue: initDownloadQueueMock
  })
}))
```

新增测试：

```typescript
it('初始化下载队列时传入 authStore.user.token', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const { useAuthStore } = await import('../../../src/renderer/src/features/auth/stores/authStore')
  const authStore = useAuthStore()
  authStore.setUser({ id: 7, username: 'alice', token: 'user-token', isAdmin: false })

  mount(HomeView, {
    global: {
      plugins: [pinia],
      stubs
    }
  })
  await flushPromises()

  expect(initDownloadQueueMock).toHaveBeenCalledWith(7, 'user-token')
})
```

- [ ] **步骤 3：运行测试验证失败**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/views/LoginView.test.ts tests/unit/views/HomeView.test.ts`

预期：FAIL，LoginView 保存空 token，HomeView 传入 `undefined`。

- [ ] **步骤 4：修复 LoginView token 保存**

替换登录成功分支：

```typescript
if (result.success && result.data) {
  const userResult = await window.electronAPI.auth.getCurrentUser()
  authStore.setUser({
    id: result.data.id,
    username: result.data.username,
    token: result.data.token,
    isAdmin: userResult?.success && userResult.data
      ? userResult.data.isAdmin
      : result.data.isAdmin
  })
  ElMessage.success('登录成功')
  router.push('/')
} else {
  ElMessage.error(result.message || result.error || '登录失败')
}
```

- [ ] **步骤 5：修复 HomeView 初始化队列 token**

```typescript
initDownloadQueue(
  authStore.user.id,
  authStore.user.token
)
```

- [ ] **步骤 6：修复恢复队列按钮误导提示**

在 `DownloadQueuePanel.vue` 的 `handleResumeQueue()` 中替换错误处理：

```typescript
async function handleResumeQueue() {
  const result = await resumeDownloadQueue()
  if (result.success) {
    ElNotification.success({
      title: '队列已恢复',
      message: '下载队列已恢复，将自动启动等待中的任务'
    })
  } else {
    ElNotification.error({
      title: result.error?.includes('Alist 登录已过期') ? 'Alist 认证失效' : '恢复失败',
      message: result.error || '恢复下载队列失败'
    })
  }
}
```

- [ ] **步骤 7：运行测试验证通过**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/views/LoginView.test.ts tests/unit/views/HomeView.test.ts`

预期：PASS，LoginView 和 HomeView 测试通过。

- [ ] **步骤 8：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/views/LoginView.vue src/renderer/src/views/HomeView.vue src/renderer/src/components/transfer/DownloadQueuePanel.vue tests/unit/views/LoginView.test.ts tests/unit/views/HomeView.test.ts
git commit -m "fix: keep renderer auth token and queue recovery messaging consistent"
```

---

## 任务 8：下载认证失败不追加普通失败通知

**文件：**
- 修改：`src/renderer/src/features/transfer/composables/useTransferDownload.ts`
- 测试：`tests/unit/composables/useTransferDownload.test.ts`

- [ ] **步骤 1：补充认证失败通知测试**

在 `tests/unit/composables/useTransferDownload.test.ts` 添加：

```typescript
function getAuthFailedListener() {
  const l = listeners.get('transfer:download:auth-failed')
  expect(l).toBeDefined()
  return l!
}

it('认证失败只显示 Alist 认证失效通知，不追加普通下载失败通知', async () => {
  await setupModule()
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/composables/useTransferDownload.test.ts`

预期：FAIL，普通 `下载失败` 通知也会出现。

- [ ] **步骤 3：新增 renderer 侧认证失败判定和静默窗口**

在模块级变量区域添加：

```typescript
let _authFailureSilenceUntil = 0

function isAuthFailureMessage(error: string | undefined): boolean {
  const value = (error || '').toLowerCase()
  return value.includes('alist 登录已过期') ||
    value.includes('token is expired') ||
    value.includes('401') ||
    value.includes('guest user')
}
```

修改 `downloadAuthFailedHandler`：

```typescript
const downloadAuthFailedHandler = (data: { error: string } | undefined) => {
  if (!data) return
  _authFailureSilenceUntil = Date.now() + 30_000
  store.setDownloadQueuePaused(true)
  ElNotification.error({
    title: 'Alist 认证失效',
    message: data.error,
    duration: 0
  })
}
```

在 `downloadFailedHandler` 的清理进度后、批次记录前添加：

```typescript
if (isAuthFailureMessage(data.error) && Date.now() < _authFailureSilenceUntil) {
  return
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd LiuliuCloudStorage && pnpm vitest run tests/unit/composables/useTransferDownload.test.ts`

预期：PASS，批量通知旧测试和认证失败通知新测试全部通过。

- [ ] **步骤 5：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/features/transfer/composables/useTransferDownload.ts tests/unit/composables/useTransferDownload.test.ts
git commit -m "fix: suppress ordinary download notifications for auth failures"
```

---

## 任务 9：最终类型检查、单元测试和构建验证

**文件：**
- 修改：无

- [ ] **步骤 1：运行认证、下载、自动同步相关单元测试**

运行：

```bash
cd LiuliuCloudStorage
pnpm vitest run tests/unit/services/alistAuthError.test.ts tests/unit/services/AuthServiceSessionRecovery.test.ts tests/unit/services/QueueServiceSession.test.ts tests/unit/services/DownloadQueueManager.test.ts tests/unit/services/AutoSyncServiceAuthRecovery.test.ts tests/unit/preloadAuthExpired.test.ts tests/unit/views/LoginView.test.ts tests/unit/views/HomeView.test.ts tests/unit/composables/useTransferDownload.test.ts
```

预期：PASS，所有列出的测试文件通过。

- [ ] **步骤 2：运行全量单元测试**

运行：`cd LiuliuCloudStorage && pnpm test:run`

预期：PASS，全量 Vitest 测试通过。

- [ ] **步骤 3：运行 TypeScript 类型检查**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`

预期：零 TypeScript 错误。

- [ ] **步骤 4：运行构建**

运行：`cd LiuliuCloudStorage && pnpm build`

预期：`electron-vite build` 成功退出，exit code 为 0。

- [ ] **步骤 5：手动验收**

运行：`cd LiuliuCloudStorage && pnpm dev`

验证：
- 登录成功后，Vue devtools 或临时 console 输出中 `useAuthStore().user.token` 非空。
- 启动后下载队列初始化不再读取 `authStore.token`。
- 使用过期 Alist token 恢复队列时，队列保持暂停，显示 `Alist 认证失效`，不会先出现 `队列已恢复`。
- 自动登录凭据有效时，过期 token 被刷新，下载任务继续。
- 自动登录凭据无效时，渲染进程跳转 `/login`。
- 自动同步扫描阶段遇到认证过期时，全局进度卡片显示失败消息 `Alist 登录已过期，请重新登录后重试同步`，不显示 `扫描完成，共 0 个文件`。
- 纯认证失败场景不出现 `下载失败 N 个文件` 通知。

- [ ] **步骤 6：Commit 验证结果**

```bash
cd LiuliuCloudStorage
git commit --allow-empty -m "test: verify Alist session recovery flow"
```

---

## 自检

### 1. 规格覆盖度

| 规格需求 | 对应任务 |
|---|---|
| 主进程成为 Alist token 唯一权威来源 | 任务 2、任务 4、任务 5、任务 6 |
| `LoginView` 保存登录结果 token | 任务 7 |
| `HomeView` 使用 `authStore.user.token` | 任务 7 |
| `getCurrentUser()` 不作为 token 获取路径 | 任务 2、任务 7 |
| 初始化下载队列前确保 session 有效 | 任务 4 |
| 启动下载前确保 session 有效 | 任务 5 |
| `getDownloadUrl()` 认证失败只重试一次 | 任务 5 |
| session 恢复失败不把任务标记普通 failed | 任务 5 |
| 认证失败只发送 auth-failed，不发送普通 download-failed | 任务 5、任务 8 |
| 恢复队列按钮失败时不先提示队列已恢复 | 任务 4、任务 7 |
| 自动同步认证失败不是空扫描成功 | 任务 6 |
| 自动同步 session 恢复成功后重试阶段一次 | 任务 6 |
| 自动同步 session 恢复失败 run 为 failed | 任务 6 |
| 统一 Alist 认证错误分类器 | 任务 1 |
| 主进程通知渲染进程立即跳转登录页 | 任务 2、任务 3 |
| 认证失败通知文案 | 任务 1、任务 5、任务 8 |
| 不新增持久化传输状态或队列 schema | 全部任务均未修改数据库 schema |

**覆盖度：** 100%，无遗漏。

### 2. 占位符扫描

- [x] 无“待定”
- [x] 无空泛“添加错误处理”
- [x] 无“类似任务 N”
- [x] 所有新增函数、类型、事件名在前文任务中定义
- [x] 每个测试步骤给出具体测试代码、命令和预期结果

### 3. 类型一致性

- [x] `AuthSession` 统一包含 `userId`、`username`、`token`、`basePath`
- [x] `ensureValidSession(options?: { forceRefresh?: boolean })` 在 AuthService、QueueService、DownloadQueueManager、AutoSyncService 中签名一致
- [x] 认证失效事件名统一为 `auth:session:expired`
- [x] 下载认证失败事件名仍为 `transfer:download:auth-failed`
- [x] 下载认证失败文案为 `Alist 登录已过期，请重新登录后恢复下载`
- [x] 自动同步认证失败文案为 `Alist 登录已过期，请重新登录后重试同步`

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-05-30-alist-token-session-recovery.md`。两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
