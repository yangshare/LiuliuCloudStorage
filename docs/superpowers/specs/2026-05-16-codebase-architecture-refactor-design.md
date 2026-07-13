# 代码架构重构设计文档

## 概述

本文档定义溜溜网盘桌面客户端从当前架构迁移到 **Feature-Based + Composable-First** 架构的完整方案。

## 现状问题

1. **Store 臃肿**：`transferStore.ts` 1034 行，混合了状态、业务逻辑、通知、网络监听
2. **职责错位**：业务逻辑散落在 IPC handlers、QueueManager 和 Store 中
3. **目录混乱**：按技术角色（components/stores/services）组织，新增功能时不知放哪
4. **类型边界模糊**：数据库实体、IPC 传输对象、UI 状态对象混用

## 目标架构

### 核心原则

| 原则 | 说明 |
|------|------|
| Feature 内聚 | 一个业务功能的所有代码在同一个目录下 |
| Store 只存状态 | Pinia store = state + getters + 简单 setter，不处理业务逻辑 |
| Composables 承载业务逻辑 | IPC 调用、数据处理、副作用写在 composables |
| IPC 薄层 | Main 进程的 handlers 厚度不超过 20 行 |
| 单向依赖 | Composable → Store → Component；Service → Handler |

### 目录结构

```
src/
├── main/
│   ├── core/
│   │   ├── database/
│   │   ├── logger/
│   │   └── ipc/
│   │       └── error-handler.ts
│   └── features/
│       ├── auth/
│       │   ├── auth.service.ts
│       │   ├── auth.handlers.ts
│       │   └── index.ts
│       ├── transfer/
│       │   ├── transfer.service.ts
│       │   ├── transfer.handlers.ts
│       │   └── index.ts
│       └── ...
│
├── preload/
│   └── index.ts
│
├── renderer/src/
│   ├── core/
│   │   ├── router/
│   │   ├── composables/
│   │   │   └── useNotification.ts
│   │   └── utils/
│   └── features/
│       ├── auth/
│       │   ├── auth.renderer.service.ts
│       │   ├── stores/
│       │   │   └── authStore.ts
│       │   ├── composables/
│       │   │   └── useAuth.ts
│       │   └── components/
│       ├── transfer/
│       │   ├── transfer.renderer.service.ts
│       │   ├── stores/
│       │   │   └── transferStore.ts
│       │   ├── composables/
│       │   │   ├── useTransfer.ts
│       │   │   ├── useUploadQueue.ts
│       │   │   └── useDownloadQueue.ts
│       │   └── components/
│       └── ...
│
└── shared/
    └── types/
        ├── ipc.ts
        ├── auth.ts
        ├── transfer.ts
        └── ...
```

## 各层职责

### Main 进程

#### Service 层
- 纯业务逻辑，不感知 IPC
- 直接操作 Drizzle ORM，不需要额外 Repository 层
- 可独立单元测试

#### Handler 层
- 厚度不超过 20 行
- 只做三件事：解包参数 → 调用 service → 包装响应
- 统一使用 `handleIPC` 包装器捕获异常

### Renderer 进程

#### Service 层（Renderer）
- 封装 IPC 调用
- 统一错误处理
- 提供类型安全

#### Composables
- 承载所有业务逻辑
- 调用 renderer service
- 处理副作用（通知、定时器、事件监听）

#### Store（Pinia）
- 只存 state + getters
- Actions 只做状态更新，不处理业务逻辑
- 不调用 IPC

## IPC 契约规范

### 命名格式

三层结构：`领域:子资源:动作`

```
transfer:upload:create
transfer:upload:list
transfer:upload:cancel
transfer:download:create
transfer:download:pause
file:list
file:mkdir
auth:login
auth:session:check
```

### 统一响应格式

```typescript
// shared/types/ipc.ts

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
```

### 错误处理

Main 进程统一包装：

```typescript
import { IPCError } from '../../core/ipc/error-handler'

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
    logger.error('IPC handler error:', error)
    return { success: false, error: '服务器内部错误', code: IPCErrorCode.INTERNAL }
  }
}
```

Renderer 进程统一处理：

```typescript
export function useIPC() {
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

## 数据流规范

```
Main (Source of Truth)
    ↓ 推送状态变更 (ipcRenderer.send)
Preload
    ↓ 事件转发
Renderer Store (接收状态，更新 ref)
    ↓ 响应式绑定
Component (只读显示)

Component 用户操作
    ↓ 调用 composable action
Composable
    ↓ 调用 renderer service
Renderer Service
    ↓ IPC invoke
Main Handler
    ↓ 调用 service
