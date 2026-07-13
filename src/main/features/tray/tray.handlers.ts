import { ipcMain } from 'electron'
import { trayService } from './tray.core.service'

export function registerTrayHandlers(): void {
  ipcMain.handle('tray:status:update-transfer', (_, isTransferring: boolean) => {
    trayService.updateIcon(isTransferring)
  })

  ipcMain.handle(
    'tray:status:update-counts',
    (_, uploadCount: number, downloadCount: number) => {
      trayService.updateContextMenu(uploadCount, downloadCount)
    }
  )

  ipcMain.handle('tray:window:show', () => {
    trayService.updateContextMenu()
  })

  ipcMain.handle('tray:window:hide', () => {
    // 托盘服务内部处理
  })
}
