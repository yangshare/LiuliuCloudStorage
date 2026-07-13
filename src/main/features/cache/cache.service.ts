import { cacheService } from '../../core/cache/cache.service'
import { formatFileSize } from '../../../shared/formatters'

export interface CacheInfo {
  size: string
  directory: string
  lastCleanup: string
}

export interface CacheClearResult {
  clearedSize: string
  remainingSize: string
  filesDeleted: number
}

export class CacheFeatureService {
  async getCacheInfo(): Promise<CacheInfo> {
    const sizeInfo = await cacheService.getCacheSizeInfo()
    const directory = cacheService.getCacheDirectory()
    return {
      size: sizeInfo.formatted,
      directory,
      lastCleanup: ''
    }
  }

  async clearCache(): Promise<CacheClearResult> {
    const beforeSize = await cacheService.getCacheSizeInfo()
    const filesDeleted = await cacheService.forceCleanup()
    const afterSize = await cacheService.getCacheSizeInfo()
    const clearedBytes = beforeSize.size - afterSize.size

    return {
      clearedSize: formatFileSize(clearedBytes),
      remainingSize: afterSize.formatted,
      filesDeleted
    }
  }
}

export const cacheFeatureService = new CacheFeatureService()
