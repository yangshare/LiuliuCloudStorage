// src/main/features/file/file.service.ts

import { alistService } from '../../services/AlistService'
import { AppError } from '../../services/httpClient'
import { getDatabase } from '../../database'
import { activityService, ActionType } from '../../services/ActivityService'
import { loggerService } from '../../services/LoggerService'
import { IPCError, IPCErrorCode } from '../../core/ipc/error-handler'
import type { FileListResult } from '../../../shared/types/file'

const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export class FileService {
  /**
   * 获取文件列表（支持缓存）
   */
  async listFiles(path: string): Promise<FileListResult> {
    const targetPath = path || '/'
    loggerService.info('FileService', `[listFiles] Fetching files for path: ${targetPath}`)

    try {
      const result = await alistService.listFiles(targetPath)
      loggerService.info('FileService', `[listFiles] Success: ${result.content?.length || 0} items`)

      // 缓存结果
      this.saveCache(targetPath, result).catch((err) => {
        loggerService.warn('FileService', `[listFiles] Cache save failed: ${err}`)
      })

      return {
        content: result.content || [],
        total: result.total
      }
    } catch (error) {
      const appError = error as AppError
      loggerService.error('FileService', `[listFiles] Error: ${JSON.stringify(appError)}`)

      // 检测 401 错误
      if (appError.code === 'ALIST_401') {
        throw new IPCError(
          appError.message || 'Token 已失效，请重新登录',
          IPCErrorCode.UNAUTHORIZED
        )
      }

      // 尝试从缓存读取
      const cached = await this.readCache(targetPath)
      if (cached) {
        return cached
      }

      throw new IPCError(appError.message || '获取文件列表失败', IPCErrorCode.NETWORK)
    }
  }

  /**
   * 创建目录
   */
  async mkdir(path: string): Promise<void> {
    try {
      await alistService.createFolder(path)

      // 记录文件夹创建日志
      const userId = alistService.getCurrentUserId()
      if (userId) {
        activityService
          .logActivity({
            userId,
            actionType: ActionType.FOLDER_CREATE,
            fileCount: 1,
            details: { path }
          })
          .catch((err) => {
            loggerService.warn('FileService', `[mkdir] 日志记录失败: ${err}`)
          })
      }
    } catch (error) {
      const appError = error as AppError
      loggerService.error('FileService', `[mkdir] Error: ${appError.message}`)
      throw new IPCError(appError.message || '创建文件夹失败', IPCErrorCode.NETWORK)
    }
  }

  /**
   * 删除文件/目录
   */
  async deleteFile(dir: string, fileName: string): Promise<void> {
    try {
      await alistService.removeFile(dir, [fileName])

      // 记录删除操作日志
      const userId = alistService.getCurrentUserId()
      if (userId) {
        activityService
          .logActivity({
            userId,
            actionType: ActionType.DELETE,
            fileCount: 1,
            details: { dir, fileName }
          })
          .catch((err) => {
            loggerService.warn('FileService', `[deleteFile] 日志记录失败: ${err}`)
          })
      }
    } catch (error) {
      const appError = error as AppError
      loggerService.error('FileService', `[deleteFile] Error: ${appError.message}`)
      throw new IPCError(appError.message || '删除文件失败', IPCErrorCode.NETWORK)
    }
  }

  /**
   * 批量删除
   */
  async batchDelete(dir: string, fileNames: string[]): Promise<void> {
    try {
      await alistService.removeFile(dir, fileNames)

      // 记录批量删除操作日志
      const userId = alistService.getCurrentUserId()
      if (userId) {
        activityService
          .logActivity({
            userId,
            actionType: ActionType.DELETE,
            fileCount: fileNames.length,
            details: { dir, fileNames }
          })
          .catch((err) => {
            loggerService.warn('FileService', `[batchDelete] 日志记录失败: ${err}`)
          })
      }
    } catch (error) {
      const appError = error as AppError
      loggerService.error('FileService', `[batchDelete] Error: ${appError.message}`)
      throw new IPCError(appError.message || '批量删除文件失败', IPCErrorCode.NETWORK)
    }
  }

  /**
   * 重命名
   */
  async rename(path: string, newName: string): Promise<void> {
    try {
      await alistService.renameFile(path, newName)

      // 记录重命名操作日志
      const userId = alistService.getCurrentUserId()
      if (userId) {
        activityService
          .logActivity({
            userId,
            actionType: ActionType.RENAME,
            fileCount: 1,
            details: { path, newName }
          })
          .catch((err) => {
            loggerService.warn('FileService', `[rename] 日志记录失败: ${err}`)
          })
      }
    } catch (error) {
      const appError = error as AppError
      loggerService.error('FileService', `[rename] Error: ${appError.message}`)
      throw new IPCError(appError.message || '重命名失败', IPCErrorCode.NETWORK)
    }
  }

  /**
   * 获取目录下所有文件（递归子目录）
   */
  async getAllFilesInDirectory(remotePath: string): Promise<string[]> {
    try {
      loggerService.info('FileService', `[getAllFilesInDirectory] Fetching all files in: ${remotePath}`)
      const filePaths = await alistService.getAllFilesInDirectory(remotePath || '/')
      loggerService.info('FileService', `[getAllFilesInDirectory] Success: found ${filePaths.length} files`)
      return filePaths
    } catch (error) {
      const appError = error as AppError
      loggerService.error('FileService', `[getAllFilesInDirectory] Error: ${JSON.stringify(appError)}`)

      if (appError.code === 'ALIST_401') {
        throw new IPCError(
          appError.message || 'Token 已失效，请重新登录',
          IPCErrorCode.UNAUTHORIZED
        )
      }

      throw new IPCError(appError.message || '获取目录文件失败', IPCErrorCode.NETWORK)
    }
  }

  // ==================== 私有方法 ====================

  private async saveCache(path: string, data: { content: unknown[]; total: number }): Promise<void> {
    const db = getDatabase()
    const userId = alistService.getCurrentUserId()
    if (!userId) return

    db.prepare('DELETE FROM file_cache WHERE user_id = ? AND path = ?').run(userId, path)
    db.prepare('INSERT INTO file_cache (user_id, path, content, cached_at) VALUES (?, ?, ?, ?)').run(
      userId,
      path,
      JSON.stringify(data),
      Date.now()
    )
  }

  private async readCache(path: string): Promise<FileListResult | null> {
    try {
      const db = getDatabase()
      const userId = alistService.getCurrentUserId()
      if (!userId) return null

      const cached = db
        .prepare('SELECT content, cached_at FROM file_cache WHERE user_id = ? AND path = ?')
        .get(userId, path) as { content: string; cached_at: number } | undefined

      if (cached && Date.now() - cached.cached_at < CACHE_TTL) {
        const data = JSON.parse(cached.content)
        loggerService.info('FileService', '[readCache] Returning cached data')
        return {
          content: data.content || [],
          total: data.total,
          fromCache: true,
          cachedAt: new Date(cached.cached_at).toISOString()
        }
      }
    } catch (err) {
      loggerService.warn('FileService', `[readCache] Cache read failed: ${err}`)
    }
    return null
  }
}

export const fileService = new FileService()
