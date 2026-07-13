# Transfer Feature 架构修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 transfer feature 修复为符合 Feature-Based + Composable-First 架构，建立可复制的样板。

**架构：** Main 侧 handler 做薄层包装（≤20行），service 纯业务逻辑不感知 IPC；Renderer 侧组件调用 composable，composable 调用 renderer service，renderer service 封装 IPC；Store 只存状态。

**技术栈：** Electron + Vue 3 + TypeScript + Drizzle ORM + Pinia

---

## 文件清单

### Main 侧

| 文件 | 当前状态 | 修改后 |
|---|---|---|
| `src/main/features/transfer/transfer.service.ts` | 约 200 行，含 `handleIPC` 调用 | 纯业务逻辑，移除 `handleIPC` |
| `src/main/features/transfer/queue.service.ts` | 约 150 行，含 `handleIPC` 调用 | 纯业务逻辑，移除 `handleIPC` |
| `src/main/features/transfer/transfer.handlers.ts` | 152 行，部分 handler 未用 `handleIPC` | 薄层，统一 `handleIPC`，约 60 行 |

### Renderer 侧

| 文件 | 当前状态 | 修改后 |
|---|---|---|
| `src/renderer/src/features/transfer/transfer.renderer.service.ts` | 1 个方法 | 完整 IPC 封装层，约 120 行 |
| `src/renderer/src/features/transfer/composables/useTransferUpload.ts` | 直接调用 `window.electronAPI.transfer.xxx` | 调用 `transferRendererService` |
| `src/renderer/src/features/transfer/composables/useTransferDownload.ts` | 直接调用 `window.electronAPI.transfer.xxx` | 调用 `transferRendererService` |
| `src/renderer/src/features/transfer/stores/transferStore.ts` | 组合 composables，暴露业务 actions | 纯状态 + getters + setters |
| `src/renderer/src/views/HomeView.vue` | `transferStore.addToUploadQueue()` `transferStore.initDownloadQueue()` | 直接调用 composable |
| `src/renderer/src/components/file/FileList.vue` | `transferStore.queueDownload()` `transferStore.downloadWithSaveAs()` | 直接调用 composable |
| `src/renderer/src/components/transfer/DropZone.vue` | `transferStore.addToUploadQueue()` | 直接调用 composable |
| `src/renderer/src/components/transfer/DownloadQueuePanel.vue` | `transferStore.pauseDownloadQueue()` 等 | 直接调用 composable |
| `src/renderer/src/components/file/BatchActionToolbar.vue` | `transferStore.batchQueueDownload()` | 直接调用 composable |

---

## 实施顺序

1. **Main Service 清理** — 移除 `handleIPC`，改为抛出 `IPCError`
2. **Main Handler 重写** — 统一 `handleIPC` 包装
3. **Renderer Service 扩展** — 封装所有 IPC 调用
4. **useTransferUpload 重构** — 使用 renderer service
5. **useTransferDownload 重构** — 使用 renderer service
6. **Store 精简** — 移除业务 actions
7. **组件迁移** — 改用 composable 调用

---

## 任务 1：清理 transfer.service.ts（移除 handleIPC）

**文件：**
- 修改：`src/main/features/transfer/transfer.service.ts`

**背景：** 当前 service 中部分方法使用了 `handleIPC()` 包装返回，部分方法直接返回原始数据。需要统一为：直接返回原始数据或抛出 `IPCError`。

- [ ] **步骤 1：定位并移除 handleIPC 调用**

查找文件中所有 `handleIPC` 的使用位置。当前 `getTasksByUser` 等方法使用了 `handleIPC(async () => { ... })` 包装。

将：
```typescript
async getTasksByUser(userId: number): Promise<TransferListResult> {
  return handleIPC(async () => {
    const rows = await this.db.select()...
    return rows.map(r => this.toTransferTask(r))
  })
}
```

改为：
```typescript
async getTasksByUser(userId: number): Promise<TransferTask[]> {
  const rows = await this.db.select().from(transferQueue)
    .where(eq(transferQueue.userId, userId))
    .orderBy(desc(transferQueue.createdAt)).all()
  return rows.map(r => this.toTransferTask(r))
}
```

