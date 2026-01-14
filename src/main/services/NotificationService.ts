import { Notification, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * 通知服务类
 * 负责显示系统通知
 */
export class NotificationService {
  private static instance: NotificationService | null = null
  private mainWindow: BrowserWindow | null = null
  private notificationQueue: Array<{ title: string; body: string; type: string }> = []
  private isProcessing = false
  private debounceTimer: NodeJS.Timeout | null = null
  private batchCount = 0

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * 显示通知（带批量合并）
   */
  show(title: string, body: string, type: 'upload' | 'download' | 'error' | 'info' = 'info'): void {
    // 添加到队列
    this.notificationQueue.push({ title, body, type })
    this.batchCount++

    // 防抖处理：500ms内的通知会被合并
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.processNotifications()
    }, 500)
  }

  /**
   * 处理通知队列
   */
  private processNotifications(): void {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return
    }

    this.isProcessing = true

    const notifications = [...this.notificationQueue]
    this.notificationQueue = []
    const count = this.batchCount
    this.batchCount = 0

    try {
      if (notifications.length === 1) {
        // 单个通知直接显示
        this.showSingleNotification(notifications[0])
      } else {
        // 多个通知合并显示
        this.showBatchNotification(notifications, count)
      }
    } catch (error) {
      console.error('[NotificationService] 显示通知失败:', error)
    }

    this.isProcessing = false
  }

  /**
   * 显示单个通知
   */
  private showSingleNotification(notification: { title: string; body: string; type: string }): void {
    if (!Notification.isSupported()) {
      console.warn('[NotificationService] 系统不支持通知')
      return
    }

    const n = new Notification({
      title: notification.title,
      body: notification.body,
      icon: this.getIconPath(),
      silent: false
    })

    // 点击通知时聚焦主窗口
    n.on('click', () => {
      this.focusWindow()
    })

    n.show()
  }

  /**
   * 显示批量通知
   */
  private showBatchNotification(notifications: Array<{ title: string; body: string; type: string }>, count: number): void {
    if (!Notification.isSupported()) {
      console.warn('[NotificationService] 系统不支持通知')
      return
    }

    // 按类型分组统计
    const uploadCount = notifications.filter(n => n.type === 'upload').length
    const downloadCount = notifications.filter(n => n.type === 'download').length
    const errorCount = notifications.filter(n => n.type === 'error').length

    let title = '溜溜网盘'
    let body = ''

    if (errorCount > 0) {
      title = '传输失败'
      body = `${errorCount} 个文件传输失败`
    } else if (uploadCount > 0 && downloadCount > 0) {
      body = `${uploadCount} 个文件上传完成，${downloadCount} 个文件下载完成`
    } else if (uploadCount > 0) {
      body = `${uploadCount} 个文件上传完成`
    } else if (downloadCount > 0) {
      body = `${downloadCount} 个文件下载完成`
    } else {
      body = `${count} 个操作完成`
    }

    const n = new Notification({
      title,
      body,
      icon: this.getIconPath(),
      silent: false
    })

    n.on('click', () => {
      this.focusWindow()
    })

    n.show()
  }

  /**
   * 获取图标路径
   * Story 8.4 CRITICAL FIX: 修复通知图标路径为空的问题
   */
  private getIconPath(): string {
    // 尝试多个可能的路径
    const possiblePaths = [
      // 开发环境路径
      join(process.resourcesPath, 'assets', 'icons', 'app-icon.png'),
      join(__dirname, '../../assets/icons/app-icon.png'),
      join(process.cwd(), 'assets', 'icons/app-icon.png'),
      // 打包后路径
      join(process.resourcesPath, 'app-icon.png'),
      // Windows exe 图标
      join(process.execPath, '..', 'resources', 'app-icon.png'),
    ]

    for (const iconPath of possiblePaths) {
      if (existsSync(iconPath)) {
        return iconPath
      }
    }

    // 如果找不到图标文件，返回空字符串使用系统默认图标
    console.warn('[NotificationService] 未找到应用图标文件')
    return ''
  }

  /**
   * 聚焦主窗口
   * Story 8.4 MEDIUM FIX: 添加导航到文件目录的参数支持
   */
  private focusWindow(navigateToPath?: string): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      this.mainWindow.show()
      this.mainWindow.focus()

      // 如果提供了导航路径，发送消息到渲染进程进行导航
      if (navigateToPath) {
        this.mainWindow.webContents.send('navigate-to-path', { path: navigateToPath })
      }
    }
  }

  /**
   * 清空通知队列
   */
  clearQueue(): void {
    this.notificationQueue = []
    this.batchCount = 0
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }
}

// 导出单例
export const notificationService = NotificationService.getInstance()
