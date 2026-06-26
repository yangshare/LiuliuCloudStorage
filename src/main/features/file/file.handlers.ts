// src/main/features/file/file.handlers.ts

import { ipcMain } from 'electron'
import { fileService } from './file.service'
import { handleIPC } from '../../core/ipc/error-handler'

// 进行中的目录扫描会话：sessionId -> AbortController，用于支持前端取消
const scanControllers = new Map<string, AbortController>()

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
  // sessionId 用于关联进度推送与取消；并发遍历过程中通过 _event.sender.send 定向推送进度
  ipcMain.handle('file:directory:getAllFiles', async (_event, remotePath: string, maxFiles?: number, sessionId?: string) => {
    const controller = new AbortController()
    if (sessionId) scanControllers.set(sessionId, controller)

    let lastSentCount = 0
    let lastSentAt = 0
    const sendProgress = (count: number): void => {
      if (!sessionId) return
      const now = Date.now()
      // 节流：累计新增 >= 50 个，或距上次推送 >= 200ms
      if (count - lastSentCount >= 50 || now - lastSentAt >= 200) {
        lastSentCount = count
        lastSentAt = now
        _event.sender.send('file:directory:getAllFilesProgress', { sessionId, count })
      }
    }

    try {
      return await handleIPC(() => fileService.getAllFilesInDirectory(remotePath, maxFiles, {
        signal: controller.signal,
        onProgress: sendProgress
      }))
    } finally {
      if (sessionId) scanControllers.delete(sessionId)
    }
  })

  // 取消进行中的目录扫描
  ipcMain.handle('file:directory:cancelGetAllFiles', async (_event, sessionId: string) => {
    const controller = scanControllers.get(sessionId)
    if (controller) {
      controller.abort()
    }
    return { success: true }
  })
}