Main Service (修改数据库，推状态变更)
```

**关键规则：**
1. 状态唯一来源是 Main 进程的数据库
2. Renderer store 是缓存，通过事件保持同步
3. 组件不直接调用 IPC，必须通过 composable
4. 禁止组件之间直接传递状态

## 迁移路径

### 迁移原则

| 原则 | 说明 |
|------|------|
| 逐个模块迁移 | 一次只迁移一个 feature |
| 新旧共存 | 迁移期间旧代码继续工作 |
| 从外到内 | 先迁 IPC 契约（类型），再迁 Renderer，最后迁 Main |
| 先易后难 | 先迁简单模块建立信心 |

### 模块优先级

1. **auth** — 逻辑简单，建立样板（1-2 天）
2. **file** — 文件列表、目录操作（2-3 天）
3. **transfer** — 上传/下载核心模块（3-5 天）
4. **download / admin / auto-sync** — 剩余模块

### 单个模块迁移步骤

1. 创建 `shared/types/{feature}.ts` 共享类型
2. 迁移 Main service（纯业务逻辑）
3. 迁移 Main handlers（薄层，使用 `handleIPC`）
4. 更新 Preload 类型定义
5. 迁移 Renderer service（IPC 调用封装）
6. 迁移 Store（精简为纯状态）
7. 迁移 Composables（业务逻辑）
8. 组件层替换为新的 composables
9. 清理旧代码

### 迁移检查清单

- [ ] IPC 调用有类型安全
- [ ] Store 只包含状态和简单 setter
- [ ] 业务逻辑在 composable 中
- [ ] Main service 不感知 IPC
- [ ] Handler 厚度不超过 20 行
- [ ] 错误处理统一
- [ ] 旧代码已删除

## 示例代码

### Main Service

```typescript
// main/features/transfer/transfer.service.ts

import { db } from '../../core/database'
import { transferQueue } from '../../core/database/schema'
import { eq, and } from 'drizzle-orm'
import type { UploadTask, QueueUploadParams, IPCResult } from '../../../shared/types/transfer'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'

export class TransferService {
  async createUploadTask(params: QueueUploadParams): Promise<IPCResult<UploadTask>> {
    const existing = await db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.remotePath, params.remotePath),
        eq(transferQueue.status, 'pending')
      ))
      .get()

    if (existing) {
      throw new IPCError('该文件已在等待队列中', IPCErrorCode.CONFLICT)
    }

    const task = await db.insert(transferQueue)
      .values({
        filePath: params.filePath,
        remotePath: params.remotePath,
        userId: params.userId,
        status: 'pending',
        taskType: 'upload',
        createdAt: new Date()
      })
      .returning()
      .get()

    return { success: true, data: this.toUploadTask(task) }
  }

  private toUploadTask(row: any): UploadTask {
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

### IPC Handler

```typescript
// main/features/transfer/transfer.handlers.ts

import { ipcMain } from 'electron'
import { transferService } from './transfer.service'
import { handleIPC } from '../../core/ipc/error-handler'
import type { QueueUploadParams } from '../../../shared/types/transfer'

export function registerTransferHandlers() {
  ipcMain.handle('transfer:upload:create', async (_event, params: QueueUploadParams) => {
    return handleIPC(() => transferService.createUploadTask(params))
  })
}
```

### Renderer Store

```typescript
// renderer/src/features/transfer/stores/transferStore.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UploadTask, DownloadTask } from '../../../../shared/types/transfer'

export const useTransferStore = defineStore('transfer', () => {
  const uploadTasks = ref<UploadTask[]>([])
  const downloadTasks = ref<DownloadTask[]>([])
  const isQueuePaused = ref(false)

  const pendingUploads = computed(() =>
    uploadTasks.value.filter(t => t.status === 'pending')
  )

  function setUploadTasks(tasks: UploadTask[]) {
    uploadTasks.value = tasks
  }

  function updateTaskProgress(taskId: string, progress: number) {
    const task = uploadTasks.value.find(t => t.id === taskId)
    if (task) task.progress = progress
  }

  return {
    uploadTasks, downloadTasks, isQueuePaused,
    pendingUploads,
    setUploadTasks, updateTaskProgress
  }
})
```

### Composable

```typescript
// renderer/src/features/transfer/composables/useUploadQueue.ts

import { ref, onMounted, onUnmounted } from 'vue'
import { useTransferStore } from '../stores/transferStore'
import { transferRendererService } from '../transfer.renderer.service'
import { useNotification } from '@/core/composables/useNotification'

export function useUploadQueue() {
  const store = useTransferStore()
  const { showSuccess, showError } = useNotification()
  const isProcessing = ref(false)

  async function addUpload(filePath: string, targetPath: string, userId: number, userToken: string) {
    const result = await transferRendererService.upload.create({
      filePath, remotePath: targetPath, userId, userToken
    })

    if (!result.success) {
      showError(`添加失败: ${result.error}`)
      return { success: false, error: result.error }
    }

    if (result.data) {
      store.uploadTasks.push(result.data)
    }

    return { success: true }
  }

  onMounted(() => {
    transferRendererService.onProgress((data) => {
      store.updateTaskProgress(data.taskId, data.progress)
    })
  })

  return { addUpload, isProcessing, pendingUploads: store.pendingUploads }
}
```

## 风险与应对

| 风险 | 应对 |
|------|------|
| 迁移期间新旧代码冲突 | 新旧 IPC 通道用不同命名，共存直到旧代码删除 |
| 功能回归 | 每迁移一个模块，手动测试该模块核心流程 |
| 迁移耗时超出预期 | auth 模块控制在 1-2 天内完成，验证可行性 |
| Store 拆分后组件报错 | 先保留旧 store 导出，新 store 用不同名称，逐步替换 |
