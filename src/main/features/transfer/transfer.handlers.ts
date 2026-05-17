import { ipcMain } from 'electron'
import { transferService } from './transfer.service'

export function registerTransferHandlers() {
  ipcMain.handle('transfer:v2:list', async (_event, userId: number) => {
    return transferService.getTasksByUser(userId)
  })
}
