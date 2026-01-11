import { ipcMain, BrowserWindow } from 'electron'
import { trayService } from '../../services/TrayService'

/**
 * 注册托盘相关的IPC处理器
 */
export function registerTrayHandlers(): void {
  // 更新托盘传输状态
  ipcMain.handle('tray:update-transfer-status', (_, isTransferring: boolean) => {
    trayService.updateIcon(isTransferring)
  })

  // 更新托盘菜单中的传输任务数量
  ipcMain.handle(
    'tray:update-transfer-counts',
    (_, uploadCount: number, downloadCount: number) => {
      trayService.updateContextMenu(uploadCount, downloadCount)
    }
  )

  // 显示主窗口
  ipcMain.handle('tray:show-window', () => {
    trayService.updateContextMenu()
  })

  // 隐藏主窗口
  ipcMain.handle('tray:hide-window', () => {
    // 托盘服务内部处理
  })
}
