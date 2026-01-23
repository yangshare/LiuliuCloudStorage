import { ipcMain } from 'electron'
import { cacheService } from '../../services/CacheService'
import { loggerService } from '../../services/LoggerService'

/**
 * 注册缓存管理相关的IPC处理器
 */
export function registerCacheHandlers(): void {
  /**
   * 获取缓存信息
   */
  ipcMain.handle('cache:get-info', async () => {
    try {
      const sizeInfo = await cacheService.getCacheSizeInfo()
      const directory = cacheService.getCacheDirectory()

      // 获取上次清理时间（从本地存储读取）
      // TODO: 实现持久化存储上次清理时间
      const lastCleanup = '' // 暂时为空

      return {
        success: true,
        size: sizeInfo.formatted,
        directory: directory,
        lastCleanup: lastCleanup
      }
    } catch (error: any) {
      loggerService.error('CacheHandler', '获取缓存信息失败', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  /**
   * 清理缓存（只清理 f_ 开头的下载缓存）
   */
  ipcMain.handle('cache:clear', async () => {
    try {
      loggerService.info('CacheHandler', '开始手动清理缓存（仅 f_ 文件）')

      // 获取清理前的大小
      const beforeSize = await cacheService.getCacheSizeInfo()

      // 执行清理并获取删除的文件数量
      const filesDeleted = await cacheService.forceCleanup()

      // 获取清理后的大小
      const afterSize = await cacheService.getCacheSizeInfo()

      // 计算清理的大小
      const clearedBytes = beforeSize.size - afterSize.size
      const clearedSize = formatBytes(clearedBytes)

      loggerService.info('CacheHandler', `缓存清理完成，清理了 ${clearedSize}，删除了 ${filesDeleted} 个文件`)

      return {
        success: true,
        clearedSize: clearedSize,
        remainingSize: afterSize.formatted,
        filesDeleted: filesDeleted
      }
    } catch (error: any) {
      loggerService.error('CacheHandler', '清理缓存失败', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
}

/**
 * 格式化字节数为可读格式
 */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
