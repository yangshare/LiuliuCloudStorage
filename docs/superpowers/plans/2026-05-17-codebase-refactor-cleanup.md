# 架构重构收尾工作实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复三个未达标的架构问题：auth store 含业务逻辑、旧 IPC handlers 未迁移到 feature 目录、transfer handlers 过于臃肿。

**架构：** 严格遵循 Feature-Based + Composable-First 原则：Store 只存状态，业务逻辑在 composable/service，handler 只做解包→调用→包装。

**技术栈：** Electron + Vue 3 + TypeScript + Drizzle ORM + Pinia

---

## 文件结构

### 阶段 1：auth store 清理 + 旧 handler 迁移

**修改文件：**
- `src/renderer/src/features/auth/stores/authStore.ts` — 移除 async IPC 调用，只保留状态和同步 setter
- `src/renderer/src/features/auth/composables/useAuth.ts` — 添加 logout、checkAdminPermission、initializeAuth
- `src/renderer/src/router/index.ts` — 替换 authStore 调用为 useAuth() 调用
- `src/renderer/src/views/SettingsView.vue` — 替换 authStore.logout() 为 useAuth().logout()
- `src/renderer/src/views/AdminView.vue` — 替换 authStore.checkAdminPermission() 为 useAuth().checkAdminPermission()
- `src/main/ipc/index.ts` — 移除旧 handler import，改为 feature-based init

**创建文件：**
- `src/main/features/app/app.service.ts` — 开机启动、日志目录等纯业务逻辑
- `src/main/features/app/app.handlers.ts` — 薄 handler 层
- `src/main/features/app/index.ts` — 模块导出
- `src/main/features/dialog/dialog.service.ts` — 文件选择对话框逻辑
- `src/main/features/dialog/dialog.handlers.ts` — 薄 handler 层
- `src/main/features/dialog/index.ts` — 模块导出
- `src/main/features/tray/tray.handlers.ts` — 托盘 IPC handler
- `src/main/features/tray/index.ts` — 模块导出
- `src/main/features/notification/notification.handlers.ts` — 通知 IPC handler
- `src/main/features/notification/index.ts` — 模块导出
- `src/main/features/update/update.handlers.ts` — 更新 IPC handler
- `src/main/features/update/index.ts` — 模块导出

**删除文件：**
- `src/main/ipc/handlers/app.ts`
- `src/main/ipc/handlers/dialog.ts`
- `src/main/ipc/handlers/tray.ts`
- `src/main/ipc/handlers/notification.ts`
- `src/main/ipc/handlers/update.ts`
- `src/main/ipc/handlers/index.ts`

### 阶段 2：transfer handler 瘦身

**修改文件：**
- `src/main/features/transfer/transfer.service.ts` — 添加上传、下载、保存对话框方法
- `src/main/features/transfer/queue.service.ts` — 添加 restoreQueue、resumeTask、batchQueueDownload 等方法
- `src/main/features/transfer/transfer.handlers.ts` — 从 353 行精简到 ~120 行

---

## 任务 1：authStore 移除业务逻辑

**文件：**
- 修改：`src/renderer/src/features/auth/stores/authStore.ts`

**上下文：** 当前 authStore 包含 `logout()`、`checkAdminPermission()`、`triggerStartupAutoSync()`、`initUserFromSession()` 四个 async 函数，直接调用 IPC。目标是将 Store 精简为纯状态和同步 setter。

- [ ] **步骤 1：修改 authStore，只保留状态和同步 setter**

```typescript
// src/renderer/src/features/auth/stores/authStore.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SessionCheckResult } from '../auth.renderer.service'

export interface User {
  id: number
  username: string
  token: string
  isAdmin?: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const startupAutoSyncTriggered = ref(false)

  const isLoggedIn = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.isAdmin ?? false)

  function setUser(userData: { id: number; username: string; token: string; isAdmin?: number | boolean } | null) {
    if (userData === null) {
      user.value = null
      return
    }
    user.value = {
      id: userData.id,
      username: userData.username,
      token: userData.token,
      isAdmin: typeof userData.isAdmin === 'boolean' ? userData.isAdmin : userData.isAdmin === 1
    }
  }

  function setUserFromSession(session: SessionCheckResult) {
    if (session.valid && session.user) {
      setUser({
        id: session.user.id,
        username: session.user.username,
        token: session.user.token || '',
        isAdmin: session.user.isAdmin
      })
      return true
    }

    if (session.valid && session.username) {
      setUser({
        id: 0,
        username: session.username,
        token: '',
        isAdmin: false
      })
      return true
    }

    return false
  }

  function clearUser() {
    user.value = null
    startupAutoSyncTriggered.value = false
  }

  function markAutoSyncTriggered() {
    startupAutoSyncTriggered.value = true
  }

  return {
    user,
    isLoggedIn,
    isAdmin,
    startupAutoSyncTriggered,
    setUser,
    setUserFromSession,
    clearUser,
    markAutoSyncTriggered
  }
})
```

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`cd LiuliuCloudStorage && pnpm exec vue-tsc --noEmit --project src/renderer/tsconfig.json`
预期：无 authStore 相关报错（其他不相关报错可忽略）