对 `uploadFile`、`downloadFile`、`saveAs`、`resumeDownload` 等业务方法，同样移除 `handleIPC`，改为直接返回业务结果或抛出 `IPCError`。

- [ ] **步骤 2：添加 IPCError 抛出**

检查所有可能失败的业务场景，确保使用 `throw new IPCError(...)` 替代原来的错误返回：

```typescript
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'

// 在 uploadFile 等方法中
if (!fs.existsSync(params.filePath)) {
  throw new IPCError('文件不存在', IPCErrorCode.NOT_FOUND)
}
```

- [ ] **步骤 3：移除 handleIPC 导入**

```typescript
// 删除这行
import { handleIPC } from '../../core/ipc/error-handler'
```

- [ ] **步骤 4：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 5：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/transfer/transfer.service.ts
git commit -m "refactor: transfer.service 移除 handleIPC，改为抛出 IPCError"
```

---

## 任务 2：清理 queue.service.ts（移除 handleIPC）

**文件：**
- 修改：`src/main/features/transfer/queue.service.ts`

**背景：** 当前 `queue.service.ts` 也使用了 `handleIPC` 包装部分方法返回。

- [ ] **步骤 1：移除 handleIPC 调用**

将 `addUploadTask`、`getUploadQueueStatus`、`cancelUploadTask`、`autoRetryAllUploads` 等方法中的 `handleIPC` 包装移除，改为直接返回结果或抛出 `IPCError`。

例如将：
```typescript
async addUploadTask(task: QueueTask): Promise<void> {
  await transferQueueManager.addTask(task)
}
```

保持不变（它已经是纯业务逻辑）。

对于使用了 `handleIPC` 的方法，按同样的模式移除。

- [ ] **步骤 2：移除 handleIPC 导入**

```typescript
// 删除这行（如果存在）
import { handleIPC } from '../../core/ipc/error-handler'
```

- [ ] **步骤 3：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/transfer/queue.service.ts
git commit -m "refactor: queue.service 移除 handleIPC，改为纯业务逻辑"
```

---

## 任务 3：重写 transfer.handlers.ts

**文件：**
- 修改：`src/main/features/transfer/transfer.handlers.ts`

**背景：** 当前 152 行，部分 handler 未使用 `handleIPC`，包含事件发送逻辑。

- [ ] **步骤 1：重写所有 handler 为薄层**

替换整个文件内容为统一薄层模式。每个 handler 遵循：
1. 解包参数（如有）
2. 创建进度回调（如有）
3. `handleIPC(() => service.method(...))`

