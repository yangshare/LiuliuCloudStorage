import { ipcMain } from 'electron'
import { updateService } from '../../services/UpdateService'

export function registerUpdateHandlers() {
  ipcMain.handle('update:check', async () => {
    await updateService.checkForUpdates()
  })

  ipcMain.handle('update:install-now', () => {
    updateService.installNow()
  })

  ipcMain.handle('update:install-on-quit', () => {
    updateService.installOnQuit()
  })
}
