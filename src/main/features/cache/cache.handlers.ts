import { ipcMain } from 'electron'
import { cacheFeatureService } from './cache.service'
import { loggerService } from '../../core/logger/logger.service'

export function registerCacheHandlers(): void {
  ipcMain.handle('cache:info:get', async () => {
    try {
      const info = await cacheFeatureService.getCacheInfo()
      return { success: true, ...info }
    } catch (error: any) {
      loggerService.error('CacheHandler', '获取缓存信息失败', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('cache:data:clear', async () => {
    try {
      loggerService.info('CacheHandler', '开始手动清理缓存（仅 f_ 文件）')
      const result = await cacheFeatureService.clearCache()
      loggerService.info('CacheHandler', `缓存清理完成，清理了 ${result.clearedSize}，删除了 ${result.filesDeleted} 个文件`)
      return { success: true, ...result }
    } catch (error: any) {
      loggerService.error('CacheHandler', '清理缓存失败', error)
      return { success: false, error: error.message }
    }
  })
}
