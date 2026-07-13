# 架构重构收尾工作设计文档

## 背景

代码库已完成从旧架构到 Feature-Based + Composable-First 架构的主体迁移，但仍有三个模块未完全符合 [2026-05-16 架构设计文档](./2026-05-16-codebase-architecture-refactor-design.md) 的标准。本文档定义收尾工作的具体执行方案。

## 问题清单

| # | 问题 | 位置 | 违反原则 |
|---|------|------|---------|
| 1 | transfer handlers 过于臃肿 | `main/features/transfer/transfer.handlers.ts` (353 行) | Handler 厚度应 ≤ 20 行 |
| 2 | auth store 包含业务逻辑和 IPC 调用 | `renderer/src/features/auth/stores/authStore.ts` | Store 不调用 IPC，只做状态存储 |
| 3 | 旧 IPC handlers 未迁移到 feature 目录 | `main/ipc/handlers/*.ts` (5 个文件) | 按 feature 组织代码 |

## 执行策略：先易后难

### 阶段 1：auth store 清理 + 旧 handler 迁移

#### 1.1 auth store 清理

**目标**：Store 只保留状态和同步 setter/getter，所有 async 逻辑移到 `useAuth.ts` composable。

**authStore.ts 保留**：
- `user` ref
- `isLoggedIn` / `isAdmin` computed
- `setUser(data)` — 同步 setter
- `clearUser()` — 同步 setter

**authStore.ts 移除并移到 useAuth.ts**：
- `logout()` → `useAuth().logout()`
- `checkAdminPermission()` → `useAuth().checkAdminPermission()`
- `triggerStartupAutoSync()` → `useAuth().handlePostLogin()`（登录后的副作用）
- `initUserFromSession()` → 拆分为同步 `setUserFromSession()`（store）+ `initializeAuth()`（composable，含 async 部分）

**迁移影响**：所有调用 `authStore.logout()` 的组件改为调用 `useAuth().logout()`。

#### 1.2 旧 handler 迁移

`main/ipc/handlers/` 下的文件按功能映射到 feature 目录：

| 旧文件 | 目标位置 | 说明 |
|--------|---------|------|
| `app.ts` | `main/features/app/app.handlers.ts` + `app.service.ts` | 开机启动、版本号、打开日志目录 |
| `dialog.ts` | `main/features/dialog/dialog.handlers.ts` + `dialog.service.ts` | 文件选择对话框 |
| `tray.ts` | `main/features/tray/tray.handlers.ts` + `tray.service.ts` | 托盘状态更新、显隐窗口 |
| `notification.ts` | `main/features/notification/notification.handlers.ts` + `notification.service.ts` | 系统通知 |
| `update.ts` | `main/features/update/update.handlers.ts` + `update.service.ts` | 检查更新、安装更新 |

迁移要求：
- 所有 handler 统一使用 `handleIPC` 包装器
- Service 层不感知 IPC，只封装纯业务逻辑
- 更新 `preload/index.ts` 的 `validChannels` 白名单（如有新通道）

### 阶段 2：transfer handler 瘦身

#### 2.1 核心策略

所有 handler 遵循统一模式：

```typescript
ipcMain.handle('feature:action', async (_event, params) => {
  return handleIPC(async () => {
    // 1. 解包参数
    // 2. 构造进度回调（如需要）
    // 3. 调用 service
    // 4. 返回结果
  })
})
```

**handler 中唯一允许的业务代码**：构造进度回调并传给 service。因为进度推送需要访问 `_event.sender`，这是 IPC 层特有的。

#### 2.2 各 handler 拆分方案

| Handler | 当前行数 | 下沉到 Service 的内容 | Handler 保留 |
|---------|---------|---------------------|-------------|
| `transfer:upload` | ~40 | `alistService` 配置、`fs.statSync`、上传逻辑、`waitForTaskCompletion` | 进度回调包装 |
| `transfer:download` | ~48 | `alistService` 配置、获取下载 URL、`DownloadManager` 创建和调用 | 进度回调包装 |
| `transfer:saveAs` | ~24 | `dialog.showSaveDialog` 调用、偏好设置读写 | 无（全部移到 service）|
| `transfer:restore-queue` | ~16 | 循环添加任务逻辑 | 参数解包 |
| `transfer:resume` | ~19 | 任务恢复逻辑、添加到队列 | 参数解包 |
| `transfer:initDownloadQueue` | ~9 | 凭据设置、队列恢复、进度回调绑定 | 进度回调包装 |
| `transfer:queueDownload` | ~18 | session 检查、task 构造、添加到队列 | 参数解包 |
| `transfer:batchQueueDownload` | ~17 | session 检查、tasks 构造、批量添加 | 参数解包 |
| `transfer:resumeDownload` | ~22 | 任务获取、`resumeDownload` 调用 | 进度回调包装 |
| `transfer:cancelDownload` | ~9 | 取消下载、取消任务、移除队列、发送事件 | 参数解包 |
| 其余 12 个 | 2-5 | 已符合规范，无需改动 | — |

#### 2.3 进度回调处理模式

所有需要进度推送的 handler 使用统一模式：

```typescript
// handler
ipcMain.handle('transfer:upload', async (_event, params) => {
  return handleIPC(async () => {
    const onProgress = (data) => _event.sender.send('transfer:progress', data)
    return transferService.upload(params, onProgress)
  })
})

// service
export type ProgressCallback = (data: ProgressData) => void

async upload(params: UploadParams, onProgress?: ProgressCallback): Promise<...>
```

#### 2.4 预期结果

迁移后 `transfer.handlers.ts` 从 **353 行 → 约 120-150 行**，每个 handler 不超过 15 行。

## 验证 Checklist

- [ ] IPC 调用有类型安全
- [ ] Store 只包含状态和简单 setter
- [ ] 业务逻辑在 composable / service 中
- [ ] Main service 不感知 IPC
- [ ] Handler 厚度不超过 20 行
- [ ] 错误处理统一使用 `handleIPC`
- [ ] 旧代码已删除
- [ ] 构建通过
