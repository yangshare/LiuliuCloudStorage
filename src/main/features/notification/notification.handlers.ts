import { ipcMain } from 'electron'
import { notificationService } from '../../services/NotificationService'

export function registerNotificationHandlers(): void {
  ipcMain.handle('notification:show', (_, options: { title: string; body: string }) => {
    notificationService.show(options.title, options.body, 'info')
  })
}
