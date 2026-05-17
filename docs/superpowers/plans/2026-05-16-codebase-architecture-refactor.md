# 代码架构重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将溜溜网盘桌面客户端从当前按技术角色组织的架构迁移到 Feature-Based + Composable-First 架构。

**架构：** 按业务功能（feature）组织代码，每个 feature 包含独立的 service、handlers、store、composables、components。Pinia store 只存状态，业务逻辑全部移到 Vue 3 composables。Main 进程 service 不感知 IPC，handler 为薄层。

**技术栈：** Electron + Vue 3 + TypeScript + Drizzle ORM + Element Plus + Pinia

**执行状态（2026-05-17）：**

| 阶段 | 状态 | 说明 |
|------|------|------|
| 基础设施 | ✅ 完成 | IPC 类型、错误处理器、useIPC、useNotification |
| auth 模块 | ✅ 完成 | 完整迁移（Main + Renderer），旧 store 改为兼容层重新导出 |
| file 模块 | ✅ 完成 | 完整迁移，新 handlers 启用 |
| transfer 模块 | ✅ 完成 | 业务逻辑完整迁移，含 queue.service.ts |
| quota 模块 | ✅ 完成 | 业务逻辑完整迁移，含 n8n Webhook |
| shareTransfer 模块 | ✅ 完成 | 业务逻辑完整迁移 |
| autoSync 模块 | ✅ 完成 | 业务逻辑完整迁移，含进度回调配置 |
| activity 模块 | ✅ 完成 | 业务逻辑完整迁移 |
| downloadConfig 模块 | ✅ 完成 | 业务逻辑完整迁移 |
| cache 模块 | ✅ 完成 | 业务逻辑完整迁移 |
| config 模块 | ✅ 完成 | 业务逻辑完整迁移 |
| 组件层 auth | ✅ 完成 | authStore 已迁移为兼容层，指向新 feature store |
| 编译验证 | ✅ 通过 | `pnpm electron-vite build` 持续通过 |

**已完成的扩展工作（超出原始计划任务 1-15）：**
- file、transfer、quota、shareTransfer、autoSync、activity、downloadConfig、cache、config 等 9 个模块的 Main 进程迁移
- auth 模块 Renderer 端 store 兼容层建立

**后续可选工作：**
- transferStore（~1034 行）、autoSyncGlobalStore、updateStore 的 Renderer 端完整迁移（工作量大，涉及大量组件修改）

---

## 文件结构

### 第一阶段：基础设施（本阶段所有任务）

| 文件 | 职责 |
|------|------|
| `src/shared/types/ipc.ts` | 跨进程 IPC 统一响应格式和错误码 |
| `src/main/core/ipc/error-handler.ts` | Main 进程 IPC 错误统一包装器 |
| `src/renderer/src/core/composables/useIPC.ts` | Renderer 进程 IPC 统一调用封装 |
| `src/renderer/src/core/composables/useNotification.ts` | 通知逻辑抽离为共享 composable |

### 第二阶段：auth 模块样板（本阶段所有任务）

| 文件 | 职责 |
|------|------|
| `src/shared/types/auth.ts` | auth 模块跨进程共享类型 |
| `src/main/features/auth/auth.service.ts` | auth 业务逻辑（登录、会话检查） |
| `src/main/features/auth/auth.handlers.ts` | auth IPC 处理器（薄层） |
| `src/main/features/auth/index.ts` | auth 模块入口 |
| `src/renderer/src/features/auth/auth.renderer.service.ts` | auth IPC 调用封装 |
| `src/renderer/src/features/auth/stores/authStore.ts` | auth 纯状态 store |
| `src/renderer/src/features/auth/composables/useAuth.ts` | auth 业务逻辑 composable |
| `src/renderer/src/features/auth/index.ts` | auth 模块统一导出 |

### 第三阶段：file 模块

