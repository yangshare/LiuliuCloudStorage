import { ipcMain } from 'electron'
import { notificationService } from './notification.core.service'

export function registerNotificationHandlers(): void {
  ipcMain.handle('notification:app:show', (_, options: { title: string; body: string }) => {
    notificationService.show(options.title, options.body, 'info')
  })
}
