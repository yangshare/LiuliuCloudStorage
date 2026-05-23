import { ipcMain } from 'electron'
import { appService } from './app.service'

export function registerAppHandlers(): void {
  ipcMain.handle('app:launch:set-login-item-settings', (_, settings: { openAtLogin: boolean }) => {
    return appService.setLoginItemSettings(settings.openAtLogin)
  })

  ipcMain.handle('app:launch:get-login-item-settings', () => {
    return appService.getLoginItemSettings()
  })

  ipcMain.handle('app:logs:open-directory', async () => {
    return appService.openLogsDirectory()
  })

  ipcMain.handle('app:version:get', () => {
    return appService.getVersion()
  })
}