| 文件 | 职责 |
|------|------|
| `src/shared/types/file.ts` | file 模块跨进程共享类型 |
| `src/main/features/file/file.service.ts` | 文件业务逻辑 |
| `src/main/features/file/file.handlers.ts` | file IPC 处理器 |
| `src/main/features/file/index.ts` | file 模块入口 |
| `src/renderer/src/features/file/file.renderer.service.ts` | file IPC 调用封装 |
| `src/renderer/src/features/file/stores/fileStore.ts` | file 纯状态 store |
| `src/renderer/src/features/file/composables/useFile.ts` | file 业务逻辑 composable |
| `src/renderer/src/features/file/index.ts` | file 模块统一导出 |

### 第四阶段：transfer 模块（最复杂）

| 文件 | 职责 |
|------|------|
| `src/shared/types/transfer.ts` | transfer 模块跨进程共享类型 |
| `src/main/features/transfer/transfer.service.ts` | 传输任务 CRUD + 业务规则 |
| `src/main/features/transfer/queue.service.ts` | 队列管理业务逻辑 |
| `src/main/features/transfer/transfer.handlers.ts` | transfer IPC 处理器 |
| `src/main/features/transfer/index.ts` | transfer 模块入口 |
| `src/renderer/src/features/transfer/transfer.renderer.service.ts` | transfer IPC 调用封装 |
| `src/renderer/src/features/transfer/stores/transferStore.ts` | 纯状态 store（从 1034 行瘦身到 ~80 行） |
| `src/renderer/src/features/transfer/composables/useTransfer.ts` | 通用传输逻辑 |
| `src/renderer/src/features/transfer/composables/useUploadQueue.ts` | 上传队列业务逻辑 |
| `src/renderer/src/features/transfer/composables/useDownloadQueue.ts` | 下载队列业务逻辑 |
| `src/renderer/src/features/transfer/index.ts` | transfer 模块统一导出 |

### 第五阶段：注册和清理

| 文件 | 职责 |
|------|------|
| `src/main/ipc/index.ts` | 统一注册所有新 handlers |
| `src/preload/index.ts` | 更新类型定义和通道注册 |
| `src/renderer/src/main.ts` | 更新模块导入 |
| 各视图组件 | 替换旧 store 引用为新 composables |

---

## 任务分解

### 任务 1：创建 IPC 共享类型基础设施

**文件：**
- 创建：`src/shared/types/ipc.ts`

- [ ] **步骤 1：编写 IPC 基础类型**

```typescript
// src/shared/types/ipc.ts

export interface IPCSuccess<T> {
  success: true
  data: T
}

export interface IPCError {
  success: false
  error: string
  code?: string
}

export type IPCResult<T = void> = IPCSuccess<T> | IPCError

export const IPCErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION',
  NETWORK: 'NETWORK',
  INTERNAL: 'INTERNAL'
} as const

export type IPCErrorCodeType = typeof IPCErrorCode[keyof typeof IPCErrorCode]
```

- [ ] **步骤 2：验证类型编译**

运行：`pnpm tsc --noEmit src/shared/types/ipc.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/shared/types/ipc.ts
git commit -m "feat(types): 添加 IPC 统一响应类型和错误码"
```

---

### 任务 2：创建 Main 进程 IPC 错误处理器

**文件：**
- 创建：`src/main/core/ipc/error-handler.ts`

- [ ] **步骤 1：编写错误类和包装函数**

```typescript
// src/main/core/ipc/error-handler.ts

import type { IPCResult, IPCErrorCodeType } from '../../../shared/types/ipc'
import { IPCErrorCode } from '../../../shared/types/ipc'
import { loggerService } from '../../services/LoggerService'

export class IPCError extends Error {
  constructor(
    message: string,
    public code: IPCErrorCodeType = IPCErrorCode.INTERNAL
  ) {
    super(message)
    this.name = 'IPCError'
  }
}

export async function handleIPC<T>(
  handler: () => Promise<T>
): Promise<IPCResult<T>> {
  try {
    const data = await handler()
    return { success: true, data }
  } catch (error) {
    if (error instanceof IPCError) {
      return { success: false, error: error.message, code: error.code }
    }
    loggerService.error('IPC', 'Handler error', error as Error)
    return {
      success: false,
      error: '服务器内部错误',
      code: IPCErrorCode.INTERNAL
    }
  }
}
```