---

## 任务 2：useAuth composable 添加业务逻辑

**文件：**
- 修改：`src/renderer/src/features/auth/composables/useAuth.ts`

- [ ] **步骤 1：扩展 useAuth composable**

```typescript
// src/renderer/src/features/auth/composables/useAuth.ts

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth'
import { authRendererService } from '../auth.renderer.service'
import { ElMessage } from 'element-plus'
import type { SessionCheckResult } from '../auth.renderer.service'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()
  const isLoading = ref(false)

  async function login(username: string, password: string, autoLogin: boolean = false) {
    isLoading.value = true
    try {
      const result = await authRendererService.login(username, password, autoLogin)
      if (result.success) {
        const userResult = await authRendererService.getCurrentUser()
        if (userResult?.success && userResult.data) {
          store.setUser({
            id: userResult.data.id,
            username: userResult.data.username,
            token: userResult.data.token || '',
            isAdmin: userResult.data.isAdmin
          })
        }
        await handlePostLogin()
        ElMessage.success('登录成功')
        router.push('/')
        return true
      } else {
        ElMessage.error(result.message || '登录失败')
        return false
      }
    } catch (error) {
      ElMessage.error('网络错误，请稍后重试')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function checkSession() {
    const result = await authRendererService.checkSession()
    if (!result.valid) {
      store.clearUser()
      return false
    }
    return true
  }

  async function initializeAuth(session: SessionCheckResult) {
    const initialized = store.setUserFromSession(session)
    if (initialized) {
      await handlePostLogin()
    }
  }

  async function handlePostLogin() {
    if (store.startupAutoSyncTriggered || !store.user?.id) return
    store.markAutoSyncTriggered()

    try {
      const result = await window.electronAPI.autoSync.startupRun({
        userId: store.user.id
      })
      if (result?.success && result.executed > 0) {
        console.log(`[autoSync] 启动自动同步完成: ${result.executed}/${result.total}`)
      }
    } catch (error) {
      console.warn('[autoSync] 启动自动同步失败:', error)
    }
  }

  async function logout() {
    try {
      await authRendererService.logout()
    } finally {
      store.clearUser()
      router.push('/login')
    }
  }

  async function checkAdminPermission(): Promise<boolean> {
    if (!store.isLoggedIn) {
      return false
    }
    try {
      const result = await authRendererService.getUsers()
      return result?.success ?? false
    } catch {
      return false
    }
  }

  return {
    login,
    logout,
    checkSession,
    initializeAuth,
    checkAdminPermission,
    isLoading,
    user: store.user,
    isLoggedIn: store.isLoggedIn,
    isAdmin: store.isAdmin
  }
}
```

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`cd LiuliuCloudStorage && pnpm exec vue-tsc --noEmit --project src/renderer/tsconfig.json`
预期：无 useAuth 相关报错

---

## 任务 3：替换所有 authStore 业务方法调用

**文件：**
- 修改：`src/renderer/src/router/index.ts`
- 修改：`src/renderer/src/views/SettingsView.vue`
- 修改：`src/renderer/src/views/AdminView.vue`

- [ ] **步骤 1：修改 router/index.ts**

在 router guard 中，将 `authStore.initUserFromSession` 替换为 `useAuth().initializeAuth()`，将 `authStore.checkAdminPermission()` 替换为 `useAuth().checkAdminPermission()`。

在 router/index.ts 中，找到导航守卫部分（约第 99-122 行），修改如下：

```typescript
// 在文件顶部已有的 import 中，添加 useAuth
import { useAuth } from '@/features/auth'

// 在导航守卫中（约第 105-118 行）
// 修改前：
//   authStore.initUserFromSession(session)
// 修改后：
    const auth = useAuth()
    await auth.initializeAuth(session)

// 修改前：
//   const hasPermission = await authStore.checkAdminPermission()
// 修改后：
      const hasPermission = await auth.checkAdminPermission()
```

**注意**：由于 `useAuth()` 使用了 `useRouter()`，不能在路由守卫顶层调用。需要改为在守卫函数内部调用。但 Pinia store 可以在任意位置使用。解决方案：在守卫中直接使用 `authRendererService` 进行权限检查，或在守卫中条件式创建 useAuth（仅在需要时）。

