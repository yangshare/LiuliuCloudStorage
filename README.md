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
├── main/           # Electron 主进程
│   ├── database/   # 数据库 schema 和操作
│   ├── ipc/        # IPC 处理器
│   └── services/   # 后端服务
├── renderer/src/   # Vue 渲染进程
│   ├── components/ # Vue 组件
│   ├── views/      # 页面视图
│   └── stores/     # Pinia 状态管理
├── preload/        # 预加载脚本
└── shared/         # 共享类型和常量
```

## 许可证

MIT