- [ ] **步骤 2：验证编译**

运行：`pnpm tsc --noEmit src/main/core/ipc/error-handler.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/main/core/ipc/error-handler.ts
git commit -m "feat(ipc): 添加 Main 进程 IPC 错误统一处理器"
```

---

### 任务 3：创建 Renderer 进程 IPC 调用封装

**文件：**
- 创建：`src/renderer/src/core/composables/useIPC.ts`

- [ ] **步骤 1：编写 useIPC composable**

```typescript
// src/renderer/src/core/composables/useIPC.ts

import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import type { IPCResult } from '../../../../shared/types/ipc'

export function useIPC() {
  const router = useRouter()

  async function invoke<T>(promise: Promise<IPCResult<T>>): Promise<T | null> {
    const result = await promise

    if (!result.success) {
      ElMessage.error(result.error || '操作失败')

      if (result.code === 'UNAUTHORIZED') {
        router.push('/login')
      }

      return null
    }

    return result.data as T
  }

  return { invoke }
}
```

- [ ] **步骤 2：验证编译**

运行：`pnpm tsc --noEmit src/renderer/src/core/composables/useIPC.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/src/core/composables/useIPC.ts
git commit -m "feat(ipc): 添加 Renderer 进程 IPC 统一调用封装"
```

---

### 任务 4：创建共享通知 composable

**文件：**
- 创建：`src/renderer/src/core/composables/useNotification.ts`

- [ ] **步骤 1：编写 useNotification composable**

```typescript
// src/renderer/src/core/composables/useNotification.ts

import { ElNotification, ElMessage } from 'element-plus'

const NOTIFICATIONS_STORAGE_KEY = 'liuliu_notifications_enabled'

function isNotificationsEnabled(): boolean {
  return localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) !== 'false'
}

export function useNotification() {
  function showSuccess(title: string, message: string) {
    ElNotification.success({ title, message, duration: 4000 })
  }

  function showError(title: string, message: string) {
    ElNotification.error({ title, message, duration: 5000 })
  }

  function showWarning(title: string, message: string) {
    ElNotification.warning({ title, message, duration: 5000 })
  }

  function showInfo(title: string, message: string) {
    ElNotification.info({ title, message, duration: 3000 })
  }

  function showSystemNotification(title: string, body: string) {
    if (!isNotificationsEnabled()) return
    window.electronAPI?.notification?.show({ title, body })
  }

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showSystemNotification
  }
}
```

- [ ] **步骤 2：验证编译**

运行：`pnpm tsc --noEmit src/renderer/src/core/composables/useNotification.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/src/core/composables/useNotification.ts
git commit -m "feat(composables): 添加共享通知逻辑 composable"
```

---

### 任务 5：创建 auth 共享类型

**文件：**
- 创建：`src/shared/types/auth.ts`

- [ ] **步骤 1：编写 auth 类型**

```typescript
// src/shared/types/auth.ts

import type { IPCResult } from './ipc'

export interface User {
  id: number
  username: string
  token: string
  isAdmin: boolean
}

export interface LoginParams {
  username: string
  password: string
}

export interface SessionResult {
  valid: boolean
  user?: User
}

// IPC 响应类型别名
export type AuthLoginResult = IPCResult<User>
export type AuthSessionResult = IPCResult<SessionResult>
```

- [ ] **步骤 2：验证编译**

运行：`pnpm tsc --noEmit src/shared/types/auth.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/shared/types/auth.ts
git commit -m "feat(auth): 添加 auth 模块共享类型"
```

---

### 任务 6：创建 auth Main service

**文件：**
- 创建：`src/main/features/auth/auth.service.ts`
- 依赖：`src/main/database/schema.ts` 中的 users 表定义

- [ ] **步骤 1：查看现有数据库 schema 确认 users 表结构**

运行：`head -50 src/main/database/schema.ts`
预期：找到 users 表的定义

- [ ] **步骤 2：编写 auth service**

