import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

// 修复缓存权限问题：必须在 app.ready 之前设置
const userDataPath = join(app.getPath('appData'), 'liuliu-cloud-storage')
app.setPath('userData', userDataPath)
app.setPath('cache', join(userDataPath, 'Cache'))
app.setPath('crashDumps', join(userDataPath, 'Crashpad'))

// 禁用 GPU 缓存以避免权限问题
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

import { initDatabase, closeDatabase } from './database'
import { registerAllHandlers } from './ipc'
import { cryptoService } from './services/CryptoService'
import { alistService } from './services/AlistService'
import { orchestrationService } from './services/OrchestrationService'
import { preferencesService } from './services/PreferencesService'
import { trayService } from './services/TrayService'
import { notificationService } from './services/NotificationService'
import { updateService } from './services/UpdateService'
import { loggerService } from './services/LoggerService'
import { cacheService } from './services/CacheService'
import { loadConfig, getConfigFilePath } from './config'

// 加载应用配置（优先级: 环境变量 > config.json）
const appConfig = loadConfig()

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function getWindowIcon(): string | undefined {
  const possiblePaths = [
    join(process.cwd(), 'build', 'icon.ico'),
    join(__dirname, '../../build/icon.ico'),
    join(process.resourcesPath, 'icon.ico'),
  ]

  loggerService.info('Main', '尝试查找图标文件...')
  loggerService.info('Main', `process.cwd(): ${process.cwd()}`)
  loggerService.info('Main', `__dirname: ${__dirname}`)
  loggerService.info('Main', `process.resourcesPath: ${process.resourcesPath}`)

  for (const iconPath of possiblePaths) {
    const exists = existsSync(iconPath)
    loggerService.info('Main', `检查路径: ${iconPath}, 存在: ${exists}`)
    if (exists) {
      loggerService.info('Main', `✓ 使用图标: ${iconPath}`)
      return iconPath
    }
  }

  // 使用 fallback 路径
  const fallbackPath = join(__dirname, '../../build/icon.ico')
  loggerService.warn('Main', `⚠ 未找到图标文件，使用 fallback: ${fallbackPath}`)
  return fallbackPath
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getWindowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 设置托盘服务的主窗口引用
  trayService.setMainWindow(mainWindow)

  // 设置通知服务的主窗口引用
  notificationService.setMainWindow(mainWindow)

  // 监听窗口关闭事件，最小化到托盘而不是直接关闭
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // 移除默认菜单栏
  Menu.setApplicationMenu(null)

  loggerService.info('Main', '应用程序启动中...')

  // 数据库初始化 - 关键服务，失败则退出
  try {
    initDatabase()
    loggerService.info('Main', '数据库初始化完成')
  } catch (error) {
    loggerService.error('Main', '数据库初始化失败', error as Error)
    app.exit(1)
    return
  }

  // 加密服务初始化 - 关键服务，失败则退出
  try {
    await cryptoService.initialize()
    loggerService.info('Main', '加密服务初始化完成')
  } catch (error) {
    loggerService.error('Main', '加密服务初始化失败', error as Error)
    app.exit(1)
    return
  }

  // Alist 服务初始化
  alistService.initialize(appConfig.alistBaseUrl)
  loggerService.info('Main', `Alist服务初始化完成: ${appConfig.alistBaseUrl}`)

  // Orchestration 服务初始化
  orchestrationService.initialize(appConfig.n8nBaseUrl)
  loggerService.info('Main', `Orchestration服务初始化完成: ${appConfig.n8nBaseUrl}`)

  registerAllHandlers()
  loggerService.info('Main', 'IPC处理器注册完成')

  createWindow()
  loggerService.info('Main', '主窗口创建完成')

  // 初始化更新服务
  if (mainWindow) {
    updateService.init(mainWindow)
    loggerService.info('Main', '更新服务初始化完成')
  }

  // 初始化系统托盘
  trayService.initialize()
  loggerService.info('Main', '系统托盘初始化完成')

  // 初始化缓存服务
  cacheService.initialize({
    maxSize: 500 * 1024 * 1024 // 500MB
  })
  loggerService.info('Main', '缓存服务初始化完成')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  loggerService.info('Main', '所有窗口已关闭，应用保持后台运行')
  // Windows/Linux: 不退出应用，保持在托盘运行
  // macOS: 即使所有窗口关闭也保持应用运行
  // 不做任何操作，让应用在后台运行
})

app.on('before-quit', () => {
  loggerService.info('Main', '应用程序准备退出...')
  // 设置退出标志，允许窗口真正关闭
  isQuitting = true
  // 应用关闭时自动安装更新
  updateService.installOnQuit()
})

app.on('quit', () => {
  loggerService.info('Main', '应用程序已退出')
  closeDatabase()
  preferencesService.close()
  trayService.destroy()
})
