# 溜溜网盘

一个基于 Electron 的桌面端网盘工具，核心功能是**某度网盘分享链接批量转存**后高速下载。

## 技术架构

### 架构概览

采用**三层分离架构**，主进程与渲染进程职责分明，通过 preload 安全桥接：

```
┌─────────────────────────────────────────────────────┐
│  Renderer（Vue 3 + TypeScript）                      │  ← UI 层
│  Views → Components → Stores（Pinia）→ Composables  │
├─────────────────────────────────────────────────────┤
│  Preload（Context Bridge）                           │  ← IPC 安全桥
│  白名单通道（validChannels）+ 类型安全               │
├─────────────────────────────────────────────────────┤
│  Main（Electron + Node.js）                          │  ← 业务 + 数据层
│  Features → Services → Database（Drizzle ORM）       │
└─────────────────────────────────────────────────────┘
```

### 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Vue 3 + TypeScript | 组合式 API，`<script setup>` 语法 |
| UI 组件库 | Element Plus | 国内生态最成熟的 Vue 3 组件库 |
| 状态管理 | Pinia | Vue 3 官方唯一推荐状态管理方案 |
| 路由 | Vue Router 4 | 标准路由方案 |
| 后端运行时 | Electron（Node.js） | 主进程承载业务逻辑和系统 API |
| 数据库 | SQLite（better-sqlite3） | 本地嵌入式数据库，零配置 |
| ORM | Drizzle ORM | 类型安全、轻量、Schema-first 设计 |
| HTTP 客户端 | axios + axios-retry | 请求 + 自动重试 |
| 日志 | winston + daily-rotate-file | 分级日志 + 按日轮转 |
| 自动更新 | electron-updater | Electron 标准更新方案 |
| 单元测试 | Vitest | Vite 原生测试框架，兼容 Jest API |
| E2E 测试 | Playwright | 跨浏览器端到端测试 |
| 构建 | electron-vite | Electron 专用 Vite 构建方案 |
| 打包 | electron-builder | 多平台打包（Setup / Portable / zip） |
| 包管理 | pnpm | 快速、节省磁盘空间 |

### IPC 通信规范

主进程与渲染进程通过 IPC 通信，遵循以下规范：

- **白名单机制**：所有 IPC 通道必须注册到 `preload/index.ts` 的 `validChannels`
- **Feature 模块化**：每个业务模块独立注册 IPC handler，避免单文件膨胀
- **错误边界**：IPC handler 内部统一 try-catch，通过 `ipc-error-handler` 返回结构化错误
- **类型共享**：共享类型定义放在 `src/shared/`，两端共同引用

### 数据库规范

- **Schema-first**：所有表结构定义在 `src/main/database/schema/`，Drizzle 自动生成迁移
- **批量操作**：使用 `processInBatches()` 分批处理，避免 SQLite 参数溢出
- **事务规则**：事务内必须用同步 for 循环，async 分批函数仅用于无事务场景
- **批量删除**：使用 Drizzle ORM 的 `inArray()` 替代循环单条删除
- **参数管理**：批量操作参数通过 `BatchParams` 类统一管理

### 模块组织

采用 **Feature-based** 模块组织，每个 feature 包含完整的业务逻辑：

```
features/<module>/
├── handlers.ts      # IPC handler 注册
├── service.ts       # 业务逻辑
├── types.ts         # 模块类型定义
└── index.ts         # 公共导出
```

**跨模块调用原则**：feature 之间禁止直接导入，跨模块调用应上移到 IPC handler 层。

### 测试策略

| 层级 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest | 工具函数、Store、Service |
| 集成测试 | Vitest | 数据库操作、IPC handler |
| E2E 测试 | Playwright | 完整用户流程 |

### 项目演进方向

以下是后续迭代可考虑的架构演进（按优先级排序）：

1. **IPC 类型安全** — 引入类 tRPC 的 IPC 通信层，渲染进程调用主进程获得完整类型推导
2. **Monorepo 分包** — 将 shared-types、database、ui 抽为独立 package，减少重复代码
3. **Electron Fuses** — 安全加固，禁用不必要的 Node 集成能力
4. **SQLite WAL 模式** — 启用 Write-Ahead Logging，提升读写并发性能
5. **Electron Forge** — 评估替代 electron-builder 的可行性