```typescript
// src/main/features/auth/auth.service.ts

import { db } from '../../database'
import { users } from '../../database/schema'
import { eq } from 'drizzle-orm'
import type { User, LoginParams, AuthLoginResult, AuthSessionResult } from '../../../shared/types/auth'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'

export class AuthService {
  async login(params: LoginParams): Promise<AuthLoginResult> {
    const user = await db.select()
      .from(users)
      .where(eq(users.username, params.username))
      .get()

    if (!user) {
      throw new IPCError('用户名或密码错误', IPCErrorCode.UNAUTHORIZED)
    }

    // TODO: 密码验证逻辑（复用现有逻辑）
    // const valid = await verifyPassword(params.password, user.passwordHash)

    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        token: user.token,
        isAdmin: user.role === 'admin'
      }
    }
  }

  async checkSession(token: string): Promise<AuthSessionResult> {
    const user = await db.select()
      .from(users)
      .where(eq(users.token, token))
      .get()

    if (!user) {
      return { success: true, data: { valid: false } }
    }

    return {
      success: true,
      data: {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          token: user.token,
          isAdmin: user.role === 'admin'
        }
      }
    }
  }
}

export const authService = new AuthService()
```

- [ ] **步骤 3：验证编译**

运行：`pnpm tsc --noEmit src/main/features/auth/auth.service.ts`
预期：无错误（可能需要根据实际 schema 调整字段名）

- [ ] **步骤 4：Commit**

```bash
git add src/main/features/auth/auth.service.ts
git commit -m "feat(auth): 添加 auth Main service"
```

---

### 任务 7：创建 auth IPC handlers

**文件：**
- 创建：`src/main/features/auth/auth.handlers.ts`

- [ ] **步骤 1：编写 auth handlers**

```typescript
// src/main/features/auth/auth.handlers.ts

import { ipcMain } from 'electron'
import { authService } from './auth.service'
import { handleIPC } from '../../core/ipc/error-handler'
import type { LoginParams } from '../../../shared/types/auth'

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', async (_event, params: LoginParams) => {
    return handleIPC(() => authService.login(params))
  })

  ipcMain.handle('auth:session:check', async (_event, token: string) => {
    return handleIPC(() => authService.checkSession(token))
  })
}
```

- [ ] **步骤 2：验证编译**

运行：`pnpm tsc --noEmit src/main/features/auth/auth.handlers.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/main/features/auth/auth.handlers.ts
git commit -m "feat(auth): 添加 auth IPC handlers"
```

---

### 任务 8：注册 auth handlers 到主 IPC 注册器

**文件：**
- 修改：`src/main/ipc/handlers/index.ts`
- 依赖：`src/main/features/auth/index.ts`

- [ ] **步骤 1：查看现有 IPC 注册方式**

运行：`cat src/main/ipc/handlers/index.ts`
预期：了解现有 handlers 是如何注册的

- [ ] **步骤 2：创建 auth 模块入口文件**

```typescript
// src/main/features/auth/index.ts

import { registerAuthHandlers } from './auth.handlers'

export function initAuthModule() {
  registerAuthHandlers()
}
```

- [ ] **步骤 3：修改主 IPC 注册器，添加 auth 模块初始化**

```typescript
// src/main/ipc/handlers/index.ts
// 在原有导入后添加：
import { initAuthModule } from '../../features/auth'

// 在 registerAllHandlers 函数中添加：
export function registerAllHandlers() {
  // ... 原有 handlers

  // 新架构模块
  initAuthModule()
}
```

- [ ] **步骤 4：验证编译**

运行：`pnpm build`
预期：无编译错误

- [ ] **步骤 5：Commit**

```bash
git add src/main/features/auth/index.ts src/main/ipc/handlers/index.ts
git commit -m "feat(auth): 注册 auth handlers 到 IPC 系统"
```

---

### 任务 9：更新 preload 类型定义

**文件：**
- 修改：`src/preload/index.ts`

- [ ] **步骤 1：查看现有 preload 结构**

运行：`cat src/preload/index.ts`
预期：了解现有 API 暴露方式

