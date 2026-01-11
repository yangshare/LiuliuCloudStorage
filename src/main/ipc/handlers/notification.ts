import { ipcMain, app } from 'electron'
import { notificationService } from '../../services/NotificationService'

/**
 * 注册通知相关的IPC处理器
 */
export function registerNotificationHandlers(): void {
  // 显示系统通知
  ipcMain.handle('notification:show', (_, options: { title: string; body: string }) => {
    notificationService.show(options.title, options.body, 'info')
  })

  // 获取应用版本
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })
}