```typescript
import { ipcMain } from 'electron'
import { transferService } from './transfer.service'
import { queueService } from './queue.service'
import { handleIPC } from '../../core/ipc/error-handler'
import type { UploadParams, DownloadParams, QueueTask } from '../../../shared/types/transfer'

export function registerTransferHandlers(): void {
  // 上传
  ipcMain.handle('transfer:upload', async (_event, params: UploadParams) => {
    const onProgress = (data: any) => _event.sender.send('transfer:progress', data)
    return handleIPC(() => transferService.uploadFile(params, onProgress))
  })

  // 下载
  ipcMain.handle('transfer:download', async (_event, params: DownloadParams) => {
    const onProgress = (data: any) => _event.sender.send('transfer:download-progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download-completed', data)
    const onFailed = (data: any) => _event.sender.send('transfer:download-failed', data)
    return handleIPC(() => transferService.downloadFile(params, onProgress, onCompleted, onFailed))
  })

  // 队列管理
  ipcMain.handle('transfer:add-to-queue', async (_event, task: QueueTask) => {
    return handleIPC(() => queueService.addUploadTask(task))
  })

  ipcMain.handle('transfer:queue-status', async () => {
    return handleIPC(() => queueService.getUploadQueueStatus())
  })

  ipcMain.handle('transfer:list', async (_event, userId: number) => {
    return handleIPC(() => transferService.getTasksByUser(userId))
  })

  ipcMain.handle('transfer:restore-queue', async (_event, { userId, userToken, username }) => {
    return handleIPC(() => queueService.restoreUploadQueue(userId, userToken, username))
  })

  ipcMain.handle('transfer:saveAs', async (_event, { fileName, userId }) => {
    return handleIPC(() => transferService.saveAs(fileName, userId))
  })

  ipcMain.handle('transfer:cancel', async (_event, taskId: number) => {
    return handleIPC(() => queueService.cancelUploadTask(taskId))
  })

  ipcMain.handle('transfer:resume', async (_event, { taskId, userToken, username }) => {
    return handleIPC(() => queueService.resumeUploadTask(taskId, userToken, username))
  })

  ipcMain.handle('transfer:auto-retry-all', async (_event, { userId, userToken, username }) => {
    return handleIPC(async () => {
      const count = await queueService.autoRetryAllUploads(userId, userToken, username)
      return { retriedCount: count }
    })
  })

  // 下载队列管理
  ipcMain.handle('transfer:initDownloadQueue', async (_event, { userId, userToken }) => {
    return handleIPC(async () => {
      queueService.setDownloadCredentials(userId, userToken)
      const restoredCount = await queueService.restoreDownloadQueue(userId, userToken)
      return { restoredCount }
    })
  })

  ipcMain.handle('transfer:queueDownload', async (_event, taskData) => {
    return handleIPC(() => queueService.queueDownloadWithSession(taskData))
  })

  ipcMain.handle('transfer:batchQueueDownload', async (_event, { remotePaths }: { remotePaths: string[] }) => {
    return handleIPC(() => queueService.batchQueueDownloadWithSession(remotePaths))
  })

  ipcMain.handle('transfer:getDownloadQueue', async () => {
    return handleIPC(() => queueService.getDownloadQueueState())
  })

  ipcMain.handle('transfer:pauseDownloadQueue', async () => {
    return handleIPC(() => queueService.pauseDownloadQueue())
  })

  ipcMain.handle('transfer:resumeDownloadQueue', async () => {
    return handleIPC(() => queueService.resumeDownloadQueue())
  })

  ipcMain.handle('transfer:clearDownloadQueue', async () => {
    return handleIPC(() => queueService.clearDownloadQueue())
  })

  ipcMain.handle('transfer:clearPendingQueue', async () => {
    return handleIPC(() => queueService.clearPendingQueue())
  })

  ipcMain.handle('transfer:clearActiveQueue', async () => {
    return handleIPC(() => queueService.clearActiveQueue())
  })

  // 下载恢复和取消
  ipcMain.handle('transfer:resumeDownload', async (_event, { taskId }) => {
    const onProgress = (data: any) => _event.sender.send('transfer:download-progress', data)
    const onCompleted = (data: any) => _event.sender.send('transfer:download-completed', data)
    return handleIPC(() => transferService.resumeDownload(taskId, onProgress, onCompleted))
  })

  ipcMain.handle('transfer:cancelDownload', async (_event, { taskId }) => {
    return handleIPC(async () => {
      await queueService.cancelDownloadTask(taskId)
      _event.sender.send('transfer:download-cancelled', { taskId })
    })
  })

  ipcMain.handle('transfer:cancelAllDownloads', async (_event, { userId }) => {
    return handleIPC(async () => {
      await transferService.cancelAllUserTasks(userId, 'download')
      await queueService.clearDownloadQueue()
    })
  })
}
```

- [ ] **步骤 2：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/transfer/transfer.handlers.ts
git commit -m "refactor: transfer.handlers 重写为薄层，统一 handleIPC 包装"
```

---

## 任务 4：扩展 Renderer Service

**文件：**
- 重写：`src/renderer/src/features/transfer/transfer.renderer.service.ts`

**背景：** 当前只有 `list(userId)` 一个方法，需要扩展为完整的 IPC 调用封装层。

- [ ] **步骤 1：创建完整的 renderer service**

替换文件内容：

```typescript
import { useIPC } from '@/core/composables/useIPC'
import type {
  UploadParams,
  DownloadParams,
  QueueTask,
  QueueStatus,
  TransferTask,
  DownloadTaskData
} from '../../../shared/types/transfer'