更安全的方案：在 router 中直接使用 authRendererService 进行异步操作，保持 store 只做状态。

```typescript
// router/index.ts 导航守卫中的修改

import { normalizeSessionCheckResult } from '@/features/auth/auth.renderer.service'
import { authRendererService } from '@/features/auth/auth.renderer.service'

// 第 105 行附近
  if (!authStore.user) {
    const initialized = authStore.setUserFromSession(session)
    if (initialized && authStore.user?.id) {
      // 启动自动同步（ fire-and-forget，不阻塞导航）
      window.electronAPI.autoSync.startupRun({ userId: authStore.user.id })
        .then((result: any) => {
          if (result?.success && result.executed > 0) {
            console.log(`[autoSync] 启动自动同步完成: ${result.executed}/${result.total}`)
          }
        })
        .catch((error: any) => {
          console.warn('[autoSync] 启动自动同步失败:', error)
        })
    }
  }

// 第 113 行附近
  if (to.meta.requiresAdmin) {
    if (!authStore.isAdmin) {
      try {
        const result = await authRendererService.getUsers()
        if (!result?.success) {
          console.warn('权限不足：仅管理员可以访问此页面')
          return '/'
        }
      } catch {
        console.warn('权限不足：仅管理员可以访问此页面')
        return '/'
      }
    }
  }
```

- [ ] **步骤 2：修改 SettingsView.vue**

将 `authStore.logout()` 替换为 `useAuth().logout()`。

在 SettingsView.vue 中（约第 218-263 行）：

```typescript
// 修改 import
import { useAuth } from '@/features/auth'

// 替换 const authStore = useAuthStore()
const auth = useAuth()

// 在 handleLogout 中
await auth.logout()
```

- [ ] **步骤 3：修改 AdminView.vue**

```typescript
// 修改 import
import { useAuth } from '@/features/auth'

// 替换 const authStore = useAuthStore()
const auth = useAuth()

// 在 onMounted 中
const isAdmin = await auth.checkAdminPermission()
```

- [ ] **步骤 4：验证 TypeScript 编译**

运行：`cd LiuliuCloudStorage && pnpm exec vue-tsc --noEmit --project src/renderer/tsconfig.json`
预期：无 auth 相关报错

- [ ] **步骤 5：Commit**

```bash
cd LiuliuCloudStorage
git add -A
git commit -m "refactor: auth store 清理，业务逻辑移到 composable"
```

---

## 任务 4：迁移 app handler 到 feature 目录

**文件：**
- 创建：`src/main/features/app/app.service.ts`
- 创建：`src/main/features/app/app.handlers.ts`
- 创建：`src/main/features/app/index.ts`

- [ ] **步骤 1：创建 app.service.ts**

```typescript
// src/main/features/app/app.service.ts

import { app, shell } from 'electron'
import { loggerService } from '../../services/LoggerService'
import { handleIPC } from '../../core/ipc/error-handler'

export class AppService {
  setLoginItemSettings(openAtLogin: boolean) {
    return handleIPC(async () => {
      app.setLoginItemSettings({
        openAtLogin,
        openAsHidden: true,
        name: '溜溜网盘'
      })
      return { success: true }
    })
  }

  getLoginItemSettings() {
    return handleIPC(async () => {
      const settings = app.getLoginItemSettings()
      return { success: true, openAtLogin: settings.openAtLogin }
    })
  }

  async openLogsDirectory() {
    return handleIPC(async () => {
      const logsDir = loggerService.getLogsDir()
      await shell.openPath(logsDir)
      return { success: true }
    })
  }

  getVersion() {
    return app.getVersion()
  }
}

export const appService = new AppService()
```

- [ ] **步骤 2：创建 app.handlers.ts**

```typescript
// src/main/features/app/app.handlers.ts

import { ipcMain } from 'electron'
import { appService } from './app.service'

export function registerAppHandlers(): void {
  ipcMain.handle('app:set-login-item-settings', (_, settings: { openAtLogin: boolean }) => {
    return appService.setLoginItemSettings(settings.openAtLogin)
  })

  ipcMain.handle('app:get-login-item-settings', () => {
    return appService.getLoginItemSettings()
  })

  ipcMain.handle('app:open-logs-directory', async () => {
    return appService.openLogsDirectory()
  })

  ipcMain.handle('app:getVersion', () => {
    return appService.getVersion()
  })
}
```

- [ ] **步骤 3：创建 app/index.ts**

```typescript
// src/main/features/app/index.ts

import { registerAppHandlers } from './app.handlers'

export function initAppModule() {
  registerAppHandlers()
}
```

---

## 任务 5：迁移 dialog handler 到 feature 目录

