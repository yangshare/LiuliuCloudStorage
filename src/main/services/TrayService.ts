import { app, BrowserWindow, Menu, Tray, nativeImage, nativeTheme } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'

/**
 * 托盘服务类
 * 负责系统托盘图标的创建、菜单管理和窗口控制
 */
export class TrayService {
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null
  private isTransferring = false

  constructor() {
    this.setupWindowMinimizeHandler()
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * 初始化系统托盘
   */
  initialize(): void {
    // 创建托盘图标
    const icon = this.getTrayIcon()
    this.tray = new Tray(icon)

    // 设置工具提示
    this.tray.setToolTip('溜溜网盘')

    // 创建托盘菜单
    this.updateContextMenu()

    // 监听托盘图标点击事件
    this.tray.on('click', () => {
      this.toggleWindow()
    })
  }

  /**
   * 获取托盘图标
   * 根据平台和传输状态返回相应图标
   */
  private getTrayIcon(): nativeImage {
    const iconName = this.isTransferring ? 'tray-active.png' : 'tray-idle.png'

    try {
      // 尝试从assets目录加载图标
      const iconPath = join(__dirname, '../../assets/icons', iconName)
      return nativeImage.createFromPath(iconPath)
    } catch (error) {
      // 如果图标文件不存在，使用占位图标
      return this.createPlaceholderIcon()
    }
  }

  /**
   * 创建占位图标
   * 当图标文件不存在时使用
   */
  private createPlaceholderIcon(): nativeImage {
    const size = 16
    const buffer = Buffer.alloc(size * size * 4, 0)

    // 创建简单的蓝色圆形图标
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - size / 2
        const dy = y - size / 2
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= size / 2) {
          const offset = (y * size + x) * 4
          buffer[offset] = this.isTransferring ? 255 : 66 // R
          buffer[offset + 1] = this.isTransferring ? 165 : 133 // G
          buffer[offset + 2] = this.isTransferring ? 0 : 244 // B
          buffer[offset + 3] = 255 // A
        }
      }
    }

    return nativeImage.createFromBuffer(buffer, { width: size, height: size })
  }

  /**
   * 更新托盘图标
   * 根据传输状态切换图标
   */
  updateIcon(isTransferring: boolean): void {
    this.isTransferring = isTransferring
    if (this.tray) {
      const icon = this.getTrayIcon()
      this.tray.setImage(icon)

      // 更新工具提示
      const tooltip = this.getTooltip()
      this.tray.setToolTip(tooltip)
    }
  }

  /**
   * 获取工具提示文本
   */
  private getTooltip(): string {
    if (this.isTransferring) {
      return '溜溜网盘 - 正在传输...'
    }
    return '溜溜网盘'
  }

  /**
   * 创建并更新上下文菜单
   */
  updateContextMenu(uploadCount = 0, downloadCount = 0): void {
    if (!this.tray) return

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => this.showWindow()
      },
      {
        label: '隐藏窗口',
        click: () => this.hideWindow()
      },
      { type: 'separator' },
      {
        label: '快速访问',
        submenu: [
          {
            label: '上传文件',
            click: () => this.handleQuickUpload()
          },
          {
            label: '下载文件',
            enabled: false, // 未来功能
            click: () => this.handleQuickDownload()
          }
        ]
      },
      { type: 'separator' },
      {
        label: `传输中: ${uploadCount} 上传, ${downloadCount} 下载`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => this.quitApp()
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  /**
   * 切换窗口显示/隐藏状态
   */
  private toggleWindow(): void {
    if (!this.mainWindow) return

    if (this.mainWindow.isVisible()) {
      this.hideWindow()
    } else {
      this.showWindow()
    }
  }

  /**
   * 显示主窗口
   */
  private showWindow(): void {
    if (!this.mainWindow) return

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore()
    }

    this.mainWindow.show()
    this.mainWindow.focus()
  }

  /**
   * 隐藏主窗口
   */
  private hideWindow(): void {
    if (!this.mainWindow) return
    this.mainWindow.hide()
  }

  /**
   * 快速上传处理
   */
  private handleQuickUpload(): void {
    // 通过IPC发送消息到渲染进程
    if (this.mainWindow) {
      this.mainWindow.webContents.send('tray-quick-upload')
    }
  }

  /**
   * 快速下载处理
   */
  private handleQuickDownload(): void {
    // 未来功能实现
    console.log('快速下载功能待实现')
  }

  /**
   * 退出应用
   */
  private quitApp(): void {
    app.quit()
  }

  /**
   * 设置窗口最小化处理器
   * 当用户点击最小化按钮时，隐藏到托盘
   */
  private setupWindowMinimizeHandler(): void {
    app.on('browser-window-blur', () => {
      // 窗口失焦时不做处理
    })

    app.on('browser-window-focus', () => {
      // 窗口聚焦时不做处理
    })
  }

  /**
   * 销毁托盘
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

// 导出单例实例
export const trayService = new TrayService()