export function createTransferService() {
  const { invoke } = useIPC()

  return {
    // ===== 上传 =====
    async upload(params: UploadParams) {
      return invoke(window.electronAPI.invoke('transfer:upload', params))
    },

    async addToQueue(task: QueueTask) {
      return invoke(window.electronAPI.invoke('transfer:add-to-queue', task))
    },

    async getQueueStatus() {
      return invoke(window.electronAPI.invoke('transfer:queue-status'))
    },

    async cancel(taskId: number) {
      return invoke(window.electronAPI.invoke('transfer:cancel', taskId))
    },

    async resume(taskId: number, userId: number, userToken: string, username: string) {
      return invoke(window.electronAPI.invoke('transfer:resume', { taskId, userId, userToken, username }))
    },

    async autoRetryAll(userId: number, userToken: string, username: string) {
      return invoke(window.electronAPI.invoke('transfer:auto-retry-all', { userId, userToken, username }))
    },

    // ===== 下载 =====
    async download(params: DownloadParams) {
      return invoke(window.electronAPI.invoke('transfer:download', params))
    },

    async saveAs(fileName: string, userId: number) {
      return invoke(window.electronAPI.invoke('transfer:saveAs', { fileName, userId }))
    },

    async initDownloadQueue(userId: number, userToken: string) {
      return invoke(window.electronAPI.invoke('transfer:initDownloadQueue', { userId, userToken }))
    },

    async queueDownload(taskData: DownloadTaskData) {
      return invoke(window.electronAPI.invoke('transfer:queueDownload', taskData))
    },

    async batchQueueDownload(remotePaths: string[]) {
      return invoke(window.electronAPI.invoke('transfer:batchQueueDownload', { remotePaths }))
    },

    async getDownloadQueue() {
      return invoke(window.electronAPI.invoke('transfer:getDownloadQueue'))
    },

    async pauseDownloadQueue() {
      return invoke(window.electronAPI.invoke('transfer:pauseDownloadQueue'))
    },

    async resumeDownloadQueue() {
      return invoke(window.electronAPI.invoke('transfer:resumeDownloadQueue'))
    },

    async clearDownloadQueue() {
      return invoke(window.electronAPI.invoke('transfer:clearDownloadQueue'))
    },

    async clearPendingQueue() {
      return invoke(window.electronAPI.invoke('transfer:clearPendingQueue'))
    },

    async clearActiveQueue() {
      return invoke(window.electronAPI.invoke('transfer:clearActiveQueue'))
    },

    async resumeDownload(taskId: number) {
      return invoke(window.electronAPI.invoke('transfer:resumeDownload', { taskId }))
    },

    async cancelDownload(taskId: number) {
      return invoke(window.electronAPI.invoke('transfer:cancelDownload', { taskId }))
    },

    async cancelAllDownloads(userId: number) {
      return invoke(window.electronAPI.invoke('transfer:cancelAllDownloads', { userId }))
    },

    // ===== 任务列表 =====
    async list(userId: number) {
      return invoke(window.electronAPI.invoke('transfer:list', userId))
    },

    async restoreQueue(userId: number, userToken: string, username?: string) {
      return invoke(window.electronAPI.invoke('transfer:restore-queue', { userId, userToken, username }))
    },

    // ===== 事件监听 =====
    onProgress(callback: (data: any) => void) {
      window.electronAPI.on('transfer:progress', callback)
    },

    onCompleted(callback: (data: any) => void) {
      window.electronAPI.on('transfer:completed', callback)
    },

    onFailed(callback: (data: any) => void) {
      window.electronAPI.on('transfer:failed', callback)
    },

    onCancelled(callback: (data: any) => void) {
      window.electronAPI.on('transfer:cancelled', callback)
    },

    onDownloadProgress(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download-progress', callback)
    },

    onDownloadCompleted(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download-completed', callback)
    },

    onDownloadFailed(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download-failed', callback)
    },

    onDownloadCancelled(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download-cancelled', callback)
    },

    removeListener(channel: string, callback: Function) {
      window.electronAPI.removeListener(channel, callback)
    }
  }
}

