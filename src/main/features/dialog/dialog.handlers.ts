import { ipcMain } from 'electron'
import { dialogService } from './dialog.service'

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:openFile', async (_event, options?: { directory?: boolean }) => {
    return dialogService.openFile(options)
  })
}
