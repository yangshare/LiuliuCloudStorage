import { app, session } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { readdir, stat, rm } from 'fs/promises'
import { loggerService } from './LoggerService'

/**
 * 缓存清理策略
 */
export interface CacheCleanupOptions {
  /** 缓存大小上限（字节），默认 500MB */
  maxSize?: number
  /** 是否在启动时自动清理，默认 true */
  autoCleanupOnStart?: boolean
}

/**
 * 缓存清理服务类
 * 负责监控和清理应用缓存
 */
class CacheService {
  private static instance: CacheService | null = null
  private cacheDir: string
  private maxSize: number

  private constructor() {
    this.cacheDir = app.getPath('cache')
    this.maxSize = 500 * 1024 * 1024 // 默认 500MB
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  /**
   * 初始化缓存服务
   */
  initialize(options: CacheCleanupOptions = {}): void {
    if (options.maxSize !== undefined) {
      this.maxSize = options.maxSize
    }

    const autoCleanup = options.autoCleanupOnStart !== false

    loggerService.info('CacheService', `缓存目录: ${this.cacheDir}`)
    loggerService.info('CacheService', `缓存大小上限: ${this.formatBytes(this.maxSize)}`)

    if (autoCleanup) {
      // 延迟执行，确保 session 已准备好
      setTimeout(() => {
        this.cleanupIfNeeded().catch(error => {
          loggerService.error('CacheService', '自动清理缓存失败', error as Error)
        })
      }, 3000)
    }
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
            loggerService.debug('CacheService', `跳过文件: ${filePath}`)
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
   * 清理 Electron 缓存
   * 注意：不清理 cookies 和 localStorage 以保留用户登录状态和设置
   */
  async clearElectronCache(): Promise<void> {
    try {
      const defaultSession = session.defaultSession
      if (defaultSession) {
        await defaultSession.clearStorageData({
          storages: [
            'appcache',
            // 'cookies',           // 保留用户登录状态
            'filesystem',
            'indexdb',
            // 'localstorage',      // 保留用户设置
            'shadercache',
            'websql',
            'serviceworkers',
            'cachestorage'
          ],
          quotas: ['temporary']  // 只清理临时数据
        })
        loggerService.info('CacheService', 'Electron 缓存已清理')
      }
    } catch (error) {
      loggerService.error('CacheService', '清理 Electron 缓存失败', error as Error)
    }
  }

  /**
   * 清理缓存目录文件
   */
  private async clearCacheFiles(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      return
    }

    try {
      await rm(this.cacheDir, { recursive: true, force: true })
      loggerService.info('CacheService', '缓存目录文件已清理')
    } catch (error) {
      loggerService.error('CacheService', '清理缓存目录失败', error as Error)
    }
  }

  /**
   * 检查并在需要时清理缓存
   */
  async cleanupIfNeeded(): Promise<void> {
    const cacheSize = await this.getCacheSize()
    loggerService.info('CacheService', `当前缓存大小: ${this.formatBytes(cacheSize)}`)

    if (cacheSize > this.maxSize) {
      loggerService.info('CacheService', `缓存超过上限 (${this.formatBytes(this.maxSize)})，开始清理...`)

      // 先清理 Electron 缓存
      await this.clearElectronCache()

      // 等待文件系统更新
      await new Promise(resolve => setTimeout(resolve, 500))

      // 如果仍然过大，删除整个缓存目录
      const newSize = await this.getCacheSize()
      if (newSize > this.maxSize) {
        loggerService.info('CacheService', '删除缓存目录...')
        await this.clearCacheFiles()
      }

      const finalSize = await this.getCacheSize()
      loggerService.info('CacheService', `清理完成，当前缓存大小: ${this.formatBytes(finalSize)}`)
    } else {
      loggerService.info('CacheService', '缓存大小正常，无需清理')
    }
  }

  /**
   * 手动清理缓存
   */
  async forceCleanup(): Promise<void> {
    loggerService.info('CacheService', '手动清理缓存...')
    await this.clearElectronCache()
    await this.clearCacheFiles()

    const finalSize = await this.getCacheSize()
    loggerService.info('CacheService', `手动清理完成，当前缓存大小: ${this.formatBytes(finalSize)}`)
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
    const size = await this.getCacheSize()
    return {
      size,
      formatted: this.formatBytes(size)
    }
  }
}

// 导出单例
export const cacheService = CacheService.getInstance()
