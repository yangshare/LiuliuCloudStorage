import { app, session } from 'electron'
import { join, normalize, resolve } from 'path'
import { existsSync } from 'fs'
import { readdir, stat, rm } from 'fs/promises'
import { loggerService } from './LoggerService'

/**
 * 缓存清理策略
 */
export interface CacheCleanupOptions {
  /** 缓存大小上限（字节），默认 500MB */
  maxSize?: number
}

/**
 * 缓存清理服务类
 * 负责监控和清理应用缓存
 */
class CacheService {
  private static instance: CacheService | null = null
  private cacheDir: string
  private maxSize: number
  private isInitialized: boolean = false

  private constructor() {
    // 不在构造函数中初始化路径，等待 app.whenReady()
    this.cacheDir = ''
    this.maxSize = 500 * 1024 * 1024 // 默认 500MB
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  /**
   * 验证缓存路径是否安全
   * 防止误删其他目录
   */
  private validateCachePath(cachePath: string): boolean {
    try {
      const normalizedPath = normalize(resolve(cachePath)).toLowerCase()

      // 获取系统关键路径
      // 注意：直接使用 'appData' 可能受到 setPath 影响，使用原始的 Roaming 路径
      const roamingPath = normalize(join(app.getPath('userData'), '..', '..')).toLowerCase()
      const userDataPath = normalize(app.getPath('userData')).toLowerCase()
      const appName = app.getName().toLowerCase()

      // 检查1: 必须在 AppData/Roaming 目录下
      if (!normalizedPath.startsWith(roamingPath)) {
        loggerService.error('CacheService', `路径不在 AppData 目录下，拒绝操作: ${cachePath}`)
        return false
      }

      // 检查2: 不能是 userData 的根目录（缓存目录应该在 userData 下）
      if (normalizedPath === userDataPath || normalizedPath === userDataPath + '\\' ||
          normalizedPath === userDataPath + '/') {
        loggerService.error('CacheService', `拒绝操作用户数据根目录: ${cachePath}`)
        return false
      }

      // 检查3: 路径必须包含应用名称或 Cache 目录
      const hasAppName = normalizedPath.includes(appName)
      const hasCacheDir = normalizedPath.includes('cache')

      if (!hasAppName && !hasCacheDir) {
        loggerService.error('CacheService', `路径不包含应用名称或 Cache 目录，拒绝操作: ${cachePath}`)
        return false
      }

      loggerService.info('CacheService', `路径验证通过: ${cachePath}`)
      return true

    } catch (error) {
      loggerService.error('CacheService', `路径验证失败: ${error}`)
      return false
    }
  }

  /**
   * 初始化缓存服务
   */
  initialize(options: CacheCleanupOptions = {}): void {
    if (this.isInitialized) {
      loggerService.warn('CacheService', '缓存服务已初始化，跳过')
      return
    }

    // 获取缓存路径
    this.cacheDir = app.getPath('cache')

    // 不在初始化时验证路径，只记录路径信息
    // 路径验证会在手动清理时进行
    loggerService.info('CacheService', `缓存目录: ${this.cacheDir}`)

    this.isInitialized = true
    if (options.maxSize !== undefined) {
      this.maxSize = options.maxSize
    }

    loggerService.info('CacheService', `缓存大小上限: ${this.formatBytes(this.maxSize)}`)
    loggerService.info('CacheService', '缓存服务初始化完成')
  }

  /**
   * 获取缓存目录大小（字节）
   * 使用并行遍历提升大目录的性能
   */
  private async getCacheSize(): Promise<number> {
    if (!existsSync(this.cacheDir)) {
      return 0
    }

    const MAX_DEPTH = 50

    /**
     * 递归计算目录大小，返回该目录的总大小
     */
    const calculateSize = async (dir: string, depth = 0): Promise<number> => {
      if (depth > MAX_DEPTH) {
        loggerService.warn('CacheService', `目录深度超过限制，跳过: ${dir}`)
        return 0
      }

      try {
        const files = await readdir(dir, { withFileTypes: true })

        // 分离文件和目录
        const directories: string[] = []
        let fileSize = 0

        for (const file of files) {
          const filePath = join(dir, file.name)

          try {
            // 跳过符号链接，避免重复计算
            if (file.isSymbolicLink()) {
              continue
            }

            if (file.isDirectory()) {
              directories.push(filePath)
            } else {
              const stats = await stat(filePath)
              fileSize += stats.size
            }
          } catch (error) {
            // 单个文件错误不影响整体计算
            loggerService.warn('CacheService', `跳过文件: ${filePath}`)
          }
        }

        // 并行处理所有子目录
        const dirSizes = await Promise.all(
          directories.map(d => calculateSize(d, depth + 1))
        )

        // 返回当前目录文件大小 + 所有子目录大小
        return fileSize + dirSizes.reduce((sum, size) => sum + size, 0)

      } catch (error) {
        loggerService.error('CacheService', `读取目录失败: ${dir}`, error as Error)
        return 0
      }
    }

    try {
      return await calculateSize(this.cacheDir)
    } catch (error) {
      loggerService.error('CacheService', '计算缓存大小失败', error as Error)
      return 0
    }
  }


  /**
   * 清理 Cache_Data 目录中的失败/临时文件
   * 这些文件通常是下载过程中的临时文件
   */
  private async clearCacheDataFailures(): Promise<number> {
    const cacheDataDir = join(this.cacheDir, 'Cache_Data')

    if (!existsSync(cacheDataDir)) {
      loggerService.info('CacheService', 'Cache_Data 目录不存在，无需清理')
      return 0
    }

    try {
      const files = await readdir(cacheDataDir)
      const fFiles = files.filter(f => f.toLowerCase().startsWith('f_'))

      if (fFiles.length === 0) {
        loggerService.info('CacheService', 'Cache_Data 中没有 f_ 文件需要清理')
        return 0
      }

      loggerService.info('CacheService', `找到 ${fFiles.length} 个 f_ 文件需要清理`)

      let successCount = 0
      let failCount = 0

      for (const file of fFiles) {
        const filePath = join(cacheDataDir, file)
        try {
          await rm(filePath, { force: true, maxRetries: 3 })
          successCount++
          loggerService.info('CacheService', `已删除: ${file}`)
        } catch (error) {
          failCount++
          loggerService.error('CacheService', `删除失败: ${file}`, error as Error)
        }
      }

      loggerService.info('CacheService', `f_ 文件清理完成 - 成功: ${successCount}, 失败: ${failCount}`)
      return successCount
    } catch (error) {
      loggerService.error('CacheService', '清理 f_ 文件时出错', error as Error)
      return 0
    }
  }

  /**
   * 手动清理缓存（只清理 f_ 开头的下载缓存）
   * @returns 删除的文件数量
   */
  async forceCleanup(): Promise<number> {
    if (!this.isInitialized) {
      loggerService.error('CacheService', '服务未初始化，无法执行清理')
      return 0
    }

    // 验证路径
    if (!this.validateCachePath(this.cacheDir)) {
      loggerService.error('CacheService', '路径验证失败，取消清理操作')
      return 0
    }

    loggerService.info('CacheService', '开始清理缓存（仅 f_ 文件）...')
    const deletedCount = await this.clearCacheDataFailures()

    // Story 10.1 FIX: 清理 Electron 会话缓存以解决 net::ERR_CACHE_READ_FAILURE
    try {
      loggerService.info('CacheService', '正在清理 Electron 会话缓存...')
      await session.defaultSession.clearCache()
      loggerService.info('CacheService', 'Electron 会话缓存清理完成')
    } catch (e) {
      loggerService.error('CacheService', '清理 Electron 会话缓存失败', e as Error)
    }

    const finalSize = await this.getCacheSize()
    loggerService.info('CacheService', `缓存清理完成，当前缓存大小: ${this.formatBytes(finalSize)}`)

    return deletedCount
  }

  /**
   * 格式化字节数为可读格式
   */
  private formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 获取缓存大小（供外部查询）
   */
  async getCacheSizeInfo(): Promise<{ size: number; formatted: string }> {
    if (!this.isInitialized) {
      return { size: 0, formatted: '0 B' }
    }

    const size = await this.getCacheSize()
    return {
      size,
      formatted: this.formatBytes(size)
    }
  }

  /**
   * 获取缓存目录路径（供调试使用）
   */
  getCacheDirectory(): string {
    return this.cacheDir
  }
}

// 导出单例
export const cacheService = CacheService.getInstance()