**文件：**
- 创建：`src/main/features/dialog/dialog.service.ts`
- 创建：`src/main/features/dialog/dialog.handlers.ts`
- 创建：`src/main/features/dialog/index.ts`

- [ ] **步骤 1：创建 dialog.service.ts**

```typescript
// src/main/features/dialog/dialog.service.ts

import { dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { handleIPC } from '../../core/ipc/error-handler'

interface FileInfo {
  name: string
  path: string
  size: number
  isDirectory: boolean
}

function getFilesRecursively(dirPath: string): FileInfo[] {
  const results: FileInfo[] = []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      results.push(...getFilesRecursively(fullPath))
    } else {
      const stats = fs.statSync(fullPath)
      results.push({
        name: entry.name,
        path: fullPath,
        size: stats.size,
        isDirectory: false
      })
    }
  }
  return results
}

export class DialogService {
  async openFile(options?: { directory?: boolean }) {
    return handleIPC(async () => {
      const win = BrowserWindow.getFocusedWindow()
      const properties: ('openFile' | 'multiSelections' | 'openDirectory')[] = ['multiSelections']

      if (options?.directory) {
        properties.push('openDirectory')
      } else {
        properties.push('openFile')
      }

      const result = await dialog.showOpenDialog(win!, { properties })

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, files: [] }
      }

      const files: FileInfo[] = []
      for (const filePath of result.filePaths) {
        const stats = fs.statSync(filePath)
        if (stats.isDirectory()) {
          files.push(...getFilesRecursively(filePath))
        } else {
          files.push({
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
            isDirectory: false
          })
        }
      }

      return { canceled: false, files }
    })
  }
}

export const dialogService = new DialogService()
```

- [ ] **步骤 2：创建 dialog.handlers.ts**

```typescript
// src/main/features/dialog/dialog.handlers.ts

import { ipcMain } from 'electron'
import { dialogService } from './dialog.service'

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:openFile', async (_event, options?: { directory?: boolean }) => {
    return dialogService.openFile(options)
  })
}
```

- [ ] **步骤 3：创建 dialog/index.ts**

```typescript
// src/main/features/dialog/index.ts

import { registerDialogHandlers } from './dialog.handlers'

export function initDialogModule() {
  registerDialogHandlers()
}
```

---

## 任务 6：迁移 tray handler 到 feature 目录

**文件：**
- 创建：`src/main/features/tray/tray.handlers.ts`
- 创建：`src/main/features/tray/index.ts`

- [ ] **步骤 1：创建 tray.handlers.ts**

```typescript
// src/main/features/tray/tray.handlers.ts

import { ipcMain } from 'electron'
import { trayService } from '../../services/TrayService'

export function registerTrayHandlers(): void {
  ipcMain.handle('tray:update-transfer-status', (_, isTransferring: boolean) => {
    trayService.updateIcon(isTransferring)
  })

  ipcMain.handle(
    'tray:update-transfer-counts',
    (_, uploadCount: number, downloadCount: number) => {
      trayService.updateContextMenu(uploadCount, downloadCount)
    }
  )

  ipcMain.handle('tray:show-window', () => {
    trayService.updateContextMenu()
  })

  ipcMain.handle('tray:hide-window', () => {
    // 托盘服务内部处理
  })
}
```

- [ ] **步骤 2：创建 tray/index.ts**

```typescript
// src/main/features/tray/index.ts

import { registerTrayHandlers } from './tray.handlers'

export function initTrayModule() {
  registerTrayHandlers()
}
```

---

## 任务 7：迁移 notification handler 到 feature 目录

**文件：**
- 创建：`src/main/features/notification/notification.handlers.ts`
- 创建：`src/main/features/notification/index.ts`

- [ ] **步骤 1：创建 notification.handlers.ts**

```typescript
// src/main/features/notification/notification.handlers.ts

import { ipcMain, app } from 'electron'
import { notificationService } from '../../services/NotificationService'

export function registerNotificationHandlers(): void {
  ipcMain.handle('notification:show', (_, options: { title: string; body: string }) => {
    notificationService.show(options.title, options.body, 'info')
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })
}
```

- [ ] **步骤 2：创建 notification/index.ts**

```typescript
// src/main/features/notification/index.ts

import { registerNotificationHandlers } from './notification.handlers'

export function initNotificationModule() {
  registerNotificationHandlers()
}
```

---

## 任务 8：迁移 update handler 到 feature 目录

**文件：**
- 创建：`src/main/features/update/update.handlers.ts`
- 创建：`src/main/features/update/index.ts`

- [ ] **步骤 1：创建 update.handlers.ts**

