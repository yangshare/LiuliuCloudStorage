# Transfer Feature 架构修复设计文档

## 概述

本文档定义将 `transfer` feature 从当前偏差状态修复为符合 [代码架构重构设计文档](./2026-05-16-codebase-architecture-refactor-design.md) 的完整方案。

修复策略：以 transfer 为试点，彻底重构，建立可复制的样板。

---

## 修复范围

本次修复仅针对 `transfer` feature，包含以下 5 个核心偏差的修复：

1. **Handler 层过厚** — `transfer.handlers.ts` 152 行，远超 20 行设计目标
2. **Service 层不纯** — `handleIPC` 侵入 service，service 感知 IPC
3. **Renderer Service 不完整** — `transfer.renderer.service.ts` 只有 1 个方法
4. **Store 职责边界模糊** — Store 暴露业务 actions，组件通过 Store 调用 IPC
5. **IPC 响应不一致** — 部分 handler 未使用 `handleIPC` 包装

---

## Main 进程侧设计

### Handler 层

**原则：** 每个 handler 不超过 20 行，只做三件事：解包参数 → 调用 service → `handleIPC` 包装。

**进度事件处理：** 通过回调函数注入 service。Handler 负责创建回调（内部发送 IPC 事件），service 只调用回调，不感知 IPC。

```typescript
// main/features/transfer/transfer.handlers.ts

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

  // 另存为
  ipcMain.handle('transfer:saveAs', async (_event, { fileName, userId }) => {
    return handleIPC(() => transferService.saveAs(fileName, userId))
  })

  // 取消上传
  ipcMain.handle('transfer:cancel', async (_event, taskId: number) => {
    return handleIPC(() => queueService.cancelUploadTask(taskId))
  })

  // 恢复上传
  ipcMain.handle('transfer:resume', async (_event, { taskId, userToken, username }) => {
    return handleIPC(() => queueService.resumeUploadTask(taskId, userToken, username))
  })

  // 自动重试
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

### Service 层

**原则：** 纯业务逻辑，不感知 IPC。返回原始数据或抛出 `IPCError`。

```typescript
// main/features/transfer/transfer.service.ts

import { eq, desc, and, or, inArray, count } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getDatabase } from '../../database'
import { transferQueue, type NewTransferQueue, type TransferQueue } from '../../database/schema'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'
import type { TransferTask, TransferStatus } from '../../../shared/types/transfer'

export type ProgressCallback = (data: { taskId: string | number; progress: number; transferredSize?: number }) => void
export type CompletedCallback = (data: { taskId: string | number; fileName: string }) => void
export type FailedCallback = (data: { taskId: string | number; fileName: string; error: string }) => void

export class TransferService {
  private get db() {
    return drizzle(getDatabase())
  }

  // ========== 查询 ==========

  async getTasksByUser(userId: number): Promise<TransferTask[]> {
    const rows = await this.db
      .select()
      .from(transferQueue)
      .where(eq(transferQueue.userId, userId))
      .orderBy(desc(transferQueue.createdAt))
      .all()
    return rows.map((r) => this.toTransferTask(r))
  }

  async getTask(taskId: number): Promise<TransferQueue | undefined> {
    return this.db.select().from(transferQueue).where(eq(transferQueue.id, taskId)).get()
  }

  // ========== 创建 ==========

  async create(task: NewTransferQueue): Promise<TransferQueue> {
    return this.db.insert(transferQueue).values(task).returning().get()
  }

  async createBatch(tasks: NewTransferQueue[]): Promise<TransferQueue[]> {
    return this.db.insert(transferQueue).values(tasks).returning().all()
  }

  // ========== 更新 ==========

