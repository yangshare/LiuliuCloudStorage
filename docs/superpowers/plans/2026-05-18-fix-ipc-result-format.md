# 修复 IPC 返回值格式冲突实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 清理 Service 层返回的 `{ success: boolean, ... }` 格式对象，消除 `isIPCResult` 误判，修复下载提示"添加失败"但后台实际成功的 bug。

**架构：** Service 层只返回纯业务数据或抛出 IPCError，`handleIPC` 统一包装为 `IPCResult<T>`。Renderer 侧 `useIPC().invoke()` 成功时返回 `T`（`undefined` 也是有效值），失败时返回 `null`。通过 `result === null` 判断是否失败。

**技术栈：** Electron + Vue 3 + TypeScript + Drizzle ORM

---

## 文件清单

### Main 侧

| 文件 | 职责 |
|---|---|
| `src/main/core/ipc/error-handler.ts` | 收紧 `isIPCResult` 判断条件 |
| `src/main/features/transfer/transfer-queue.manager.ts` | `cancelTask` 改为返回 `void`、失败抛异常 |
| `src/main/features/transfer/queue.service.ts` | 移除 `queueDownloadWithSession` 等方法的 `success` 字段 |
| `src/main/features/transfer/transfer.service.ts` | 移除 `uploadFile`、`downloadFile`、`saveAs`、`resumeDownload` 的 `success` 字段 |

### Renderer 侧

| 文件 | 职责 |
|---|---|
| `src/renderer/src/features/transfer/composables/useTransferDownload.ts` | 调整下载相关方法的返回值判断逻辑 |
| `src/renderer/src/features/transfer/composables/useTransferUpload.ts` | 调整上传恢复/重试方法的判断逻辑 |
| `src/renderer/src/components/file/BatchActionToolbar.vue` | 调整批量下载结果处理，区分"异常失败"和"无新任务" |

---

## 任务 1：收紧 isIPCResult

**文件：**
- 修改：`src/main/core/ipc/error-handler.ts:19-26`

- [ ] **步骤 1：修改 isIPCResult 函数**

```typescript
function isIPCResult(data: unknown): data is IPCResult<unknown> {
  if (data === null || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('success' in d) || typeof d.success !== 'boolean') return false
  if (d.success === true) return 'data' in d
  return 'error' in d
}
```

- [ ] **步骤 2：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/core/ipc/error-handler.ts
git commit -m "fix: 收紧 isIPCResult 判断，要求 success=true 时必须有 data"
```

---

## 任务 2：清理 transfer-queue.manager.ts

**文件：**
- 修改：`src/main/features/transfer/transfer-queue.manager.ts:215-263`

- [ ] **步骤 1：修改 cancelTask 方法**

将 `cancelTask` 改为返回 `void`，失败时抛异常：

```typescript
async cancelTask(taskId: number): Promise<void> {
  console.log(`[TransferQueueManager] 尝试取消任务 ${taskId}`)

  // 1. 从队列中移除（如果在等待队列）
  const queueIndex = this.queue.findIndex(t => t.id === taskId)
  if (queueIndex !== -1) {
    this.queue.splice(queueIndex, 1)
    console.log(`[TransferQueueManager] 任务 ${taskId} 从等待队列移除`)
  }

  // 2. 如果任务正在执行，记录已取消
  const alistTaskId = this.activeTaskIds.get(taskId)
  if (alistTaskId) {
    console.log(`[TransferQueueManager] 任务 ${taskId} 正在执行，alistTaskId: ${alistTaskId}`)
    this.activeCount--
    this.activeTaskIds.delete(taskId)
    console.log(`[TransferQueueManager] 任务 ${taskId} 释放并发槽位`)
  }

  // 3. 更新数据库状态为 cancelled
  await this.transferService.updateStatus(taskId, 'cancelled')
  console.log(`[TransferQueueManager] 任务 ${taskId} 状态更新为 cancelled`)

  // 4. 启动下一个等待任务
  this.processQueue()

  // 5. 发送取消事件到渲染进程
  const taskInfo = await this.transferService.getTask(taskId)
  if (taskInfo) {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('transfer:upload:cancelled', {
          taskId: taskId,
          fileName: taskInfo.fileName
        })
      }
    })
  }
}
```

- [ ] **步骤 2：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/transfer/transfer-queue.manager.ts
git commit -m "refactor: cancelTask 返回 void，失败抛异常"
```

