import { ipcMain } from 'electron'
import { updateService } from './update.core.service'

export function registerUpdateHandlers() {
  ipcMain.handle('update:action:check', async () => {
    await updateService.checkForUpdates()
  })

  ipcMain.handle('update:action:install-now', () => {
    updateService.installNow()
  })

  ipcMain.handle('update:action:install-on-quit', () => {
    updateService.installOnQuit()
  })
}