```typescript
// src/main/features/update/update.handlers.ts

import { ipcMain } from 'electron'
import { updateService } from '../../services/UpdateService'

export function registerUpdateHandlers() {
  ipcMain.handle('update:check', async () => {
    await updateService.checkForUpdates()
  })

  ipcMain.handle('update:install-now', () => {
    updateService.installNow()
  })

  ipcMain.handle('update:install-on-quit', () => {
    updateService.installOnQuit()
  })
}
```

- [ ] **步骤 2：创建 update/index.ts**

```typescript
// src/main/features/update/index.ts

import { registerUpdateHandlers } from './update.handlers'

export function initUpdateModule() {
  registerUpdateHandlers()
}
```

---

## 任务 9：更新 IPC 注册入口并删除旧 handlers

**文件：**
- 修改：`src/main/ipc/index.ts`
- 删除：`src/main/ipc/handlers/` 目录

- [ ] **步骤 1：修改 ipc/index.ts**

```typescript
// src/main/ipc/index.ts

import { initAppModule } from '../features/app'
import { initDialogModule } from '../features/dialog'
import { initTrayModule } from '../features/tray'
import { initNotificationModule } from '../features/notification'
import { initUpdateModule } from '../features/update'
import { initAuthModule } from '../features/auth'
import { initFileModule } from '../features/file'
import { initTransferModule } from '../features/transfer'
import { initQuotaModule } from '../features/quota'
import { initShareTransferModule } from '../features/shareTransfer'
import { initAutoSyncModule } from '../features/autoSync'
import { initActivityModule } from '../features/activity'
import { initDownloadConfigModule } from '../features/downloadConfig'
import { initCacheModule } from '../features/cache'
import { initConfigModule } from '../features/config'

export function registerAllHandlers(): void {
  initAppModule()
  initDialogModule()
  initTrayModule()
  initNotificationModule()
  initUpdateModule()
  initAuthModule()
  initFileModule()
  initTransferModule()
  initQuotaModule()
  initShareTransferModule()
  initAutoSyncModule()
  initActivityModule()
  initDownloadConfigModule()
  initCacheModule()
  initConfigModule()
}
```

- [ ] **步骤 2：删除旧 handlers 目录**

```bash
cd LiuliuCloudStorage
rm -rf src/main/ipc/handlers
```

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`cd LiuliuCloudStorage && pnpm exec tsc --noEmit`
预期：无 ipc handlers 相关报错

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add -A
git commit -m "refactor: 迁移旧 IPC handlers 到 feature 目录"
```

---

## 任务 10：transfer.service.ts 添加上传/下载/保存方法

**文件：**
- 修改：`src/main/features/transfer/transfer.service.ts`

**上下文：** 当前 `transfer.service.ts` 只包含数据库 CRUD 操作。需要将 `transfer.handlers.ts` 中的上传、下载、保存对话框等业务逻辑下沉到这里。

- [ ] **步骤 1：修改 transfer.service.ts，添加上传方法**

在 `transfer.service.ts` 文件末尾（`toTransferTask` 方法之前），添加：

```typescript
  // ========== 上传 ==========

  async uploadFile(
    params: {
      filePath: string
      remotePath: string
      userId: number
      userToken: string
      localTaskId: string
    },
    onProgress?: (data: { taskId: string; progress: number; transferredSize: number }) => void
  ) {
    return handleIPC(async () => {
      const { alistService } = await import('../../services/AlistService')
      const { orchestrationService } = await import('../../services/OrchestrationService')
      const fs = await import('fs')
      const path = await import('path')

      alistService.setToken(params.userToken)
      alistService.setBasePath('/alist/')
      alistService.setUserId(params.userId)

      const fileStats = fs.statSync(params.filePath)
      const fileName = path.basename(params.filePath)

      const uploadResult = await alistService.uploadFile(params.filePath, params.remotePath)
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '上传失败')
      }

      let lastProgress = 0
      const success = await orchestrationService.waitForTaskCompletion(
        uploadResult.taskId!,
        (progress) => {
          if (progress !== lastProgress && onProgress) {
            const transferredSize = Math.floor((fileStats.size * progress) / 100)
            onProgress({
              taskId: params.localTaskId,
              progress,
              transferredSize
            })
            lastProgress = progress
          }
        }
      )

      return {
        success,
        taskId: uploadResult.taskId,
        fileInfo: {
          fileName,
          fileSize: fileStats.size,
          remotePath: `${alistService.getBasePath()}${params.remotePath}`,
          uploadedAt: new Date().toISOString()
        }
      }
    })
  }
