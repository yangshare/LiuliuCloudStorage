# 修复既有 TypeScript 错误

## 背景

架构重构收尾工作完成后，代码库存在 22 个既有 TypeScript 编译错误，分布在 9 个文件中。这些错误在重构前已存在，不影响功能但降低代码可信度。

## 错误清单

### 类别 1：未使用导入/变量（6 个）

| 文件 | 错误码 | 说明 | 修复方式 |
|------|--------|------|---------|
| `activity.service.ts:2` | TS6192 | 导入声明全部未使用 | 删除未使用的导入 |
| `downloadConfig.service.ts:2` | TS6192 | 导入声明全部未使用 | 删除未使用的导入 |
| `file.service.ts:8` | TS6133 | `handleIPC` 声明未使用 | 删除未使用的导入 |
| `file.service.ts:9` | TS6196 | `FileListResponse` 声明未使用 | 删除未使用的导入 |
| `file.service.ts:9` | TS6196 | `FileOperationResult` 声明未使用 | 删除未使用的导入 |
| `useTransferUpload.ts:13` | TS6133 | `COMPLETED_TASK_CLEANUP_DELAY_MS` 未使用 | 删除未使用的常量 |

### 类别 2：Drizzle ORM `limit` 属性缺失（2 个）

| 文件 | 错误码 | 说明 | 修复方式 |
|------|--------|------|---------|
| `TransferService.ts:362` | TS2741 | `limit` 属性缺失 | 链式调用 `.limit()` 后变量类型推断问题 |
| `TransferService.ts:380` | TS2741 | `limit` 属性缺失 | 同上 |

**根因**：Drizzle ORM 的 `SQLiteSelect` 链式调用中，`limit()` 返回的类型与期望的 `SQLiteSelect` 不完全兼容。需要重构链式调用或调整类型注解。

### 类别 3：lodash-es 类型声明缺失（1 个）

| 文件 | 错误码 | 说明 | 修复方式 |
|------|--------|------|---------|
| `useTransferDownload.ts:2` | TS7016 | 找不到 lodash-es 声明文件 | 安装 `@types/lodash-es` 或添加类型声明文件 |

### 类别 4：Store API 不匹配（8 个）

| 文件 | 错误码 | 说明 | 修复方式 |
|------|--------|------|---------|
| `useFile.ts:7` | TS6133 | `FileItem` 导入未使用 | 删除或检查是否确实需要 |
| `useFile.ts:18` | TS2339 | `setLoading` 不存在 | 检查 fileStore API |
| `useFile.ts:22` | TS2339 | `setFileList` 不存在 | 检查 fileStore API |
| `useFile.ts:23` | TS2551 | `setCurrentPath` 不存在 | 检查 fileStore API |
| `useFile.ts:25` | TS2339 | `error` 不存在 | 检查类型定义 |
| `useFile.ts:30` | TS2339 | `setLoading` 不存在 | 同上 |
| `useFile.ts:126` | TS2339 | `setLoading` 不存在 | 同上 |
| `useFile.ts:139` | TS2339 | `setLoading` 不存在 | 同上 |
| `useFile.ts:146` | TS2339 | `fileList` 不存在 | 检查 fileStore API |
| `useFile.ts:147` | TS2339 | `isLoading` 不存在 | 检查 fileStore API |

**根因**：`useFile.ts` 中引用的 store 方法名与实际 store 导出的 API 不一致。需要查看 `fileStore.ts` 的实际导出并修正引用。

### 类别 5：未导出类型（1 个）

| 文件 | 错误码 | 说明 | 修复方式 |
|------|--------|------|---------|
| `downloadConfig/index.ts:1` | TS2459 | `DownloadConfig` 未导出 | 检查 store 文件并导出类型 |

### 类别 6：隐式 any（2 个）

| 文件 | 错误码 | 说明 | 修复方式 |
|------|--------|------|---------|
| `updateStore.ts:31` | TS7006 | `progress` 隐式 any | 添加类型注解 |
| `updateStore.ts:39` | TS7006 | `message` 隐式 any | 添加类型注解 |

## 修复策略

按类别批量修复，每类修复后运行 `pnpm exec tsc --noEmit` 验证：

1. **类别 1**：删除未使用导入/变量（最简单）
2. **类别 3**：安装类型包或添加声明
3. **类别 5**：导出缺失类型
4. **类别 6**：添加类型注解
5. **类别 2**：调整 Drizzle 链式调用
6. **类别 4**：修正 Store API 引用（最复杂，放到最后）

## 验证 Checklist

- [ ] `pnpm exec tsc --noEmit` 0 errors
- [ ] 修复的每个文件单独检查，确保没有引入新错误
- [ ] 功能未被破坏（没有修改运行时行为）
