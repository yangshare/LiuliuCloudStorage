import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

interface FileInfo {
  name: string
  path: string
  size: number
  isDirectory: boolean
}

function getFilesRecursively(dirPath: string): FileInfo[] {
  const results: FileInfo[] = []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      results.push(...getFilesRecursively(fullPath))
    } else {
      const stats = fs.statSync(fullPath)
      results.push({
        name: entry.name,
        path: fullPath,
        size: stats.size,
        isDirectory: false
      })
    }
  }
  return results
}

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:openFile', async (_event, options?: { directory?: boolean }) => {
    const win = BrowserWindow.getFocusedWindow()
    const properties: ('openFile' | 'multiSelections' | 'openDirectory')[] = ['multiSelections']

    if (options?.directory) {
      properties.push('openDirectory')
    } else {
      properties.push('openFile')
    }

    const result = await dialog.showOpenDialog(win!, { properties })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, files: [] }
    }

    const files: FileInfo[] = []
    for (const filePath of result.filePaths) {
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) {
        files.push(...getFilesRecursively(filePath))
      } else {
        files.push({
          name: path.basename(filePath),
          path: filePath,
          size: stats.size,
          isDirectory: false
        })
      }
    }

    return { canceled: false, files }
  })
}