```

- [ ] **步骤 2：添加下载方法**

```typescript
  // ========== 下载 ==========

  async downloadFile(
    params: {
      remotePath: string
      fileName: string
      userId: number
      userToken: string
      savePath?: string
    },
    onProgress?: (data: {
      taskId: string
      fileName: string
      progress: number
      downloadedBytes: number
      totalBytes: number
      speed: number
    }) => void,
    onCompleted?: (data: { taskId: string; fileName: string; savePath: string }) => void,
    onFailed?: (data: { taskId: string; fileName: string; error: string }) => void
  ) {
    return handleIPC(async () => {
      const { alistService } = await import('../../services/AlistService')
      const { DownloadManager } = await import('../../services/DownloadManager')
      const path = await import('path')

      alistService.setToken(params.userToken)
      alistService.setBasePath('/alist/')
      alistService.setUserId(params.userId)

      const downloadResult = await alistService.getDownloadUrl(params.remotePath)
      if (!downloadResult.success) {
        throw new Error(downloadResult.error || '获取下载链接失败')
      }

      const downloadManager = new DownloadManager()
      const savePath = params.savePath || path.join(downloadManager.getDefaultDownloadPath(), params.fileName)
      const taskId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      downloadManager.startDownload({
        id: taskId,
        url: downloadResult.rawUrl!,
        savePath,
        fileName: downloadResult.fileName!,
        fileSize: downloadResult.fileSize!,
        userId: params.userId,
        userToken: params.userToken,
        remotePath: params.remotePath
      }, (progress) => {
        if (onProgress) {
          onProgress({
            taskId,
            fileName: downloadResult.fileName!,
            progress: progress.percentage,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
            speed: progress.speed
          })
        }
      }).then((actualSavePath) => {
        if (onCompleted) {
          onCompleted({
            taskId,
            fileName: downloadResult.fileName!,
            savePath: actualSavePath
          })
        }
      }).catch((error) => {
        if (onFailed) {
          onFailed({
            taskId,
            fileName: downloadResult.fileName!,
            error: error.message
          })
        }
      })

      return { success: true, taskId, savePath }
    })
  }
```

- [ ] **步骤 3：添加保存对话框方法**

```typescript
  // ========== 保存对话框 ==========

  async saveAs(fileName: string, userId: number) {
    return handleIPC(async () => {
      const { dialog } = await import('electron')
      const { DownloadManager } = await import('../../services/DownloadManager')
      const { preferencesService } = await import('../../services/PreferencesService')
      const path = await import('path')

      const downloadManager = new DownloadManager()
      const lastPath = preferencesService.getLastDownloadPath(userId)
      const defaultPath = lastPath
        ? path.join(lastPath, fileName)
        : path.join(downloadManager.getDefaultDownloadPath(), fileName)

      const result = await dialog.showSaveDialog({
        title: '选择下载保存位置',
        defaultPath,
        buttonLabel: '保存',
        filters: [{ name: 'All Files', extensions: ['*'] }],
        properties: ['createDirectory']
      })

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      const selectedDir = path.dirname(result.filePath)
      preferencesService.saveLastDownloadPath(userId, selectedDir)

      return { success: true, savePath: result.filePath }
    })
  }
```

- [ ] **步骤 4：添加恢复下载方法**

```typescript
  async resumeDownload(
    taskId: string,
    onProgress?: (data: {
      taskId: string
      progress: number
      downloadedBytes: number
      totalBytes: number
      speed: number
    }) => void,
    onCompleted?: (data: { taskId: string; fileName: string; savePath: string }) => void
  ) {
    return handleIPC(async () => {
      const { DownloadManager } = await import('../../services/DownloadManager')
      const downloadManager = new DownloadManager()
      const taskInfo = await this.getTask(Number(taskId))

      await downloadManager.resumeDownload(taskId, (progress) => {
        if (onProgress) {
          onProgress({
            taskId,
            progress: progress.percentage,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
            speed: progress.speed
          })
        }
      })

      if (onCompleted) {
        onCompleted({
          taskId,
          fileName: taskInfo?.fileName || '',
          savePath: taskInfo?.filePath || ''
        })
      }

      return { success: true }
    })
  }
```

---

## 任务 11：queue.service.ts 添加队列管理方法

**文件：**
- 修改：`src/main/features/transfer/queue.service.ts`

- [ ] **步骤 1：添加 restoreQueue 方法**

```typescript
  async restoreUploadQueue(userId: number, userToken: string, username: string) {
    const { transferService } = await import('./transfer.service')
    const tasks = await transferService.getRecoverableTasks(userId)
    for (const task of tasks) {
      await this.addUploadTask({
        id: task.id,
        filePath: task.filePath,
        remotePath: task.remotePath,
        userId: task.userId,
        userToken,
        username,
        fileName: task.fileName,
        fileSize: task.fileSize
      })
    }
    return { restored: tasks.length }
  }