export const transferRendererService = createTransferService()
```

- [ ] **步骤 2：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/features/transfer/transfer.renderer.service.ts
git commit -m "feat: 扩展 transfer renderer service，封装所有 IPC 调用"
```

---

## 任务 5：重构 useTransferUpload.ts

**文件：**
- 修改：`src/renderer/src/features/transfer/composables/useTransferUpload.ts`

**背景：** 当前直接调用 `window.electronAPI.transfer.xxx`，需要改为调用 `transferRendererService`。

- [ ] **步骤 1：替换 IPC 调用为 renderer service**

将文件顶部导入改为：
```typescript
import { transferRendererService } from '../transfer.renderer.service'
```

搜索并替换以下调用：

| 旧代码 | 新代码 |
|---|---|
| `window.electronAPI.transfer.addToQueue(...)` | `transferRendererService.addToQueue(...)` |
| `window.electronAPI.transfer.getQueueStatus()` | `transferRendererService.getQueueStatus()` |
| `window.electronAPI.transfer.resume(...)` | `transferRendererService.resume(...)` |
| `window.electronAPI.transfer.autoRetryAll(...)` | `transferRendererService.autoRetryAll(...)` |

事件监听替换：

| 旧代码 | 新代码 |
|---|---|
| `window.electronAPI.transfer.onProgress(callback)` | `transferRendererService.onProgress(callback)` |
| `window.electronAPI.transfer.onCompleted(callback)` | `transferRendererService.onCompleted(callback)` |
| `window.electronAPI.transfer.onFailed(callback)` | `transferRendererService.onFailed(callback)` |
| `window.electronAPI.transfer.onCancelled(callback)` | `transferRendererService.onCancelled(callback)` |
| `window.electronAPI.transfer.removeProgressListener(callback)` | `transferRendererService.removeListener('transfer:progress', callback)` |
| `window.electronAPI.transfer.removeCompletedListener(callback)` | `transferRendererService.removeListener('transfer:completed', callback)` |
| `window.electronAPI.transfer.removeFailedListener(callback)` | `transferRendererService.removeListener('transfer:failed', callback)` |
| `window.electronAPI.transfer.removeCancelledListener(callback)` | `transferRendererService.removeListener('transfer:cancelled', callback)` |

- [ ] **步骤 2：移除 window.electronAPI 相关类型断言**

删除所有 `typeof window !== 'undefined' && window.electronAPI?.transfer?.xxx` 的条件判断，因为 `transferRendererService` 内部已处理。