---

## 任务 3：清理 queue.service.ts

**文件：**
- 修改：`src/main/features/transfer/queue.service.ts`

- [ ] **步骤 1：修改 cancelUploadTask**

```typescript
async cancelUploadTask(taskId: number): Promise<void> {
  await transferQueueManager.cancelTask(taskId)
}
```

- [ ] **步骤 2：修改 queueDownloadWithSession**

```typescript
async queueDownloadWithSession(taskData: any) {
  const { authService } = await import('../auth/auth.service')
  const session = authService.getCurrentSession()
  if (!session) throw new IPCError('用户未登录', IPCErrorCode.UNAUTHORIZED)

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
  return { taskId: task.id, dbId }
}
```

- [ ] **步骤 3：修改 batchQueueDownloadWithSession**

```typescript
async batchQueueDownloadWithSession(remotePaths: string[]) {
  const { authService } = await import('../auth/auth.service')
  const session = authService.getCurrentSession()
  if (!session) throw new IPCError('用户未登录', IPCErrorCode.UNAUTHORIZED)

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
  return { successCount: batchResult.length, failedCount: 0 }
}
```

- [ ] **步骤 4：修改 cancelDownloadTask 和 resumeUploadTask**

```typescript
async cancelDownloadTask(taskId: string): Promise<void> {
  const { DownloadManager } = await import('./download.manager')
  const { transferService } = await import('./transfer.service')
  const downloadManager = new DownloadManager()
  await downloadManager.cancelDownload(taskId)
  await transferService.cancelTask(Number(taskId))
  await this.removeDownloadFromQueue(taskId)
}

async resumeUploadTask(taskId: number, userToken: string, username: string): Promise<void> {
  const { transferService } = await import('./transfer.service')
  const task = await transferService.getTask(taskId)
  if (!task) throw new IPCError('任务不存在', IPCErrorCode.NOT_FOUND)
  if (!task.resumable) throw new IPCError('该任务不支持恢复', IPCErrorCode.CONFLICT)

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
}
```

- [ ] **步骤 5：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 6：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/transfer/queue.service.ts
git commit -m "refactor: queue.service 移除 success 字段，返回纯业务数据"
```

---

## 任务 4：清理 transfer.service.ts

**文件：**
- 修改：`src/main/features/transfer/transfer.service.ts`

- [ ] **步骤 1：修改 uploadFile**

在 `uploadFile` 方法末尾，将返回逻辑改为失败时抛异常：

```typescript
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

if (!success) {
  throw new IPCError('上传任务执行失败', IPCErrorCode.NETWORK)
}

