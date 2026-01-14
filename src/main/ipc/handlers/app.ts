import { ipcMain, app } from 'electron'

/**
 * 注册应用设置相关的IPC处理器
 */
export function registerAppHandlers(): void {
  // 设置开机自启动
  ipcMain.handle('app:set-login-item-settings', (_, settings: { openAtLogin: boolean }) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: settings.openAtLogin,
        openAsHidden: true,  // 隐藏启动
        name: '溜溜网盘'
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取开机自启动状态
  ipcMain.handle('app:get-login-item-settings', () => {
    try {
      const settings = app.getLoginItemSettings()
      return {
        success: true,
        openAtLogin: settings.openAtLogin
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
