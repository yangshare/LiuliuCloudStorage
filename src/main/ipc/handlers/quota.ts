import { ipcMain } from 'electron'

export function registerQuotaHandlers(): void {
  ipcMain.handle('quota:get', async () => {
    // TODO: 实现获取配额（Story 6.1）
    return { total: 0, used: 0 }
  })

  ipcMain.handle('quota:update', async (_event, userId: number, quota: number) => {
    // TODO: 实现更新配额（Story 6.4，仅管理员）
    console.log('quota:update called', { userId, quota })
    return { success: false, error: 'Not implemented' }
  })
}
