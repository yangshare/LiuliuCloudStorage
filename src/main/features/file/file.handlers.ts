// src/main/features/file/file.handlers.ts

import { ipcMain } from 'electron'
import { fileService } from './file.service'
import { handleIPC } from '../../core/ipc/error-handler'

export function registerFileHandlers() {
  // 获取文件列表
  ipcMain.handle('file:item:list', async (_event, path: string) => {
    return handleIPC(() => fileService.listFiles(path))
  })

  // 创建目录
  ipcMain.handle('file:directory:create', async (_event, path: string) => {
    return handleIPC(() => fileService.mkdir(path))
  })

  // 删除文件/目录
  ipcMain.handle('file:item:delete', async (_event, dir: string, fileName: string) => {
    return handleIPC(() => fileService.deleteFile(dir, fileName))
  })

  // 批量删除
  ipcMain.handle('file:item:batchDelete', async (_event, dir: string, fileNames: string[]) => {
    return handleIPC(() => fileService.batchDelete(dir, fileNames))
  })

  // 重命名
  ipcMain.handle('file:item:rename', async (_event, path: string, newName: string) => {
    return handleIPC(() => fileService.rename(path, newName))
  })

  // 获取目录下所有文件（递归子目录）
  ipcMain.handle('file:directory:getAllFiles', async (_event, remotePath: string, maxFiles?: number) => {
    return handleIPC(() => fileService.getAllFilesInDirectory(remotePath, maxFiles))
  })
}