  async updateStatus(taskId: number, status: TransferQueue['status']): Promise<void> {
    this.db
      .update(transferQueue)
      .set({ status, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateProgress(taskId: number, transferredSize: number): Promise<void> {
    this.db
      .update(transferQueue)
      .set({ transferredSize, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateFileSize(taskId: number, fileSize: number): Promise<void> {
    this.db
      .update(transferQueue)
      .set({ fileSize, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateFilePath(taskId: number, filePath: string): Promise<void> {
    this.db
      .update(transferQueue)
      .set({ filePath, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async markAsFailed(taskId: number, errorMessage: string, transferredSize: number): Promise<void> {
    this.db
      .update(transferQueue)
      .set({
        status: 'failed',
        errorMessage,
        transferredSize,
        resumable: true,
        updatedAt: new Date()
      })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  // ========== 上传/下载业务 ==========

  async uploadFile(
    params: UploadParams,
    onProgress: ProgressCallback
  ): Promise<{ taskId: number }> {
    // 纯业务逻辑：读取文件、分片、调用 Alist API
    // 通过 onProgress 回调报告进度
    // 失败时 throw new IPCError('...', IPCErrorCode.NETWORK)
    // ...
  }

  async downloadFile(
    params: DownloadParams,
    onProgress: ProgressCallback,
    onCompleted: CompletedCallback,
    onFailed: FailedCallback
  ): Promise<{ taskId: number }> {
    // 纯业务逻辑
    // ...
  }

  async saveAs(fileName: string, userId: number): Promise<{ savePath: string }> {
    // 打开保存对话框，返回路径
    // ...
  }

  async resumeDownload(
    taskId: number,
    onProgress: ProgressCallback,
    onCompleted: CompletedCallback
  ): Promise<void> {
    // 恢复下载业务逻辑
    // ...
  }

  async cancelAllUserTasks(userId: number, taskType: 'upload' | 'download'): Promise<void> {
    this.db
      .update(transferQueue)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(transferQueue.userId, userId), eq(transferQueue.taskType, taskType)))
      .run()
  }

  // ========== 转换 ==========

  private toTransferTask(row: TransferQueue): TransferTask {
    return {
      id: String(row.id),
      fileName: row.filePath.split(/[\\/]/).pop() || '',
      filePath: row.filePath,
      fileSize: row.fileSize || 0,
      transferredSize: row.transferredSize || 0,
      status: row.status,
      progress: row.fileSize ? Math.round((row.transferredSize / row.fileSize) * 100) : 0,
      targetPath: row.remotePath,
      createdAt: row.createdAt.toISOString()
    }
  }
}

export const transferService = new TransferService()
```

`queue.service.ts` 同样移除所有 `handleIPC` 调用，只返回原始数据或抛出 `IPCError`。

---

## Renderer 进程侧设计

### Renderer Service 层

**原则：** 封装所有 IPC 调用，统一错误处理，提供类型安全。

```typescript
// renderer/src/features/transfer/transfer.renderer.service.ts

import { useIPC } from '@/core/composables/useIPC'
import type {
  UploadParams,
  DownloadParams,
  QueueTask,
  QueueStatus,
  TransferTask,
  DownloadTaskData
} from '../../../shared/types/transfer'

function createTransferService() {
  const { invoke } = useIPC()

  return {
    // ===== 上传 =====
    async upload(params: UploadParams) {
      return invoke(window.electronAPI.invoke('transfer:upload', params))
    },

    async addToQueue(task: QueueTask): Promise<boolean> {
      const result = await invoke(window.electronAPI.invoke('transfer:add-to-queue', task))
      return result !== null
    },

    async getQueueStatus(): Promise<QueueStatus | null> {
      return invoke(window.electronAPI.invoke('transfer:queue-status'))
    },

    async cancel(taskId: number): Promise<boolean> {
      const result = await invoke(window.electronAPI.invoke('transfer:cancel', taskId))
      return result !== null
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

    async pauseDownloadQueue(): Promise<boolean> {
      const result = await invoke(window.electronAPI.invoke('transfer:pauseDownloadQueue'))
      return result !== null
    },

    async resumeDownloadQueue(): Promise<boolean> {
      const result = await invoke(window.electronAPI.invoke('transfer:resumeDownloadQueue'))
      return result !== null
    },

    async clearDownloadQueue(): Promise<boolean> {
      const result = await invoke(window.electronAPI.invoke('transfer:clearDownloadQueue'))
      return result !== null
    },

    async clearPendingQueue(): Promise<boolean> {
      const result = await invoke(window.electronAPI.invoke('transfer:clearPendingQueue'))
      return result !== null
    },

    async clearActiveQueue(): Promise<boolean> {
      const result = await invoke(window.electronAPI.invoke('transfer:clearActiveQueue'))
      return result !== null
    },

    async resumeDownload(taskId: number) {
      return invoke(window.electronAPI.invoke('transfer:resumeDownload', { taskId }))
    },

    async cancelDownload(taskId: number): Promise<boolean> {
      const result = await invoke(window.electronAPI.invoke('transfer:cancelDownload', { taskId }))
      return result !== null
    },

    async cancelAllDownloads(userId: number): Promise<boolean> {
      const result = await invoke(window.electronAPI.invoke('transfer:cancelAllDownloads', { userId }))
      return result !== null
    },

    // ===== 任务列表 =====
    async list(userId: number): Promise<TransferTask[] | null> {
      return invoke(window.electronAPI.invoke('transfer:list', userId))
    },

    async restoreQueue(userId: number, userToken: string, username?: string) {
      return invoke(window.electronAPI.invoke('transfer:restore-queue', { userId, userToken, username }))
    },

    // ===== 事件监听 =====
    onProgress(callback: (data: { taskId: string | number; progress: number }) => void): void {
      window.electronAPI.on('transfer:progress', callback)
    },

    onCompleted(callback: (data: { taskId: string | number; fileName: string }) => void): void {
      window.electronAPI.on('transfer:completed', callback)
    },

    onFailed(callback: (data: { taskId: string | number; fileName: string; error: string }) => void): void {
      window.electronAPI.on('transfer:failed', callback)
    },

    onCancelled(callback: (data: { taskId: string | number; fileName: string }) => void): void {
      window.electronAPI.on('transfer:cancelled', callback)
    },

    onDownloadProgress(callback: (data: { taskId: string | number; progress: number }) => void): void {
      window.electronAPI.on('transfer:download-progress', callback)
    },

    onDownloadCompleted(callback: (data: { taskId: string; fileName: string }) => void): void {
      window.electronAPI.on('transfer:download-completed', callback)
    },

    onDownloadFailed(callback: (data: { taskId: string; fileName: string; error: string }) => void): void {
      window.electronAPI.on('transfer:download-failed', callback)
    },

    onDownloadCancelled(callback: (data: { taskId: string }) => void): void {
      window.electronAPI.on('transfer:download-cancelled', callback)
    },

    removeListener(channel: string, callback: Function): void {
      window.electronAPI.removeListener(channel, callback)
    }
  }
}

export const transferRendererService = createTransferService()
```

### Composables

**原则：** 承载所有业务逻辑，调用 renderer service，处理副作用（通知、事件监听）。

```typescript
// renderer/src/features/transfer/composables/useTransferUpload.ts

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElNotification } from 'element-plus'
import { transferRendererService } from '../transfer.renderer.service'
import { useTransferStore } from '../stores/transferStore'
import { useQuotaStore } from '@/features/quota'
import type { UploadTask, QueueStatus } from '../stores/transferStore'

export function useTransferUpload() {
  const store = useTransferStore()

  // State
  const isUploading = ref(false)
  const uploadError = ref<string | null>(null)

  // Getters
  const pendingUploads = computed(() => store.uploadQueue.filter((t) => t.status === 'pending'))
  const activeUploads = computed(() => store.uploadQueue.filter((t) => t.status === 'in_progress'))
  const completedUploads = computed(() => store.uploadQueue.filter((t) => t.status === 'completed'))

  // 批量通知
  const pendingNotifications = ref<string[]>([])
  let notifyTimer: ReturnType<typeof setTimeout> | null = null

  function flushNotifications() {
    const files = pendingNotifications.value.splice(0)
    if (files.length === 0) return
    const title = '上传完成'
    const message = files.length === 1 ? `文件 "${files[0]}" 已成功上传` : `${files.length} 个文件上传完成`
    ElNotification.success({ title, message, duration: 4000 })
    window.electronAPI?.notification?.show({ title: '溜溜网盘', body: message })
  }

  // Actions
  function addToUploadQueue(files: File[], targetPath: string = '/') {
    const tasks: UploadTask[] = files.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      filePath: (file as any).path || file.name,
      fileSize: file.size,
      transferredSize: 0,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      targetPath,
      uploadSpeed: 0,
      estimatedTime: 0,
      lastUpdateTime: Date.now(),
      lastTransferredSize: 0,
      resumable: true
    }))
    store.setUploadTasks([...store.uploadQueue, ...tasks])
  }

  function addPathsToUploadQueue(paths: string[], targetPath: string = '/') {
    const tasks: UploadTask[] = paths.map((filePath) => ({
      id: crypto.randomUUID(),
      fileName: filePath.split(/[\\/]/).pop() || filePath,
      filePath,
      fileSize: 0,
      transferredSize: 0,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      targetPath,
      uploadSpeed: 0,
      estimatedTime: 0,
      lastUpdateTime: Date.now(),
      lastTransferredSize: 0,
      resumable: true
    }))
    store.setUploadTasks([...store.uploadQueue, ...tasks])
  }

  function removeFromQueue(taskId: string | number) {
    store.removeTask(String(taskId))
  }

  function clearCompleted() {
    store.setUploadTasks(store.uploadQueue.filter((t) => t.status !== 'completed'))
  }

  async function startUpload(taskId: string, userId: number, userToken: string, username: string) {
    const task = store.uploadQueue.find((t) => t.id === taskId)
    if (!task) return

    store.updateTaskStatus(taskId, 'pending')
    uploadError.value = null

    const result = await transferRendererService.addToQueue({
      id: typeof task.id === 'number' ? task.id : parseInt(task.id as string) || 0,
      filePath: task.filePath,
      remotePath: task.targetPath,
      userId,
      userToken,
      username,
      fileName: task.fileName,
      fileSize: task.fileSize
    })

    if (!result) {
      store.updateTaskStatus(taskId, 'failed')
      task.error = '添加到队列失败'
    }
  }

  async function processQueue(userId: number, userToken: string, username: string) {
    const pending = pendingUploads.value
    for (const task of pending) {
      await startUpload(task.id as string, userId, userToken, username)
    }
  }

  async function fetchQueueStatus() {
    const status = await transferRendererService.getQueueStatus()
    if (status) store.setQueueStatus(status)
  }

  async function resumeUpload(taskId: string | number, userId: number, userToken: string, username: string) {
    const result = await transferRendererService.resume(
      typeof taskId === 'number' ? taskId : parseInt(taskId as string) || 0,
      userId,
      userToken,
      username
    )
    if (result) {
      store.updateTaskStatus(String(taskId), 'in_progress')
    }
    return result
  }

  async function autoRetryFailedTasks(userId: number, userToken: string, username: string) {
    const result = await transferRendererService.autoRetryAll(userId, userToken, username)
    if (result) {
      store.uploadQueue
        .filter((t) => t.status === 'failed' && t.resumable)
        .forEach((task) => store.updateTaskStatus(task.id, 'in_progress'))
    }
    return result
  }

  // 事件处理
  const progressHandler = (data: { taskId: string | number; progress: number; transferredSize?: number }) => {
    const task = store.uploadQueue.find((t) => String(t.id) === String(data.taskId))
    if (!task) return

    const now = Date.now()
    const timeDiff = (now - task.lastUpdateTime) / 1000
    if (timeDiff < 1) return

    const newTransferredSize = data.transferredSize ?? Math.floor((task.fileSize * data.progress) / 100)
    const sizeDiff = newTransferredSize - task.lastTransferredSize

    if (timeDiff > 0 && sizeDiff >= 0) {
      task.uploadSpeed = sizeDiff / timeDiff
    }

    const remainingSize = task.fileSize - newTransferredSize
    task.estimatedTime = task.uploadSpeed > 0 ? remainingSize / task.uploadSpeed : 0
    task.progress = data.progress
    task.transferredSize = newTransferredSize
    task.lastUpdateTime = now
    task.lastTransferredSize = newTransferredSize
  }

  const completedHandler = (data: { taskId: string | number; fileName: string }) => {
    const task = store.uploadQueue.find((t) => String(t.id) === String(data.taskId))
    if (!task) return

    store.updateTaskStatus(task.id, 'completed')
    store.updateTaskProgress(task.id, 100)
    task.transferredSize = task.fileSize

    // 更新配额
    const quotaStore = useQuotaStore()
    quotaStore.calculateQuota()

    // 批量通知
    pendingNotifications.value.push(data.fileName)
    if (notifyTimer) clearTimeout(notifyTimer)
    notifyTimer = setTimeout(flushNotifications, 1500)
  }

  const failedHandler = (data: { taskId: string | number; fileName: string; error: string }) => {
    const task = store.uploadQueue.find((t) => String(t.id) === String(data.taskId))
    if (!task) return

    store.updateTaskStatus(task.id, 'failed')
    task.error = data.error
    task.resumable = true

    ElNotification.error({
      title: '上传失败',
      message: `文件 "${data.fileName}" 上传失败：${data.error}`,
      duration: 5000
    })
    window.electronAPI?.notification?.show({
      title: '上传失败',
      body: `文件 ${data.fileName} 上传失败：${data.error}`
    })
  }

  const cancelledHandler = (data: { taskId: string | number; fileName: string }) => {
    const task = store.uploadQueue.find((t) => String(t.id) === String(data.taskId))
    if (!task) return
    store.updateTaskStatus(task.id, 'cancelled')
    task.resumable = false
  }

  onMounted(() => {
    transferRendererService.onProgress(progressHandler)
    transferRendererService.onCompleted(completedHandler)
    transferRendererService.onFailed(failedHandler)
    transferRendererService.onCancelled(cancelledHandler)
  })

  onUnmounted(() => {
    transferRendererService.removeListener('transfer:progress', progressHandler)
    transferRendererService.removeListener('transfer:completed', completedHandler)
    transferRendererService.removeListener('transfer:failed', failedHandler)
    transferRendererService.removeListener('transfer:cancelled', cancelledHandler)
    if (notifyTimer) clearTimeout(notifyTimer)
  })

  return {
    isUploading,
    uploadError,
    pendingUploads,
    activeUploads,
    completedUploads,
    addToUploadQueue,
    addPathsToUploadQueue,
    removeFromQueue,
    clearCompleted,
    startUpload,
    processQueue,
    fetchQueueStatus,
    resumeUpload,
    autoRetryFailedTasks
  }
}
```

`useTransferDownload.ts` 同理，调用 `transferRendererService` 的下载相关方法。

### Store

**原则：** 只存 state + getters + 简单 setter，不处理业务逻辑，不调用 IPC。

```typescript
// renderer/src/features/transfer/stores/transferStore.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UploadTask {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  transferredSize: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  progress: number
  error?: string
  createdAt: Date
  targetPath: string
  uploadSpeed: number
  estimatedTime: number
  lastUpdateTime: number
  lastTransferredSize: number
  resumable: boolean
}

export interface DownloadTask {
  id: string
  fileName: string
  remotePath: string
  savePath: string
  fileSize: number
  downloadedBytes: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number
  speed: number
  error?: string
  createdAt: Date
}

export interface QueueStatus {
  active: number
  pending: number
  maxConcurrent: number
}

export const useTransferStore = defineStore('transfer', () => {
  // ========== State ==========
  const uploadQueue = ref<UploadTask[]>([])
  const downloadQueue = ref<DownloadTask[]>([])
  const isQueuePaused = ref(false)
  const isProgressPanelCollapsed = ref(false)
  const queueStatus = ref<QueueStatus>({ active: 0, pending: 0, maxConcurrent: 5 })

  // ========== Getters ==========
  const pendingUploads = computed(() => uploadQueue.value.filter((t) => t.status === 'pending'))
  const activeUploads = computed(() => uploadQueue.value.filter((t) => t.status === 'in_progress'))
  const completedUploads = computed(() => uploadQueue.value.filter((t) => t.status === 'completed'))

  // ========== Setters ==========
  function setUploadTasks(tasks: UploadTask[]) {
    uploadQueue.value = tasks
  }

  function setDownloadTasks(tasks: DownloadTask[]) {
    downloadQueue.value = tasks
  }

  function updateTaskProgress(taskId: string, progress: number) {
    const task = uploadQueue.value.find((t) => t.id === taskId)
    if (task) task.progress = progress
  }

  function updateTaskStatus(taskId: string, status: UploadTask['status']) {
    const task = uploadQueue.value.find((t) => t.id === taskId)
    if (task) task.status = status
  }

  function removeTask(taskId: string) {
    const index = uploadQueue.value.findIndex((t) => t.id === taskId)
    if (index !== -1) uploadQueue.value.splice(index, 1)
  }

  function setQueueStatus(status: QueueStatus) {
    queueStatus.value = status
  }

  function setQueuePaused(paused: boolean) {
    isQueuePaused.value = paused
  }

  function toggleProgressPanel() {
    isProgressPanelCollapsed.value = !isProgressPanelCollapsed.value
  }

  return {
    // State
    uploadQueue,
    downloadQueue,
    isQueuePaused,
    isProgressPanelCollapsed,
    queueStatus,
    // Getters
    pendingUploads,
    activeUploads,
    completedUploads,
    // Setters
    setUploadTasks,
    setDownloadTasks,
    updateTaskProgress,
    updateTaskStatus,
    removeTask,
    setQueueStatus,
    setQueuePaused,
    toggleProgressPanel
  }
})
```

---

## 数据流规范

### 操作路径（组件发起上传）

```
Component（FileList.vue）
  ↓ const { addToUploadQueue, startUpload } = useTransferUpload()
  ↓ addToUploadQueue(files, targetPath)    // 更新本地状态
  ↓ startUpload(taskId, userId, token, username)
Composable（useTransferUpload）
  ↓ transferRendererService.addToQueue(task)
Renderer Service
  ↓ window.electronAPI.invoke('transfer:add-to-queue', task)
  ↓ useIPC().invoke() 统一错误处理
Preload → Main Handler
  ↓ handleIPC(() => queueService.addUploadTask(task))
Main Service（queue.service.ts）
  ↓ db.insert(transferQueue).values(...)
```

### 状态推送路径（上传进度）

```
Main Service 通过 onProgress 回调
  ↓ Handler: _event.sender.send('transfer:progress', data)
  ↓ Preload 转发
Renderer Service: onProgress(callback)
  ↓ Composable: progressHandler
  ↓ store.updateTaskProgress(taskId, progress)
  ↓ Component 响应式更新
```

### 关键规则

1. **状态唯一来源是 Main 进程的数据库**
2. **Renderer store 是缓存，通过事件保持同步**
3. **组件不直接调用 IPC，必须通过 composable**
4. **禁止组件之间直接传递状态**
5. **单向依赖：Composable → Store（只读）→ Component**

---

## 错误处理策略

| 层级 | 职责 |
|---|---|
| **Main Service** | 业务错误 → `throw new IPCError('具体错误', IPCErrorCode.XXX)` |
| **Main Handler** | `handleIPC` 捕获 → 包装为 `{ success: false, error, code }` |
| **Renderer Service** | `useIPC().invoke()` 解构响应 → `success === false` 时 `ElMessage.error()` + 未授权跳转登录页 |
| **Composable** | 根据返回结果更新本地状态（如 `task.status = 'failed'`） |
| **Component** | 无需处理错误，只读取 store 状态展示 |

---

## 组件迁移示例

### 重构前

```vue
<script setup>
const store = useTransferStore()

async function handleUpload(files, targetPath) {
  store.addToUploadQueue(files, targetPath)
  await store.startUpload(taskId, userId, token, username)
}
</script>
```

### 重构后

```vue
<script setup>
const store = useTransferStore()
const { addToUploadQueue, startUpload } = useTransferUpload()

async function handleUpload(files, targetPath) {
  addToUploadQueue(files, targetPath)
  await startUpload(taskId, userId, token, username)
}
</script>
```

---

## 实施顺序

```
步骤 1: Main 侧
  ├── 重写 transfer.service.ts（移除 handleIPC）
  ├── 重写 queue.service.ts（移除 handleIPC）
  └── 重写 transfer.handlers.ts（统一 handleIPC）

步骤 2: Renderer Service
  └── 扩展 transfer.renderer.service.ts

步骤 3: Renderer Composables
  ├── 重构 useTransferUpload.ts
  └── 重构 useTransferDownload.ts

步骤 4: Store
  └── 精简 transferStore.ts

步骤 5: 组件迁移
  └── HomeView, FileList, DropZone, TransferProgressList 等改用 composable
```

---

## 文件清单

| # | 文件路径 | 修改内容 | 预估行数变化 |
|---|---|---|---|
| 1 | `main/features/transfer/transfer.handlers.ts` | 重写为薄层，统一 `handleIPC` | 152 → ~60 |
| 2 | `main/features/transfer/transfer.service.ts` | 移除 `handleIPC`，纯业务逻辑 | 修改 ~20 处 |
| 3 | `main/features/transfer/queue.service.ts` | 同上，移除 `handleIPC` | 修改 ~15 处 |
| 4 | `renderer/features/transfer/transfer.renderer.service.ts` | 扩展为完整 IPC 封装 | 1 → ~120 |
| 5 | `renderer/features/transfer/composables/useTransferUpload.ts` | 使用 renderer service | 修改 ~30 处 |
| 6 | `renderer/features/transfer/composables/useTransferDownload.ts` | 使用 renderer service | 修改 ~30 处 |
| 7 | `renderer/features/transfer/stores/transferStore.ts` | 移除业务 actions | 123 → ~80 |
| 8 | `renderer/views/HomeView.vue` | 改用 composable 调用 | 修改 ~10 处 |
| 9 | `renderer/components/file/FileList.vue` | 改用 composable 调用 | 修改 ~5 处 |
| 10 | `renderer/components/transfer/DropZone.vue` | 改用 composable 调用 | 修改 ~5 处 |
| 11 | `renderer/components/transfer/TransferProgressList.vue` | 改用 composable 调用 | 修改 ~5 处 |

---

## 验证清单

修复完成后必须手动验证以下场景：

- [ ] 单文件上传成功
- [ ] 批量上传成功
- [ ] 拖拽上传成功
- [ ] 上传进度实时更新
- [ ] 上传失败时错误提示正确
- [ ] 断点续传功能正常
- [ ] 单文件下载成功
- [ ] 批量下载成功
- [ ] 下载队列暂停/恢复
- [ ] 取消下载
- [ ] 另存为对话框正常
- [ ] 上传/下载完成后通知正确
- [ ] 未授权时跳转登录页