return {
  taskId: uploadResult.taskId,
  fileInfo: {
    fileName,
    fileSize: fileStats.size,
    remotePath: `${alistService.getBasePath()}${params.remotePath}`,
    uploadedAt: new Date().toISOString()
  }
}
```

- [ ] **步骤 2：修改 downloadFile**

```typescript
return { taskId, savePath }
```

- [ ] **步骤 3：修改 saveAs**

```typescript
async saveAs(fileName: string, userId: number) {
  const { dialog } = await import('electron')
  const { DownloadManager } = await import('./download.manager')
  const { preferencesService } = await import('../../core/preferences/preferences.service')
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
    return null
  }

  const selectedDir = path.dirname(result.filePath)
  preferencesService.saveLastDownloadPath(userId, selectedDir)

  return { filePath: result.filePath }
}
```

- [ ] **步骤 4：修改 resumeDownload**

删除末尾的 `return { success: true }`，方法自然返回 `void`。

- [ ] **步骤 5：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 6：Commit**

```bash
cd LiuliuCloudStorage
git add src/main/features/transfer/transfer.service.ts
git commit -m "refactor: transfer.service 移除 success 字段，失败抛 IPCError"
```

---

## 任务 5：调整 useTransferDownload.ts

**文件：**
- 修改：`src/renderer/src/features/transfer/composables/useTransferDownload.ts`

- [ ] **步骤 1：修改 queueDownload**

```typescript
async function queueDownload(remotePath: string, fileName: string, savePath?: string) {
  try {
    const { useAuthStore } = await import('@/features/auth')
    const authStore = useAuthStore()

    if (!authStore.isLoggedIn || !authStore.user) {
      return { success: false, error: '用户未登录,无法添加下载任务' }
    }

    const userId = authStore.user.id
    const userToken = authStore.user.token
    const taskId = `download_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    const result = await transferRendererService.queueDownload({
      id: taskId,
      remotePath,
      fileName,
      savePath,
      userId,
      userToken,
      priority: downloadQueue.length
    })

    if (!result) {
      return { success: false, error: '添加到队列失败' }
    }
    return { success: true, taskId: result.taskId, dbId: result.dbId }
  } catch (error: any) {
    return { success: false, error: error.message || '添加到队列失败' }
  }
}
```

- [ ] **步骤 2：修改 batchQueueDownload**

```typescript
async function batchQueueDownload(filePaths: string[]) {
  try {
    const result = await transferRendererService.batchQueueDownload(filePaths)
    if (!result) {
      return { success: false, successCount: 0, failedCount: filePaths.length, error: '批量添加到队列失败' }
    }
    return { success: true, successCount: result.successCount, failedCount: result.failedCount }
  } catch (error: any) {
    return { success: false, successCount: 0, failedCount: filePaths.length, error: error.message || '批量添加到队列失败' }
  }
}
```

- [ ] **步骤 3：修改 downloadWithSaveAs**

```typescript
async function downloadWithSaveAs(remotePath: string, fileName: string, userId: number, userToken: string) {
  try {
    const saveAsResult = await transferRendererService.saveAs(fileName, userId)

    if (saveAsResult === null) {
      return { success: false, canceled: true }
    }

    if (!saveAsResult?.filePath) {
      return { success: false, error: '选择保存位置失败' }
    }

    const downloadResult = await transferRendererService.download({
      remotePath,
      fileName,
      userId,
      userToken,
      savePath: saveAsResult.filePath
    })

    return downloadResult || { success: false, error: '下载失败' }
  } catch (error: any) {
    return { success: false, error: error.message || '另存为下载失败' }
  }
}
```

- [ ] **步骤 4：修改 pauseDownloadQueue、resumeDownloadQueue、clearDownloadQueue、clearPendingQueue、clearActiveQueue**

统一改为 `result === null` 判断：

```typescript
async function pauseDownloadQueue() {
  try {
    const result = await transferRendererService.pauseDownloadQueue()
    if (result !== null) {
      store.setDownloadQueuePaused(true)
    }
    return { success: result !== null }
  } catch (error: any) {
    return { success: false, error: error.message || '暂停队列失败' }
  }
}

async function resumeDownloadQueue() {
  try {
    const result = await transferRendererService.resumeDownloadQueue()
    if (result !== null) {
      store.setDownloadQueuePaused(false)
    }
    return { success: result !== null }
  } catch (error: any) {
    return { success: false, error: error.message || '恢复队列失败' }
  }
}

async function clearDownloadQueue() {
  try {
    const result = await transferRendererService.clearDownloadQueue()
    return { success: result !== null }
  } catch (error: any) {
    return { success: false, error: error.message || '清空队列失败' }
  }
}

async function clearPendingQueue() {
  try {
    const result = await transferRendererService.clearPendingQueue()
    return { success: result !== null }
  } catch (error: any) {
    return { success: false, error: error.message || '清空等待队列失败' }
  }
}

async function clearActiveQueue() {
  try {
    const result = await transferRendererService.clearActiveQueue()
    return { success: result !== null }
  } catch (error: any) {
    return { success: false, error: error.message || '清空下载队列失败' }
  }
}
```

- [ ] **步骤 5：修改 initDownloadQueue**

```typescript
async function initDownloadQueue(userId: number, userToken: string) {
  try {
    const result = await transferRendererService.initDownloadQueue(userId, userToken)
    if (result?.restoredCount !== undefined) {
      console.log(`[useTransferDownload] 下载队列初始化完成，恢复了 ${result.restoredCount} 个任务`)
    }
    await fetchDownloadQueueState()
  } catch (error: any) {
    console.error('[useTransferDownload] 初始化下载队列失败:', error)
  }
}
```

- [ ] **步骤 6：修改 resumeDownload、cancelDownload、cancelAllDownloads**

```typescript
async function resumeDownload(taskId: number) {
  try {
    const result = await transferRendererService.resumeDownload(taskId)
    if (result === null) {
      throw new Error('恢复下载失败')
    }
    return { success: true }
  } catch (error: any) {
    console.error('恢复下载失败:', error)
    ElMessage.error(error.message || '恢复下载失败')
    throw error
  }
}

async function cancelDownload(taskId: string | number) {
  try {
    const result = await transferRendererService.cancelDownload(taskId)
    if (result === null) {
      throw new Error('取消下载失败')
    }
    ElMessage.success('下载已取消')
    return { success: true }
  } catch (error: any) {
    console.error('取消下载失败:', error)
    ElMessage.error(error.message || '取消下载失败')
    throw error
  }
}

async function cancelAllDownloads() {
  const authStore = (await import('@/features/auth')).useAuthStore()
  if (!authStore.user) {
    ElMessage.error('请先登录')
    return
  }
  try {
    const result = await transferRendererService.cancelAllDownloads(authStore.user.id)
    if (result === null) {
      throw new Error('取消所有下载失败')
    }
    ElMessage.success('所有下载已取消')
    return { success: true }
  } catch (error: any) {
    console.error('取消所有下载失败:', error)
    ElMessage.error(error.message || '取消下载失败')
    throw error
  }
}
```

- [ ] **步骤 7：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 8：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/features/transfer/composables/useTransferDownload.ts
git commit -m "fix: useTransferDownload 适配 service 层新返回格式"
```

---

## 任务 6：调整 useTransferUpload.ts

**文件：**
- 修改：`src/renderer/src/features/transfer/composables/useTransferUpload.ts`

- [ ] **步骤 1：修改 resumeUpload 和 autoRetryFailedTasks**

```typescript
async function resumeUpload(taskId: string | number, userId: number, userToken: string, username: string) {
  const result = await transferRendererService.resume(
    typeof taskId === 'number' ? taskId : parseInt(taskId as string) || 0,
    userId,
    userToken,
    username
  )
  if (result !== null) {
    store.updateUploadTaskStatus(taskId, 'in_progress')
  }
  return result
}

async function autoRetryFailedTasks(userId: number, userToken: string, username: string) {
  const result = await transferRendererService.autoRetryAll(userId, userToken, username)
  if (result !== null) {
    const failedTasks = uploadQueue.filter(t => t.status === 'failed' && t.resumable)
    failedTasks.forEach(task => {
      store.updateUploadTaskStatus(task.id, 'in_progress')
    })
  }
  return result
}
```

- [ ] **步骤 2：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/features/transfer/composables/useTransferUpload.ts
git commit -m "fix: useTransferUpload 适配 service 层新返回格式"
```

---

## 任务 7：调整 BatchActionToolbar.vue

**文件：**
- 修改：`src/renderer/src/components/file/BatchActionToolbar.vue:76-92`

- [ ] **步骤 1：修改 handleBatchDownload 结果处理**

```typescript
// 使用批量入队：先立即显示在等待列表，再分批获取下载链接
const result = await batchQueueDownload(filePaths)

// 清空选中状态
fileStore.clearSelection()

// 显示结果
if (!result.success) {
  ElMessage.error(result.error || '添加失败，请稍后重试')
} else if (result.successCount === 0) {
  ElMessage.warning('没有新的文件需要下载（可能已在队列中）')
} else if (result.failedCount === 0) {
  ElMessage.success(`已添加 ${result.successCount} 个文件到下载队列`)
} else {
  ElMessage.warning(`成功添加 ${result.successCount} 个文件，失败 ${result.failedCount} 个`)
}
```

- [ ] **步骤 2：验证类型检查通过**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：无类型错误

- [ ] **步骤 3：Commit**

```bash
cd LiuliuCloudStorage
git add src/renderer/src/components/file/BatchActionToolbar.vue
git commit -m "fix: BatchActionToolbar 区分异常失败与无新任务"
```

---

## 任务 8：最终验证

- [ ] **步骤 1：全量类型检查**

运行：`cd LiuliuCloudStorage && npx tsc --noEmit`
预期：零错误

- [ ] **步骤 2：构建验证**

运行：`cd LiuliuCloudStorage && pnpm build`
预期：构建成功

- [ ] **步骤 3：手动功能测试**

启动应用，验证以下场景：
- [ ] 点击单个文件下载 → 成功提示，队列显示任务
- [ ] 选择 1 个文件批量下载 → 成功提示，无"添加失败"弹窗
- [ ] 选择多个文件批量下载 → 正确计数，全部成功
- [ ] 下载队列面板 → 显示待下载任务
- [ ] 另存为下载 → 正常工作
- [ ] 上传文件 → 不受影响

- [ ] **步骤 4：Commit 验证结果**

```bash
cd LiuliuCloudStorage
git commit --allow-empty -m "test: IPC 返回值格式修复验证完成"
```

---

## 自检

### 1. 规格覆盖度

| 规格需求 | 对应任务 |
|---|---|
| 收紧 `isIPCResult` | 任务 1 |
| `cancelTask` 返回 void | 任务 2 |
| `queueDownloadWithSession` 移除 success | 任务 3 步骤 2 |
| `batchQueueDownloadWithSession` 移除 success | 任务 3 步骤 3 |
| `cancelUploadTask` 返回 void | 任务 3 步骤 1 |
| `cancelDownloadTask` 返回 void | 任务 3 步骤 4 |
| `resumeUploadTask` 返回 void | 任务 3 步骤 4 |
| `uploadFile` 失败抛异常 | 任务 4 步骤 1 |
| `downloadFile` 移除 success | 任务 4 步骤 2 |
| `saveAs` 返回 null / `{ filePath }` | 任务 4 步骤 3 |
| `resumeDownload` 返回 void | 任务 4 步骤 4 |
| useTransferDownload 调整判断 | 任务 5 |
| useTransferUpload 调整判断 | 任务 6 |
| BatchActionToolbar 区分失败/无新任务 | 任务 7 |

**覆盖度：** 100%，无遗漏。

### 2. 占位符扫描

- [x] 无 "待定"、"TODO"
- [x] 所有步骤包含实际代码
- [x] 无 "类似任务 N" 的重复引用
- [x] 所有命令精确

### 3. 类型一致性

- [x] `result === null` 用法一致（判断 invoke 失败）
- [x] `result !== null` 用法一致（判断 invoke 成功）
- [x] `IPCError` 引用一致
- [x] 返回格式命名一致

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-05-18-fix-ipc-result-format.md`。两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
