# LiuliuCloudStorage

溜溜网盘，一个不限速的小众网盘工具

## 功能特性

- 🚀 高速上传下载，不限速
- 💾 自动缓存管理，防止占用过多磁盘空间
- 🔒 数据加密存储
- 📁 文件批量转存
- 🔄 自动更新支持

## 配置说明

应用支持通过配置文件或环境变量设置服务地址。

### 配置优先级

```
环境变量 > config.json > 默认值
```

### 安装版本配置

首次启动时，应用会自动在用户数据目录创建配置文件：

**Windows 配置文件位置：**
```
C:\Users\你的用户名\AppData\Roaming\liuliu-cloud-storage\config.json
```

**配置文件格式：**
```json
{
  "alistBaseUrl": "http://10.2.3.7:5244",
  "n8nBaseUrl": "http://10.2.3.7:5678"
}
```

**修改配置：**
1. 关闭应用
2. 编辑 `config.json` 文件
3. 重新启动应用

### 环境变量配置（可选）

如果需要使用环境变量覆盖配置文件：

**Windows CMD:**
```cmd
set ALIST_BASE_URL=http://your-server:5244
set N8N_BASE_URL=http://your-n8n:5678
```

**Windows PowerShell:**
```powershell
$env:ALIST_BASE_URL="http://your-server:5244"
$env:N8N_BASE_URL="http://your-n8n:5678"
```

**Linux/macOS:**
```bash
export ALIST_BASE_URL=http://your-server:5244
export N8N_BASE_URL=http://your-n8n:5678
```

### 开发环境配置

### 原生模块 (better-sqlite3) 配置

本项目使用 `better-sqlite3` 作为数据库，需要为 Electron 编译原生模块。

**首次安装或遇到 NODE_MODULE_VERSION 错误时：**

```bash
# 1. 安装依赖
pnpm install

# 2. 为 Electron 重新编译原生模块
npx @electron/rebuild -f -w better-sqlite3

# 3. 启动开发服务器
pnpm dev
```

**常见问题：**

- `NODE_MODULE_VERSION xxx` 错误：运行 `npx @electron/rebuild -f -w better-sqlite3`
- pnpm 提示 build scripts 被忽略：`package.json` 已配置 `pnpm.onlyBuiltDependencies`

**关键配置说明：**

1. `package.json`:
   - `pnpm.onlyBuiltDependencies: ["better-sqlite3"]` - 允许 pnpm 执行构建脚本
   - `postinstall: "electron-rebuild -f -w better-sqlite3"` - 安装后自动重建

2. `electron.vite.config.ts`:
   - `external: ['better-sqlite3']` - 防止 Vite 打包原生模块
