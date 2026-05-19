# 溜溜网盘

一个基于 Electron 的桌面端网盘工具，核心功能是**某度网盘分享链接批量转存**后高速下载。

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

## 开发环境

### 技术栈

- **前端:** Vue 3 + TypeScript + Element Plus + Pinia
- **后端:** Electron (Node.js)
- **数据库:** SQLite (Drizzle ORM + better-sqlite3)

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
│   ├── core/                   # 核心基础设施
│   │   ├── api/                # Alist API 封装
│   │   ├── cache/              # 缓存服务
│   │   ├── crypto/             # 加密服务
│   │   ├── http/               # HTTP 客户端
│   │   ├── ipc/                # IPC 错误处理
│   │   ├── logger/             # 日志服务
│   │   ├── preferences/        # 偏好设置
│   │   └── utils/              # 路径验证器
│   ├── database/               # 数据库 schema 和操作
│   ├── ipc/                    # IPC 处理器注册入口
│   ├── features/               # 15 个业务功能模块
│   │   ├── auth/               # 认证与会话
│   │   ├── file/               # 文件操作
│   │   ├── transfer/           # 传输与队列
│   │   ├── shareTransfer/      # 分享转存
│   │   ├── autoSync/           # 自动同步
│   │   ├── quota/              # 配额管理
│   │   ├── activity/           # 活动日志
│   │   ├── downloadConfig/     # 下载配置
│   │   ├── dialog/             # 系统对话框
│   │   ├── tray/               # 系统托盘
│   │   ├── notification/       # 系统通知
│   │   ├── app/                # 应用生命周期
│   │   ├── cache/              # 缓存 IPC
│   │   ├── config/             # 应用配置
│   │   └── update/             # 自动更新
│   └── utils/                  # 简单优先队列
├── renderer/src/               # Vue 渲染进程
│   ├── core/composables/       # 通用组合式函数
│   ├── features/               # 功能模块（stores + composables）
│   │   ├── auth/               # 认证状态
│   │   ├── file/               # 文件浏览状态
│   │   ├── transfer/           # 转存任务状态
│   │   ├── quota/              # 配额管理状态
│   │   ├── autoSync/           # 自动同步状态
│   │   ├── downloadConfig/     # 下载配置状态
│   │   └── update/             # 应用更新状态
│   ├── services/               # 前端跨模块服务
│   ├── views/                  # 页面视图
│   ├── components/             # Vue 组件
│   ├── router/                 # 路由配置
│   ├── utils/                  # 工具函数
│   ├── types/                  # 类型声明
│   ├── plugins/                # 插件配置
│   └── styles/                 # 主题样式
├── preload/                    # 预加载脚本（IPC 白名单）
└── shared/                     # 共享类型、常量和格式化工具
```

## 许可证

MIT
