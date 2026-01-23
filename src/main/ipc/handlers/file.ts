import { ipcMain } from 'electron'
import { alistService, FileItem } from '../../services/AlistService'
import { AppError } from '../../services/httpClient'
import { getDatabase } from '../../database'
import { activityService, ActionType } from '../../services/ActivityService'
import { loggerService } from '../../services/LoggerService'

export interface FileListResult {
  success: boolean
  data?: {
    content: FileItem[]
    total: number
    fromCache?: boolean
    cachedAt?: string
  }
  error?: string
}

export interface MkdirResult {
  success: boolean
  error?: string
}

const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export function registerFileHandlers(): void {
  ipcMain.handle('file:list', async (_event, path: string): Promise<FileListResult> => {
    try {
      loggerService.info('FileHandler', `[list] Fetching files for path: ${path}`)
      const result = await alistService.listFiles(path || '/')
      loggerService.info('FileHandler', `[list] Success: ${JSON.stringify(result)}`)

      // 缓存结果
      try {
        const db = getDatabase()
        const userId = alistService.getCurrentUserId()
        if (userId) {
          db.prepare('DELETE FROM file_cache WHERE user_id = ? AND path = ?').run(userId, path)
          db.prepare('INSERT INTO file_cache (user_id, path, content, cached_at) VALUES (?, ?, ?, ?)').run(
            userId, path, JSON.stringify(result), Date.now()
          )
        }
      } catch (cacheErr) {
        loggerService.warn('FileHandler', `[list] Cache save failed: ${cacheErr}`)
      }

      return {
        success: true,
        data: {
          content: result.content || [],
          total: result.total
        }
      }
    } catch (error) {
      const appError = error as AppError
      loggerService.error('FileHandler', `[list] Error: ${JSON.stringify(appError)}`)

      // 检测 401 错误（token 失效），标记需要重新登录
      if (appError.code === 'ALIST_401') {
        return {
          success: false,
          error: appError.message || 'Token 已失效，请重新登录',
          code: 'AUTH_REQUIRED'
        }
      }

      // 尝试从缓存读取
      try {
        const db = getDatabase()
        const userId = alistService.getCurrentUserId()
        if (userId) {
          const cached = db.prepare('SELECT content, cached_at FROM file_cache WHERE user_id = ? AND path = ?').get(userId, path) as { content: string; cached_at: number } | undefined
          if (cached && (Date.now() - cached.cached_at) < CACHE_TTL) {
            const data = JSON.parse(cached.content)
            loggerService.info('FileHandler', '[list] Returning cached data')
            return {
              success: true,
              data: {
                content: data.content || [],
                total: data.total,
                fromCache: true,
                cachedAt: new Date(cached.cached_at).toISOString()
              }
            }
          }
        }
      } catch (cacheErr) {
        loggerService.warn('FileHandler', `[list] Cache read failed: ${cacheErr}`)
      }

      return {
        success: false,
        error: appError.message || '获取文件列表失败'
      }
    }
  })

  ipcMain.handle('file:mkdir', async (_event, path: string): Promise<MkdirResult> => {
    try {
      await alistService.createFolder(path)

      // Story 9.2: 记录文件夹创建日志
      const userId = alistService.getCurrentUserId()
      if (userId) {
        activityService.logActivity({
          userId,
          actionType: ActionType.FOLDER_CREATE,
          fileCount: 1,
          details: { path }
        }).catch(err => {
          loggerService.warn('FileHandler', `[mkdir] 日志记录失败: ${err}`)
        })
      }

      return { success: true }
    } catch (error) {
      const appError = error as AppError
      return {
        success: false,
        error: appError.message || '创建文件夹失败'
      }
    }
  })

  ipcMain.handle('file:delete', async (_event, dir: string, fileName: string): Promise<MkdirResult> => {
    try {
      await alistService.removeFile(dir, [fileName])

      // 记录删除操作日志
      const userId = alistService.getCurrentUserId()
      if (userId) {
        activityService.logActivity({
          userId,
          actionType: ActionType.DELETE,
          fileCount: 1,
          details: { dir, fileName }
        }).catch(err => {
          loggerService.warn('FileHandler', `[delete] 日志记录失败: ${err}`)
        })
      }

      return { success: true, shouldRefreshQuota: true }
    } catch (error) {
      const appError = error as AppError
      return {
        success: false,
        error: appError.message || '删除文件失败'
      }
    }
  })

  ipcMain.handle('file:batchDelete', async (_event, dir: string, fileNames: string[]): Promise<MkdirResult> => {
    try {
      await alistService.removeFile(dir, fileNames)

      // 记录批量删除操作日志
      const userId = alistService.getCurrentUserId()
      if (userId) {
        activityService.logActivity({
          userId,
          actionType: ActionType.DELETE,
          fileCount: fileNames.length,
          details: { dir, fileNames }
        }).catch(err => {
          loggerService.warn('FileHandler', `[batchDelete] 日志记录失败: ${err}`)
        })
      }

      return { success: true }
    } catch (error) {
      const appError = error as AppError
      return {
        success: false,
        error: appError.message || '批量删除文件失败'
      }
    }
  })

  ipcMain.handle('file:rename', async (_event, path: string, newName: string): Promise<MkdirResult> => {
    try {
      await alistService.renameFile(path, newName)

      // 记录重命名操作日志
      const userId = alistService.getCurrentUserId()
      if (userId) {
        activityService.logActivity({
          userId,
          actionType: ActionType.RENAME,
          fileCount: 1,
          details: { path, newName }
        }).catch(err => {
          loggerService.warn('FileHandler', `[rename] 日志记录失败: ${err}`)
        })
      }

      return { success: true }
    } catch (error) {
      const appError = error as AppError
      return {
        success: false,
        error: appError.message || '重命名失败'
      }
    }
  })

  // 获取目录下所有文件（递归子目录）
  ipcMain.handle('file:getAllFilesInDirectory', async (_event, remotePath: string): Promise<{ success: boolean; data?: string[]; error?: string }> => {
    try {
      loggerService.info('FileHandler', `[getAllFilesInDirectory] Fetching all files in: ${remotePath}`)
      const filePaths = await alistService.getAllFilesInDirectory(remotePath || '/')
      loggerService.info('FileHandler', `[getAllFilesInDirectory] Success: found ${filePaths.length} files`)

      return {
        success: true,
        data: filePaths
      }
    } catch (error) {
      const appError = error as AppError
      loggerService.error('FileHandler', `[getAllFilesInDirectory] Error: ${JSON.stringify(appError)}`)

      if (appError.code === 'ALIST_401') {
        return {
          success: false,
          error: appError.message || 'Token 已失效，请重新登录'
        }
      }

      return {
        success: false,
        error: appError.message || '获取目录文件失败'
      }
    }
  })
}