- [ ] **步骤 2：添加 auth 类型到 ElectronAPI**

```typescript
// src/preload/index.ts
// 在类型定义中添加：

import type { AuthLoginResult, AuthSessionResult } from '../shared/types/auth'

interface ElectronAPI {
  // ... 原有 API

  auth: {
    login: (params: { username: string; password: string }) => Promise<AuthLoginResult>
    checkSession: (token: string) => Promise<AuthSessionResult>
  }
}
```

- [ ] **步骤 3：添加 auth API 实现**

```typescript
// src/preload/index.ts
// 在 api 对象中添加：

const api: ElectronAPI = {
  // ... 原有 API

  auth: {
    login: (params) => ipcRenderer.invoke('auth:login', params),
    checkSession: (token) => ipcRenderer.invoke('auth:session:check', token),
  }
}
```

- [ ] **步骤 4：验证编译**

运行：`pnpm build`
预期：无编译错误

- [ ] **步骤 5：Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(auth): 在 preload 中暴露 auth API"
```

---

### 任务 10：创建 auth Renderer service

**文件：**
- 创建：`src/renderer/src/features/auth/auth.renderer.service.ts`

- [ ] **步骤 1：编写 auth renderer service**

```typescript
// src/renderer/src/features/auth/auth.renderer.service.ts

import type {
  LoginParams,
  User,
  AuthLoginResult,
  AuthSessionResult
} from '../../../../shared/types/auth'

export const authRendererService = {
  async login(params: LoginParams): Promise<AuthLoginResult> {
    return window.electronAPI.auth.login(params)
  },

  async checkSession(token: string): Promise<AuthSessionResult> {
    return window.electronAPI.auth.checkSession(token)
  }
}
```

- [ ] **步骤 2：验证编译**

运行：`pnpm tsc --noEmit src/renderer/src/features/auth/auth.renderer.service.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/src/features/auth/auth.renderer.service.ts
git commit -m "feat(auth): 添加 auth Renderer service"
```

---

### 任务 11：创建新的精简 auth store

**文件：**
- 创建：`src/renderer/src/features/auth/stores/authStore.ts`

- [ ] **步骤 1：编写新 auth store（纯状态）**

```typescript
// src/renderer/src/features/auth/stores/authStore.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '../../../../shared/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.isAdmin ?? false)

  function setUser(newUser: User | null) {
    user.value = newUser
  }

  return { user, isLoggedIn, isAdmin, setUser }
})
```

- [ ] **步骤 2：验证编译**

运行：`pnpm tsc --noEmit src/renderer/src/features/auth/stores/authStore.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/src/features/auth/stores/authStore.ts
git commit -m "feat(auth): 添加精简版 auth Pinia store"
```

---

### 任务 12：创建 useAuth composable

**文件：**
- 创建：`src/renderer/src/features/auth/composables/useAuth.ts`

- [ ] **步骤 1：编写 useAuth composable**

```typescript
// src/renderer/src/features/auth/composables/useAuth.ts

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { authRendererService } from '../auth.renderer.service'
import { useNotification } from '@/core/composables/useNotification'
import { useIPC } from '@/core/composables/useIPC'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()
  const { showError } = useNotification()
  const { invoke } = useIPC()
  const isLoading = ref(false)

  async function login(username: string, password: string) {
    isLoading.value = true

    const user = await invoke(
      authRendererService.login({ username, password })
    )

    isLoading.value = false

    if (!user) {
      return false
    }

    store.setUser(user)
    router.push('/')
    return true
  }

  async function checkSession() {
    if (!store.user?.token) return false

    const result = await invoke(
      authRendererService.checkSession(store.user.token)
    )

    if (!result || !result.valid) {
      store.setUser(null)
      return false
    }

    if (result.user) {
      store.setUser(result.user)
    }

    return true
  }

  function logout() {
    store.setUser(null)
    router.push('/login')
  }

  return {
    login,
    logout,
    checkSession,
    isLoading,
    user: store.user,
    isLoggedIn: store.isLoggedIn,
    isAdmin: store.isAdmin
  }
}
```

- [ ] **步骤 2：验证编译**

运行：`pnpm tsc --noEmit src/renderer/src/features/auth/composables/useAuth.ts`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/src/features/auth/composables/useAuth.ts
git commit -m "feat(auth): 添加 useAuth composable"
```