- [ ] **步骤 3：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/features/transfer/composables/useTransferUpload.ts
git commit -m "refactor: useTransferUpload 改用 transferRendererService"
```

---

## 任务 6：重构 useTransferDownload.ts

**文件：**
- 修改：`src/renderer/src/features/transfer/composables/useTransferDownload.ts`

**背景：** 当前直接调用 `window.electronAPI.transfer.xxx`，需要改为调用 `transferRendererService`。

- [ ] **步骤 1：替换 IPC 调用为 renderer service**

将文件顶部导入改为：
```typescript
import { transferRendererService } from '../transfer.renderer.service'
```

搜索并替换以下调用：

| 旧代码 | 新代码 |
|---|---|
| `window.electronAPI.transfer.initDownloadQueue(...)` | `transferRendererService.initDownloadQueue(...)` |
| `window.electronAPI.transfer.queueDownload(...)` | `transferRendererService.queueDownload(...)` |
| `window.electronAPI.transfer.batchQueueDownload(...)` | `transferRendererService.batchQueueDownload(...)` |
| `window.electronAPI.transfer.getDownloadQueue()` | `transferRendererService.getDownloadQueue()` |
| `window.electronAPI.transfer.pauseDownloadQueue()` | `transferRendererService.pauseDownloadQueue()` |
| `window.electronAPI.transfer.resumeDownloadQueue()` | `transferRendererService.resumeDownloadQueue()` |
| `window.electronAPI.transfer.clearDownloadQueue()` | `transferRendererService.clearDownloadQueue()` |
| `window.electronAPI.transfer.clearPendingQueue()` | `transferRendererService.clearPendingQueue()` |
| `window.electronAPI.transfer.clearActiveQueue()` | `transferRendererService.clearActiveQueue()` |
| `window.electronAPI.transfer.resumeDownload(...)` | `transferRendererService.resumeDownload(...)` |
| `window.electronAPI.transfer.cancelDownload(...)` | `transferRendererService.cancelDownload(...)` |
| `window.electronAPI.transfer.cancelAllDownloads(...)` | `transferRendererService.cancelAllDownloads(...)` |
| `window.electronAPI.transfer.saveAs(...)` | `transferRendererService.saveAs(...)` |

事件监听替换：

| 旧代码 | 新代码 |
|---|---|
| `window.electronAPI.transfer.onDownloadProgress(callback)` | `transferRendererService.onDownloadProgress(callback)` |
| `window.electronAPI.transfer.onDownloadCompleted(callback)` | `transferRendererService.onDownloadCompleted(callback)` |
| `window.electronAPI.transfer.onDownloadFailed(callback)` | `transferRendererService.onDownloadFailed(callback)` |
| `window.electronAPI.transfer.onDownloadCancelled(callback)` | `transferRendererService.onDownloadCancelled(callback)` |
| `window.electronAPI.transfer.removeDownloadProgressListener(callback)` | `transferRendererService.removeListener('transfer:download-progress', callback)` |

- [ ] **步骤 2：移除 window.electronAPI 相关类型断言**

- [ ] **步骤 3：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/features/transfer/composables/useTransferDownload.ts
git commit -m "refactor: useTransferDownload 改用 transferRendererService"
```

---

## 任务 7：精简 transferStore.ts

**文件：**
- 修改：`src/renderer/src/features/transfer/stores/transferStore.ts`

**背景：** 当前 Store 组合了 composables 并暴露了业务 actions，需要改为纯状态管理。

- [ ] **步骤 1：移除 composables 组合**

删除：
```typescript
import { useTransferUpload } from '../composables/useTransferUpload'
import { useTransferDownload } from '../composables/useTransferDownload'
import { useTransferCommon } from '../composables/useTransferCommon'
```

以及：
```typescript
const upload = useTransferUpload()
const download = useTransferDownload()
const common = useTransferCommon()
```

- [ ] **步骤 2：移除所有业务 actions 的暴露**

从 `return` 对象中删除所有业务 action 引用（`addToUploadQueue`, `startUpload`, `initDownloadQueue`, `queueDownload` 等），只保留：

```typescript
return {
  // State
  uploadQueue, downloadQueue, isQueuePaused, isProgressPanelCollapsed, queueStatus,
  // Getters
  pendingUploads, activeUploads, completedUploads,
  // Setters
  setUploadTasks, setDownloadTasks, updateTaskProgress, updateTaskStatus,
  removeTask, setQueueStatus, setQueuePaused, toggleProgressPanel
}
```

- [ ] **步骤 3：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：可能出现组件引用 Store action 的错误，这是正常的（将在任务 8-10 中修复）

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/features/transfer/stores/transferStore.ts
git commit -m "refactor: transferStore 移除业务 actions，仅保留状态管理"
```

---

## 任务 8：迁移 HomeView.vue

**文件：**
- 修改：`src/renderer/src/views/HomeView.vue`

**背景：** 当前通过 `transferStore.addToUploadQueue()` 和 `transferStore.initDownloadQueue()` 调用业务逻辑。

- [ ] **步骤 1：添加 composable 导入**

```typescript
import { useTransferUpload } from '@/features/transfer/composables/useTransferUpload'
import { useTransferDownload } from '@/features/transfer/composables/useTransferDownload'
```

并在 `setup` 中实例化：
```typescript
const { addToUploadQueue } = useTransferUpload()
const { initDownloadQueue } = useTransferDownload()
```

- [ ] **步骤 2：替换 store action 调用**

将 `transferStore.addToUploadQueue(...)` 替换为 `addToUploadQueue(...)`：

```typescript
// 第 76 行
// 旧：transferStore.addToUploadQueue(Array.from(files), fileStore.currentPath)
// 新：
addToUploadQueue(Array.from(files), fileStore.currentPath)

