/**
 * Electron 主进程入口文件
 */

import { app, BrowserWindow } from 'electron';
import { dbManager } from './db/index';
import { registerAuthHandlers } from './ipc/auth';
import { registerFilesystemHandlers } from './ipc/filesystem';
import { registerUploadHandlers } from './ipc-handlers/upload';
import { registerDownloadHandlers } from './ipc-handlers/download';
import { sessionManager } from './managers/SessionManager';
import { SecurityAuditDAO } from './db/securityAudit.dao';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

/**
 * 创建主窗口
 */
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false // 等待加载完成后显示
  });

  // 开发环境加载 Vite 开发服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // 检查登录状态
    checkAuthState();
  });

  // 窗口关闭时
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 检查认证状态
 */
function checkAuthState(): void {
  // 尝试恢复会话
  const session = sessionManager.restoreSession();

  if (session) {
    console.log('Session restored for user:', session.username);
    // 已登录，可以在这里添加逻辑，例如通知渲染进程
  } else {
    console.log('No active session found');
    // 未登录，渲染进程会自动跳转到登录页
  }
}

/**
 * App 就绪时
 */
app.whenReady().then(() => {
  // 初始化数据库
  dbManager.initialize();

  // 初始化安全审计日志表
  SecurityAuditDAO.initializeTable();

  // 注册 IPC 处理器
  registerAuthHandlers();
  registerFilesystemHandlers();
  registerUploadHandlers();
  registerDownloadHandlers();

  // 创建主窗口
  createMainWindow();

  // macOS 特有：点击 Dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

/**
 * 所有窗口关闭时
 */
app.on('window-all-closed', () => {
  // macOS 特有：不退出应用
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * App 退出前
 */
app.on('before-quit', () => {
  // 关闭数据库连接
  dbManager.close();
});

/**
 * 进程间通信
 */
// 可以在这里添加其他 IPC 处理器
