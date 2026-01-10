import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './database'
import { registerAllHandlers } from './ipc'
import { cryptoService } from './services/CryptoService'
import { alistService } from './services/AlistService'
import { orchestrationService } from './services/OrchestrationService'

// Alist 服务器地址，可通过环境变量配置
const ALIST_BASE_URL = process.env.ALIST_BASE_URL || 'http://10.2.3.7:5244'
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://10.2.3.7:5678'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('quit', () => {
  closeDatabase()
})