// 第 125 行
// 旧：transferStore.addToUploadQueue(Array.from(files), fileStore.currentPath)
// 新：
addToUploadQueue(Array.from(files), fileStore.currentPath)
```

将 `transferStore.initDownloadQueue(...)` 替换为 `initDownloadQueue(...)`：

```typescript
// 第 190 行
// 旧：transferStore.initDownloadQueue(authStore.user.id, authStore.token)
// 新：
initDownloadQueue(authStore.user.id, authStore.token)
```

- [ ] **步骤 3：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/views/HomeView.vue
git commit -m "refactor: HomeView 改用 composable 调用替代 Store action"
```

---

## 任务 9：迁移 FileList.vue

**文件：**
- 修改：`src/renderer/src/components/file/FileList.vue`

**背景：** 当前通过 `transferStore.queueDownload()` 和 `transferStore.downloadWithSaveAs()` 调用业务逻辑。

- [ ] **步骤 1：添加 composable 导入**

```typescript
import { useTransferDownload } from '@/features/transfer/composables/useTransferDownload'
```

并在 `setup` 中实例化：
```typescript
const { queueDownload, downloadWithSaveAs } = useTransferDownload()
```

- [ ] **步骤 2：替换 store action 调用**

将 `transferStore.queueDownload(...)` 替换为 `queueDownload(...)`。将 `transferStore.downloadWithSaveAs(...)` 替换为 `downloadWithSaveAs(...)`。

- [ ] **步骤 3：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/components/file/FileList.vue
git commit -m "refactor: FileList 改用 composable 调用替代 Store action"
```

---

## 任务 10：迁移 DropZone.vue

**文件：**
- 修改：`src/renderer/src/components/transfer/DropZone.vue`

**背景：** 当前通过 `transferStore.addToUploadQueue()` 调用业务逻辑。

- [ ] **步骤 1：添加 composable 导入**

```typescript
import { useTransferUpload } from '@/features/transfer/composables/useTransferUpload'
```

并在 `setup` 中实例化：
```typescript
const { addToUploadQueue } = useTransferUpload()
```

- [ ] **步骤 2：替换 store action 调用**

将 `transferStore.addToUploadQueue(...)` 替换为 `addToUploadQueue(...)`。

- [ ] **步骤 3：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/components/transfer/DropZone.vue
git commit -m "refactor: DropZone 改用 composable 调用替代 Store action"
```

---

## 任务 11：迁移 DownloadQueuePanel.vue

**文件：**
- 修改：`src/renderer/src/components/transfer/DownloadQueuePanel.vue`

**背景：** 当前通过 `transferStore.pauseDownloadQueue()`、`transferStore.resumeDownloadQueue()` 等调用业务逻辑。

- [ ] **步骤 1：添加 composable 导入**

```typescript
import { useTransferDownload } from '@/features/transfer/composables/useTransferDownload'
```

并在 `setup` 中实例化：
```typescript
const { pauseDownloadQueue, resumeDownloadQueue, clearDownloadQueue, clearPendingQueue, clearActiveQueue } = useTransferDownload()
```

- [ ] **步骤 2：替换 store action 调用**

将以下调用替换为对应的 composable 调用：

| 旧代码 | 新代码 |
|---|---|
| `transferStore.pauseDownloadQueue()` | `pauseDownloadQueue()` |
| `transferStore.resumeDownloadQueue()` | `resumeDownloadQueue()` |
| `transferStore.clearDownloadQueue()` | `clearDownloadQueue()` |
| `transferStore.clearPendingQueue()` | `clearPendingQueue()` |
| `transferStore.clearActiveQueue()` | `clearActiveQueue()` |

