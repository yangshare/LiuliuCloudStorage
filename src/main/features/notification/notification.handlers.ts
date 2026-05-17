import { ipcMain, app } from 'electron'
import { notificationService } from '../../services/NotificationService'

export function registerNotificationHandlers(): void {
  ipcMain.handle('notification:show', (_, options: { title: string; body: string }) => {
    notificationService.show(options.title, options.body, 'info')
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })
}
