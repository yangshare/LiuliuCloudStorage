import { ipcMain } from 'electron'
import { trayService } from '../../services/TrayService'

export function registerTrayHandlers(): void {
  ipcMain.handle('tray:update-transfer-status', (_, isTransferring: boolean) => {
    trayService.updateIcon(isTransferring)
  })

  ipcMain.handle(
    'tray:update-transfer-counts',
    (_, uploadCount: number, downloadCount: number) => {
      trayService.updateContextMenu(uploadCount, downloadCount)
    }
  )

  ipcMain.handle('tray:show-window', () => {
    trayService.updateContextMenu()
  })

  ipcMain.handle('tray:hide-window', () => {
    // 托盘服务内部处理
  })
}
