# 修复既有 TypeScript 错误实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。

**目标：** 消除代码库中 22 个既有 TypeScript 编译错误。

**架构：** 按错误类别分组修复：先清理未使用导入（机械操作），再处理类型不匹配（需要理解代码），最后处理 Drizzle ORM API 问题。

**技术栈：** TypeScript + Drizzle ORM + Pinia + Electron

---

## 文件结构

**修改文件：**
- `src/main/features/activity/activity.service.ts` — 删除未使用导入
- `src/main/features/downloadConfig/downloadConfig.service.ts` — 删除未使用导入
- `src/main/features/file/file.service.ts` — 删除未使用导入
- `src/main/services/TransferService.ts` — 修复 Drizzle ORM `limit` 链式调用
- `src/renderer/src/features/downloadConfig/index.ts` — 导出缺失类型
- `src/renderer/src/features/file/composables/useFile.ts` — 修正 Store API 引用
- `src/renderer/src/features/transfer/composables/useTransferDownload.ts` — 修复 lodash-es 类型声明
- `src/renderer/src/features/transfer/composables/useTransferUpload.ts` — 删除未使用常量
- `src/renderer/src/features/update/stores/updateStore.ts` — 添加类型注解

---

## 任务 1：清理未使用导入/变量（6 个错误）

**文件：**
- 修改：`src/main/features/activity/activity.service.ts`
- 修改：`src/main/features/downloadConfig/downloadConfig.service.ts`
- 修改：`src/main/features/file/file.service.ts`
- 修改：`src/renderer/src/features/transfer/composables/useTransferUpload.ts`

- [ ] **步骤 1：修复 activity.service.ts**

读取文件第 2 行，删除未使用的 import。

- [ ] **步骤 2：修复 downloadConfig.service.ts**

读取文件第 2 行，删除未使用的 import。

- [ ] **步骤 3：修复 file.service.ts**

读取文件第 8-9 行，删除未使用的 `handleIPC`、`FileListResponse`、`FileOperationResult` 导入。

- [ ] **步骤 4：修复 useTransferUpload.ts**

读取文件第 13 行附近，删除未使用的 `COMPLETED_TASK_CLEANUP_DELAY_MS` 常量。

- [ ] **步骤 5：验证**

运行：`cd LiuliuCloudStorage && pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"`
预期：错误数从 22 降到 16

- [ ] **步骤 6：Commit**

```bash
cd LiuliuCloudStorage
git add -A
git commit -m "fix: 清理未使用导入和变量"
```

---

## 任务 2：修复类型声明缺失 + 隐式 any + 未导出类型（4 个错误）

**文件：**
- 修改：`src/renderer/src/features/transfer/composables/useTransferDownload.ts`
- 修改：`src/renderer/src/features/update/stores/updateStore.ts`
- 修改：`src/renderer/src/features/downloadConfig/index.ts`

- [ ] **步骤 1：检查 lodash-es 类型包**

运行：`cd LiuliuCloudStorage && cat package.json | grep lodash`

如果已安装 `lodash-es` 但没有 `@types/lodash-es`：
运行：`pnpm add -D @types/lodash-es`

如果 `@types/lodash-es` 不存在或不可用，创建声明文件：
创建 `src/renderer/src/types/lodash-es.d.ts`：
```typescript
declare module 'lodash-es' {
  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: { leading?: boolean; trailing?: boolean; maxWait?: number }
  ): T & { cancel(): void; flush(): void }
  // 根据实际使用情况添加更多导出
}
```

- [ ] **步骤 2：修复 updateStore.ts**

读取文件第 31 行和 39 行，为 `progress` 和 `message` 参数添加类型注解：
```typescript
// 第 31 行附近
onProgress: (progress: number) => { ... }

// 第 39 行附近
onMessage: (message: string) => { ... }
```

- [ ] **步骤 3：修复 downloadConfig/index.ts**

读取文件，检查 `DownloadConfig` 类型是否从 store 文件导出。如果 store 文件中有该类型但未导出，在 store 文件中添加 `export type DownloadConfig = ...`。如果类型不存在，检查是否应使用其他名称。

- [ ] **步骤 4：验证**

运行：`cd LiuliuCloudStorage && pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"`
预期：错误数从 16 降到 12

- [ ] **步骤 5：Commit**

```bash
cd LiuliuCloudStorage
git add -A
git commit -m "fix: 修复类型声明缺失和隐式 any"
```

---

## 任务 3：修正 Store API 不匹配（8 个错误）

**文件：**
- 修改：`src/renderer/src/features/file/composables/useFile.ts`
- 参考：`src/renderer/src/features/file/stores/fileStore.ts`

- [ ] **步骤 1：读取 fileStore.ts 的实际导出**

读取 `src/renderer/src/features/file/stores/fileStore.ts`，记录实际导出的 state、getters 和 actions。

- [ ] **步骤 2：对比 useFile.ts 的引用**

读取 `src/renderer/src/features/file/composables/useFile.ts` 第 7-147 行，对比引用的 store 方法与实际导出。

常见不匹配：
- `store.setLoading()` → 可能应为 `store.isLoading = value`
- `store.setFileList()` → 可能应为 `store.files = list`
- `store.setCurrentPath()` → 可能应为 `store.currentPath = path`
- `store.fileList` → 可能应为 `store.files`

- [ ] **步骤 3：修改 useFile.ts**

根据 fileStore.ts 的实际导出，修正所有引用。

- [ ] **步骤 4：验证**

运行：`cd LiuliuCloudStorage && pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"`
预期：错误数从 12 降到 4

- [ ] **步骤 5：Commit**

```bash
cd LiuliuCloudStorage
git add -A
git commit -m "fix: 修正 file store API 引用"
```

---

## 任务 4：修复 Drizzle ORM limit 属性缺失（2 个错误）

**文件：**
- 修改：`src/main/services/TransferService.ts`
- 参考：Drizzle ORM SQLiteSelect 类型定义

- [ ] **步骤 1：读取错误位置代码**

读取 `src/main/services/TransferService.ts` 第 362 行和 380 行附近的代码。

- [ ] **步骤 2：分析链式调用**

Drizzle ORM 的 `SQLiteSelect` 链式调用中，`.limit()` 可能改变了返回类型，导致后续无法再次调用 `.orderBy()` 或 `.all()`。

修复方式通常有两种：
1. 调整链式调用顺序（先 `.limit()` 后 `.orderBy()`）
2. 提取中间变量，确保类型正确

- [ ] **步骤 3：修改代码**

根据实际代码选择修复方式。

- [ ] **步骤 4：验证**

运行：`cd LiuliuCloudStorage && pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"`
预期：错误数从 4 降到 0

- [ ] **步骤 5：Commit**

```bash
cd LiuliuCloudStorage
git add -A
git commit -m "fix: 修复 Drizzle ORM limit 链式调用类型"
```

---

## 最终验证

所有任务完成后：

- [ ] 运行 `cd LiuliuCloudStorage && pnpm exec tsc --noEmit`
- [ ] 预期输出：`0` 个错误或无任何 `error TS` 输出
- [ ] 运行 `cd LiuliuCloudStorage && pnpm exec vue-tsc --noEmit --project src/renderer/tsconfig.json`
- [ ] 预期输出：renderer 侧无新增错误
