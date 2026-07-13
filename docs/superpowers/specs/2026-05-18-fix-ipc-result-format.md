# 修复 IPC 返回值格式冲突导致的下载失败

## 背景

在执行 transfer feature 架构修复后，批量下载功能出现错误：
- 三个弹窗依次提示："正在准备添加..."、"正在添加..."、"添加失败，请稍后重试"
- 下载队列无记录

## 根因

`handleIPC` 的 `isIPCResult` 函数判断条件过于宽松：只要对象有 `success` 字段且为 boolean 就认为是 IPCResult。但重构后的 service 方法（如 `queueDownloadWithSession`、`batchQueueDownloadWithSession`）仍返回了 `{ success: true, ... }` 格式的业务对象，被误判为已包装好的 IPCResult。

结果是 `handleIPC` 直接原样返回，`useIPC().invoke()` 尝试提取 `.data` 字段得到 `undefined`，前端 composable 将 `undefined` 解释为失败。

## 修复原则

Service 层只返回纯业务数据或抛出 `IPCError`，绝不返回 `{ success: boolean, ... }` 格式的对象。`handleIPC` 负责统一包装为标准的 `IPCResult<T>`。

## Main 侧修改

### 1. error-handler.ts — 收紧 isIPCResult（安全网）

```typescript
function isIPCResult(data: unknown): data is IPCResult<unknown> {
  if (data === null || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('success' in d) || typeof d.success !== 'boolean') return false
  if (d.success === true) return 'data' in d
  return 'error' in d
}
```

### 2. transfer-queue.manager.ts — cancelTask

- 成功时返回 `void`
- 失败时抛出 `IPCError`

### 3. queue.service.ts

| 方法 | 修改后返回 |
|---|---|
| `cancelUploadTask` | `void` |
| `queueDownloadWithSession` | `{ taskId, dbId }` |
| `batchQueueDownloadWithSession` | `{ successCount, failedCount }` |
| `cancelDownloadTask` | `void` |
| `resumeUploadTask` | `void` |

### 4. transfer.service.ts

| 方法 | 修改后返回 |
|---|---|
| `uploadFile` | `{ taskId, fileInfo }`（失败抛 IPCError） |
| `downloadFile` | `{ taskId, savePath }` |
| `saveAs` | `null`（取消）/ `{ filePath }`（成功） |
| `resumeDownload` | `void` |

## Renderer 侧修改

### 5. useTransferDownload.ts

| 方法 | 修改后判断 |
|---|---|
| `queueDownload` | `result?.dbId !== undefined` |
| `batchQueueDownload` | `result || { successCount: 0, failedCount: filePaths.length, error: '...' }` |
| `downloadWithSaveAs` | `saveAsResult === null` / `saveAsResult?.filePath` |
| `resumeDownload` | `result !== null` |
| `cancelDownload` | `result !== null` |
| `cancelAllDownloads` | `result !== null` |

### 6. useTransferUpload.ts

| 方法 | 修改后判断 |
|---|---|
| `resumeUpload` | 直接执行，错误已由 invoke 处理 |
| `autoRetryFailedTasks` | 直接执行，错误已由 invoke 处理 |

### 7. BatchActionToolbar.vue

`handleBatchDownload` 中：
- `result === null` → 批量添加失败
- `result.successCount === 0` → 无新任务（全部重复或空列表）
- `result.successCount > 0` → 成功

## 验证步骤

1. 运行 `npx tsc --noEmit` 确认类型检查通过
2. 启动应用，验证：
   - 单个文件下载 → 成功添加到队列
   - 批量下载（选1个文件）→ 成功，无"添加失败"弹窗
   - 批量下载（选多个文件）→ 成功，正确计数
   - 下载队列面板显示任务
   - 另存为下载 → 正常工作
   - 上传功能 → 不受影响