```

- [ ] **步骤 2：添加 resumeUploadTask 方法**

```typescript
  async resumeUploadTask(taskId: number, userToken: string, username: string) {
    const { transferService } = await import('./transfer.service')
    const task = await transferService.getTask(taskId)
    if (!task) throw new Error('任务不存在')
    if (!task.resumable) throw new Error('该任务不支持恢复')

    await transferService.resumeTask(taskId)
    await this.addUploadTask({
      id: task.id,
      filePath: task.filePath,
      remotePath: task.remotePath,
      userId: task.userId,
      userToken,
      username,
      fileName: task.fileName,
      fileSize: task.fileSize
    })

    return { success: true }
  }
```

- [ ] **步骤 3：添加 queueDownloadWithSession 和 batchQueueDownloadWithSession 方法**

```typescript
  async queueDownloadWithSession(taskData: any) {
    const { authService } = await import('../auth/auth.service')
    const session = authService.getCurrentSession()
    if (!session) throw new Error('用户未登录')

    const task: DownloadQueueTask = {
      id: taskData.id || `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: taskData.fileName,
      fileSize: taskData.fileSize || 0,
      remotePath: taskData.remotePath,
      savePath: taskData.savePath,
      priority: taskData.priority || 0,
      userId: session.userId,
      userToken: session.token
    }

    const dbId = await this.addDownloadTask(task)
    return { success: true, taskId: task.id, dbId }
  }

  async batchQueueDownloadWithSession(remotePaths: string[]) {
    const { authService } = await import('../auth/auth.service')
    const session = authService.getCurrentSession()
    if (!session) throw new Error('用户未登录')

    const tasks: DownloadQueueTask[] = remotePaths.map((remotePath, i) => ({
      id: `download_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: remotePath.split('/').pop() || 'unknown',
      fileSize: 0,
      remotePath,
      priority: i,
      userId: session.userId,
      userToken: session.token
    }))

    const batchResult = await this.addBatchDownloadTasks(tasks)
    return { success: true, successCount: batchResult.length, failedCount: 0 }
  }
```

- [ ] **步骤 4：添加 cancelDownloadTask 方法**

```typescript
  async cancelDownloadTask(taskId: string) {
    const { DownloadManager } = await import('../../services/DownloadManager')
    const { transferService } = await import('./transfer.service')
    const downloadManager = new DownloadManager()
    await downloadManager.cancelDownload(taskId)
    await transferService.cancelTask(Number(taskId))
    await this.removeDownloadFromQueue(taskId)
    return { success: true }
  }
```

---

## 任务 12：精简 transfer.handlers.ts

**文件：**
- 修改：`src/main/features/transfer/transfer.handlers.ts`

**上下文：** 当前 353 行，目标 120-150 行。每个 handler 只做解包参数 → 调用 service → 包装响应。

- [ ] **步骤 1：重写 transfer.handlers.ts**

```typescript
// src/main/features/transfer/transfer.handlers.ts

import { ipcMain } from 'electron'
import { transferService } from './transfer.service'
import { queueService } from './queue.service'
import { handleIPC } from '../../core/ipc/error-handler'
import type { QueueTask } from '../../services/TransferQueueManager'