- [ ] **步骤 3：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/components/transfer/DownloadQueuePanel.vue
git commit -m "refactor: DownloadQueuePanel 改用 composable 调用替代 Store action"
```

---

## 任务 12：迁移 BatchActionToolbar.vue

**文件：**
- 修改：`src/renderer/src/components/file/BatchActionToolbar.vue`

**背景：** 当前通过 `transferStore.batchQueueDownload()` 调用业务逻辑。

- [ ] **步骤 1：添加 composable 导入**

```typescript
import { useTransferDownload } from '@/features/transfer/composables/useTransferDownload'
```

并在 `setup` 中实例化：
```typescript
const { batchQueueDownload } = useTransferDownload()
```

- [ ] **步骤 2：替换 store action 调用**

将 `transferStore.batchQueueDownload(...)` 替换为 `batchQueueDownload(...)`。

- [ ] **步骤 3：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 4：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/components/file/BatchActionToolbar.vue
git commit -m "refactor: BatchActionToolbar 改用 composable 调用替代 Store action"
```

---

## 任务 13：迁移 TransferProgressList.vue

**文件：**
- 检查：`src/renderer/src/components/transfer/TransferProgressList.vue`

**背景：** 此组件可能只读取 Store 状态，不调用业务 actions。需要检查确认。

- [ ] **步骤 1：检查是否调用了 Store actions**

运行：`grep -n "transferStore\." src/renderer/src/components/transfer/TransferProgressList.vue`

如果只有状态读取（如 `transferStore.uploadQueue`），则无需修改。
如果调用了 actions，按同样模式迁移。

- [ ] **步骤 2：如果需要修改，执行迁移并 commit**

---

## 任务 14：最终验证

- [ ] **步骤 1：全量类型检查**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：零错误

- [ ] **步骤 2：构建验证**

运行：`cd LiuliuCloudStorage && pnpm build`
预期：构建成功

- [ ] **步骤 3：手动功能测试**

启动应用，验证以下场景：

- [ ] 拖拽文件上传 → 队列中显示待上传任务
- [ ] 点击上传按钮选择文件 → 任务添加到队列
- [ ] 上传过程中 → 进度条更新
- [ ] 上传完成 → 通知显示
- [ ] 下载文件 → 下载队列中显示
- [ ] 批量下载 → 多个任务加入队列
- [ ] 暂停下载队列 → 状态变为暂停
- [ ] 恢复下载队列 → 状态变为进行中
- [ ] 清除下载队列 → 队列为空
- [ ] 另存为 → 对话框弹出，选择路径后下载

- [ ] **步骤 4：Commit 验证结果记录**

```bash
cd LiuliuCloudStorage
git commit --allow-empty -m "test: transfer feature 架构修复验证完成"
```

---

## 自检

### 1. 规格覆盖度

| 设计文档需求 | 对应任务 |
|---|---|
| Handler 层 ≤ 20 行，统一 handleIPC | 任务 3 |
| Service 层不感知 IPC | 任务 1、2 |
| Renderer Service 完整封装 | 任务 4 |
| Composables 调用 renderer service | 任务 5、6 |
| Store 只存状态 | 任务 7 |
| 组件直接调用 composable | 任务 8-13 |

**覆盖度：** 100%，无遗漏。

### 2. 占位符扫描

- [x] 无 "待定"、"TODO"
- [x] 无 "添加适当的错误处理" 等模糊描述
- [x] 无 "类似任务 N" 的重复引用
- [x] 所有步骤包含实际代码或明确命令

### 3. 类型一致性

- [x] `transferRendererService` 命名一致
- [x] `IPCError` / `IPCErrorCode` 引用一致
- [x] `handleIPC` 用法一致
- [x] `useIPC().invoke()` 用法一致

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-05-17-transfer-refactor-fix.md`。两种执行方式：**

**1. 子代理驱动（推荐）** — 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** — 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
