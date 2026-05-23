import { app, shell } from 'electron'
import { loggerService } from '../../core/logger/logger.service'
import { handleIPC } from '../../core/ipc/error-handler'

export class AppService {
  setLoginItemSettings(openAtLogin: boolean) {
    return handleIPC(async () => {
      app.setLoginItemSettings({
        openAtLogin,
        openAsHidden: true,
        name: '溜溜网盘'
      })
      return { success: true }
    })
  }

  getLoginItemSettings() {
    return handleIPC(async () => {
      const settings = app.getLoginItemSettings()
      return { success: true, openAtLogin: settings.openAtLogin }
    })
  }

  async openLogsDirectory() {
    return handleIPC(async () => {
      const logsDir = loggerService.getLogsDir()
      await shell.openPath(logsDir)
      return { success: true }
    })
  }

  getVersion() {
    return app.getVersion()
  }
}

export const appService = new AppService()