export function registerTransferHandlers(): void {
  // ========== 直接上传 ==========
  ipcMain.handle('transfer:upload', async (_event, { filePath, remotePath, userId, userToken, username: _username, localTaskId }) => {
    const onProgress = (data: any) => _event.sender.send('transfer:progress', data)
    return transferService.uploadFile({ filePath, remotePath, userId, userToken, localTaskId }, onProgress)
  })

  // ========== 队列管理（上传） ==========
  ipcMain.handle('transfer:add-to-queue', async (_event, task: QueueTask) => {
    return handleIPC(async () => {
      await queueService.addUploadTask(task)
      return { success: true }
    })
  })

  ipcMain.handle('transfer:queue-status', async () => {
    return handleIPC(async () => queueService.getUploadQueueStatus())
  })

  // ========== 任务列表 ==========
  ipcMain.handle('transfer:list', async (_event, userId: number) => {
    return transferService.getTasksByUser(userId)
  })

  // ========== 恢复队列 ==========
  ipcMain.handle('transfer:restore-queue', async (_event, { userId, userToken, username }) => {
    return queueService.restoreUploadQueue(userId, userToken, username)
  })

  // ========== 直接下载 ==========
  ipcMain.handle('transfer:download', async (_event, { remotePath, fileName, userId, userToken, username: _username, savePath: customSavePath }) => {
    const onProgress = (data: any) => _event.sender.send('transfer:download-progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download-completed', data)
    const onFailed = (data: any) => _event.sender.send('transfer:download-failed', data)
    return transferService.downloadFile({ remotePath, fileName, userId, userToken, savePath: customSavePath }, onProgress, onCompleted, onFailed)
  })

  // ========== 另存为 ==========
  ipcMain.handle('transfer:saveAs', async (_event, { fileName, userId }) => {
    return transferService.saveAs(fileName, userId)
  })

  // ========== 取消上传 ==========
  ipcMain.handle('transfer:cancel', async (_event, taskId: number) => {
    return handleIPC(async () => queueService.cancelUploadTask(taskId))
  })

  // ========== 恢复上传 ==========
  ipcMain.handle('transfer:resume', async (_event, { taskId, userToken, username }) => {
    return queueService.resumeUploadTask(taskId, userToken, username)
  })

  // ========== 自动重试所有失败任务 ==========
  ipcMain.handle('transfer:auto-retry-all', async (_event, { userId, userToken, username }) => {
    return handleIPC(async () => {
      const count = await queueService.autoRetryAllUploads(userId, userToken, username)
      return { success: true, retriedCount: count }
    })
  })

  // ========== 下载队列管理 ==========
  ipcMain.handle('transfer:initDownloadQueue', async (_event, { userId, userToken }) => {
    return handleIPC(async () => {
      queueService.setDownloadCredentials(userId, userToken)
      const restoredCount = await queueService.restoreDownloadQueue(userId, userToken)
      const { downloadQueueManager } = await import('../../services/DownloadQueueManager')
      downloadQueueManager.setProgressCallback((data) => {
        _event.sender.send('transfer:download-progress', data)
      })
      return { success: true, restoredCount }
    })
  })

  ipcMain.handle('transfer:queueDownload', async (_event, taskData) => {
    return queueService.queueDownloadWithSession(taskData)
  })

  ipcMain.handle('transfer:batchQueueDownload', async (_event, { remotePaths }: { remotePaths: string[] }) => {
    return queueService.batchQueueDownloadWithSession(remotePaths)
  })

  ipcMain.handle('transfer:getDownloadQueue', async () => {
    return handleIPC(async () => {
      const state = await queueService.getDownloadQueueState()
      return { success: true, state }
    })
  })

  ipcMain.handle('transfer:pauseDownloadQueue', async () => {
    return handleIPC(async () => {
      queueService.pauseDownloadQueue()
      return { success: true }
    })
  })

  ipcMain.handle('transfer:resumeDownloadQueue', async () => {
    return handleIPC(async () => {
      queueService.resumeDownloadQueue()
      return { success: true }
    })
  })

  ipcMain.handle('transfer:clearDownloadQueue', async () => {
    return handleIPC(async () => {
      await queueService.clearDownloadQueue()
      return { success: true }
    })
  })

  ipcMain.handle('transfer:clearPendingQueue', async () => {
    return handleIPC(async () => {
      await queueService.clearPendingQueue()
      return { success: true }
    })
  })

  ipcMain.handle('transfer:clearActiveQueue', async () => {
    return handleIPC(async () => {
      await queueService.clearActiveQueue()
      return { success: true }
    })
  })

  // ========== 下载恢复和取消 ==========
  ipcMain.handle('transfer:resumeDownload', async (_event, { taskId }) => {
    const onProgress = (data: any) => _event.sender.send('transfer:download-progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download-completed', data)
    return transferService.resumeDownload(taskId, onProgress, onCompleted)
  })

  ipcMain.handle('transfer:cancelDownload', async (_event, { taskId }) => {
    return handleIPC(async () => {
      await queueService.cancelDownloadTask(taskId)
      _event.sender.send('transfer:download-cancelled', { taskId })
      return { success: true }
    })
  })

  ipcMain.handle('transfer:cancelAllDownloads', async (_event, { userId }) => {
    return handleIPC(async () => {
      await transferService.cancelAllUserTasks(userId, 'download')
      await queueService.clearDownloadQueue()
      return { success: true }
    })
  })
}
```

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`cd LiuliuCloudStorage && pnpm exec tsc --noEmit`
预期：无 transfer 相关报错

- [ ] **步骤 3：Commit**

```bash
cd LiuliuCloudStorage
git add -A
git commit -m "refactor: transfer handler 瘦身，业务逻辑下沉到 service"
```

---

## 验证 Checklist

所有任务完成后，逐项验证：

- [ ] `pnpm exec tsc --noEmit` 通过（0 errors）
- [ ] `pnpm exec vue-tsc --noEmit --project src/renderer/tsconfig.json` 通过（0 errors）
- [ ] `src/main/ipc/handlers/` 目录已删除
- [ ] authStore 中无 async IPC 调用
- [ ] transfer.handlers.ts 行数 ≤ 150
- [ ] 每个 handler 厚度 ≤ 15 行
- [ ] 所有新 feature 目录有 `index.ts` 导出 init 函数
- [ ] `main/ipc/index.ts` 统一调用所有 init 函数