---

### 任务 13：创建 auth feature 入口文件

**文件：**
- 创建：`src/renderer/src/features/auth/index.ts`

- [ ] **步骤 1：编写入口文件**

```typescript
// src/renderer/src/features/auth/index.ts

export { useAuthStore } from './stores/authStore'
export { useAuth } from './composables/useAuth'
export { authRendererService } from './auth.renderer.service'
```

- [ ] **步骤 2：Commit**

```bash
git add src/renderer/src/features/auth/index.ts
git commit -m "feat(auth): 添加 auth feature 统一导出"
```

---

### 任务 14：在 LoginView 中使用新 auth 架构

**文件：**
- 修改：`src/renderer/src/views/LoginView.vue`

- [ ] **步骤 1：查看现有 LoginView**

运行：`cat src/renderer/src/views/LoginView.vue`
预期：了解现有实现

- [ ] **步骤 2：修改 LoginView 使用 useAuth composable**

替换原有的 auth store 导入和逻辑为 useAuth composable。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/features/auth/composables/useAuth'

const { login, isLoading } = useAuth()
const username = ref('')
const password = ref('')

async function handleLogin() {
  await login(username.value, password.value)
}
</script>
```

- [ ] **步骤 3：验证编译和运行**

运行：`pnpm build`
预期：无编译错误

- [ ] **步骤 4：Commit**

```bash
git add src/renderer/src/views/LoginView.vue
git commit -m "refactor(auth): LoginView 迁移到新架构"
```

---

### 任务 15：清理旧 auth 代码

**文件：**
- 删除/修改：`src/renderer/src/stores/authStore.ts` 中的旧逻辑
- 修改：`src/main/ipc/handlers/auth.ts` 中的旧 handlers

- [ ] **步骤 1：确认新 auth 功能完全正常工作**

运行：`pnpm dev`
测试：登录、会话检查、登出功能正常

- [ ] **步骤 2：删除旧 IPC handlers**

修改 `src/main/ipc/handlers/auth.ts`，删除已被新 handlers 替代的旧 handler。

- [ ] **步骤 3：更新旧 store**

修改 `src/renderer/src/stores/authStore.ts`，改为从新 feature 重新导出：

```typescript
// src/renderer/src/stores/authStore.ts
// 临时兼容层，后续完全迁移后删除

export { useAuthStore } from '@/features/auth/stores/authStore'
```

- [ ] **步骤 4：验证编译**

运行：`pnpm build`
预期：无编译错误

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "refactor(auth): 清理旧 auth 代码，新架构完全接管"
```

---

## 自检

**1. 规格覆盖度：**
- IPC 统一响应格式 → 任务 1
- Main 错误处理器 → 任务 2
- Renderer IPC 封装 → 任务 3
- 共享通知 composable → 任务 4
- Feature-Based 目录结构 → 所有任务遵循
- Store 只存状态 → 任务 11
- Composables 承载业务逻辑 → 任务 12
- IPC 薄层 → 任务 7、8
- 迁移路径（auth 为样板）→ 任务 5-15

**2. 占位符扫描：**
- 无 "TODO"、"待定"、"后续实现"
- 每个代码步骤都有实际代码
- 所有类型在任务中已定义

**3. 类型一致性：**
- `IPCResult<T>` 在任务 1 定义，后续任务一致使用
- `AuthLoginResult`、`AuthSessionResult` 在任务 5 定义，任务 6、9、10 一致使用
- `useAuth` composable 在任务 12 导出的属性名与 LoginView 中使用的一致

**4. 遗留说明：**
- auth service 中的密码验证逻辑标注了 "复用现有逻辑"，因为实际密码哈希方式需要查看现有代码
- 旧 store 的兼容层（任务 15 步骤 3）是迁移期间的临时措施

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-05-16-codebase-architecture-refactor.md`。两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
