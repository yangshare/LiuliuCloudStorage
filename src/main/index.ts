import { app, BrowserWindow } from 'electron'
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

// Alist 服务器地址，可通过环境变量配置
const ALIST_BASE_URL = process.env.ALIST_BASE_URL || 'http://10.2.3.7:5244'
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://10.2.3.7:5678'

let mainWindow: BrowserWindow | null = null

function getWindowIcon(): string {
  const possiblePaths = [
    join(process.cwd(), 'build', 'icon.ico'),
    join(__dirname, '../../build/icon.ico'),
    join(process.resourcesPath, 'icon.ico'),
  ]

  console.log('[getWindowIcon] 尝试查找图标文件...')
  console.log('[getWindowIcon] process.cwd():', process.cwd())
  console.log('[getWindowIcon] __dirname:', __dirname)
  console.log('[getWindowIcon] process.resourcesPath:', process.resourcesPath)

  for (const iconPath of possiblePaths) {
    console.log('[getWindowIcon] 检查路径:', iconPath, '存在:', existsSync(iconPath))
    if (existsSync(iconPath)) {
      console.log('[getWindowIcon] ✓ 使用图标:', iconPath)
      return iconPath
    }
  }

  const fallback = join(__dirname, '../../build/icon.ico')
  console.log('[getWindowIcon] ⚠ 未找到图标，使用回退路径:', fallback)
  return fallback
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
    if (!app.isQuitting) {
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
  initDatabase()
  await cryptoService.initialize()
  alistService.initialize(ALIST_BASE_URL)
  orchestrationService.initialize(N8N_BASE_URL)
  registerAllHandlers()
  createWindow()

  // 初始化更新服务
  if (mainWindow) {
    updateService.init(mainWindow)
  }

  // 初始化系统托盘
  trayService.initialize()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Windows/Linux: 不退出应用，保持在托盘运行
  // macOS: 即使所有窗口关闭也保持应用运行
  // 不做任何操作，让应用在后台运行
})

app.on('before-quit', () => {
  // 设置退出标志，允许窗口真正关闭
  app.isQuitting = true
  // 应用关闭时自动安装更新
  updateService.installOnQuit()
})

app.on('quit', () => {
  closeDatabase()
  preferencesService.close()
  trayService.destroy()
})
