import { ipcMain } from 'electron'
import { dialogService } from './dialog.service'

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:file:open', async (_event, options?: { directory?: boolean }) => {
    return dialogService.openFile(options)
  })
}
