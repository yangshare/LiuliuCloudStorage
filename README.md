# LiuliuCloudStorage
溜溜网盘，一个不限速的小众网盘工具

## 开发环境配置

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