## 安装

从以下地址下载最新版本：

- [GitHub Releases](https://github.com/yangshare/LiuliuCloudStorage/releases)（原站）
- [国内镜像](https://github-proxy.yangshare.cn/yangshare/LiuliuCloudStorage/releases/download/v2.0.9/LiuliuCloudStorage-Setup-2.0.9.exe)（推荐）

| 版本 | 说明 |
|------|------|
| `Setup.exe` | 安装版，推荐大多数用户使用 |
| `Portable.exe` | 便携版，免安装，双击即可运行 |
| `.zip` | 压缩包，解压后运行 |

首次启动后会自动打开配置向导，按提示填写服务器地址即可使用。

## 功能

### 某度网盘分享转存

- 支持多种某度网盘链接格式解析
- 自动提取链接中的提取码
- 批量转存到 Alist 存储
- 转存记录管理（查看、删除历史）
- 转存成功后自动跳转到对应目录

### 文件管理

- 文件列表浏览（支持列表/网格视图）
- 面包屑导航，快速跳转目录
- 新建文件夹、重命名、删除
- 批量操作（批量删除）
- 离线模式（网络断开时显示缓存数据）
- 网格密度调节（紧凑/舒适/宽松）

### 文件传输

- 全窗口拖拽上传
- 单文件下载、下载到指定路径
- 传输队列管理（暂停/恢复/清空）
- 实时传输进度和速度显示
- 断点续传支持
- 系统托盘快速上传入口

### 用户与管理

- 用户登录/登出（支持自动登录）
- 每用户独立存储配额
- 管理员控制台
  - 用户管理
  - 存储监控
  - 操作审计日志
  - DAU 统计

### 系统功能

- 开机自启动
- 系统通知（上传/下载完成）
- 自动更新检查与安装
- 系统托盘状态显示
- 缓存管理

## 配置说明

首次启动时自动在用户数据目录创建配置文件：

**Windows:** `C:\Users\<用户名>\AppData\Roaming\liuliu-cloud-storage\config.json`

```json
{
  "alistBaseUrl": "http://your-server:5244",
  "ambApiUrl": "http://your-server:8080",
  "ambTransferToken": "your-token",
  "n8nBaseUrl": "http://your-server:5678"
}
```

| 配置项 | 说明 | 必填 |
|--------|------|------|
| alistBaseUrl | Alist 文件存储服务地址 | 是 |
| ambApiUrl | AMB 分享转存 API 地址 | 是 |
| ambTransferToken | 转存认证令牌 | 否 |
| n8nBaseUrl | N8N 工作流地址 | 否 |

## 开发指南

### 本地运行

```bash
# 安装依赖
pnpm install

# 编译原生模块
npx @electron/rebuild -f -w better-sqlite3

# 启动开发服务器
pnpm dev
```

### 常见问题

**NODE_MODULE_VERSION 错误：**
```bash
npx @electron/rebuild -f -w better-sqlite3
```

## 项目结构

```
src/
├── main/                       # Electron 主进程
│   ├── core/                   # 核心基础设施（API、缓存、加密、HTTP、日志等）
│   ├── database/               # Drizzle ORM schema 和数据库操作
│   ├── features/               # 15 个业务功能模块（详见"模块组织"）
│   ├── ipc/                    # IPC 处理器注册入口
│   └── utils/                  # 主进程工具函数
├── renderer/src/               # Vue 渲染进程
│   ├── core/composables/       # 通用组合式函数
│   ├── features/               # 功能模块（stores + composables）
│   ├── services/               # 前端跨模块服务
│   ├── views/                  # 页面视图
│   ├── components/             # Vue 组件
│   ├── router/                 # 路由配置
│   └── styles/                 # 主题样式
├── preload/                    # 预加载脚本（IPC 白名单）
└── shared/                     # 共享类型、常量和格式化工具
```

## 许可证

MIT
