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
      const appDataPath = normalize(app.getPath('appData')).toLowerCase()
      const userDataPath = normalize(app.getPath('userData')).toLowerCase()
      const appName = app.getName().toLowerCase()

      // 检查1: 必须在 AppData 目录下
      if (!normalizedPath.startsWith(appDataPath)) {
        loggerService.error('CacheService', `路径不在 AppData 目录下，拒绝操作: ${cachePath}`)
        return false
      }

      // 检查2: 不能是 AppData 或 userData 的根目录
      if (normalizedPath === appDataPath || normalizedPath === appDataPath + '\\' ||
          normalizedPath === userDataPath || normalizedPath === userDataPath + '\\') {
        loggerService.error('CacheService', `拒绝操作根目录: ${cachePath}`)
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
   * 只删除目录内的文件，不删除目录本身
   */
  private async clearCacheFiles(): Promise<void> {
    // 再次验证路径安全性
    if (!this.validateCachePath(this.cacheDir)) {
      loggerService.error('CacheService', '路径验证失败，拒绝清理操作')
      return
    }

    if (!existsSync(this.cacheDir)) {
      loggerService.info('CacheService', '缓存目录不存在，无需清理')
      return
    }

    // 额外安全检查：确保目录包含典型的 Electron 缓存子目录
    try {
      const files = await readdir(this.cacheDir)
      const hasCacheSubdir = files.some(f =>
        f.toLowerCase().includes('cache') ||
        f.toLowerCase() === 'indexdb' ||
        f.toLowerCase() === 'localstorage' ||
        f === 'GPUCache'
      )

      if (!hasCacheSubdir && files.length > 0) {
        loggerService.warn('CacheService', `警告: 缓存目录不包含典型的缓存子目录，可能不是正确的缓存目录`)
        loggerService.warn('CacheService', `目录内容: ${files.join(', ')}`)
      }
    } catch (error) {
      loggerService.warn('CacheService', '无法读取缓存目录内容')
    }

    try {
      loggerService.info('CacheService', `开始清理缓存目录内容: ${this.cacheDir}`)

      // 读取目录内容
      const files = await readdir(this.cacheDir)

      if (files.length === 0) {
        loggerService.info('CacheService', '缓存目录为空，无需清理')
        return
      }

      loggerService.info('CacheService', `找到 ${files.length} 个文件/目录需要清理`)

      // 逐个删除目录内的文件和子目录，但保留目录本身
      let successCount = 0
      let failCount = 0

      for (const file of files) {
        const filePath = join(this.cacheDir, file)
        try {
          await rm(filePath, { recursive: true, force: true })
          successCount++
          loggerService.info('CacheService', `已删除: ${file}`)
        } catch (error) {
          failCount++
          loggerService.error('CacheService', `删除失败: ${file}`, error as Error)
        }
      }

      loggerService.info('CacheService', `缓存清理完成 - 成功: ${successCount}, 失败: ${failCount}`)
    } catch (error) {
      loggerService.error('CacheService', '清理缓存目录失败', error as Error)
    }
  }

  /**
   * 手动清理缓存
   */
  async forceCleanup(): Promise<void> {
    if (!this.isInitialized) {
      loggerService.error('CacheService', '服务未初始化，无法执行清理')
      return
    }

    // 验证路径
    if (!this.validateCachePath(this.cacheDir)) {
      loggerService.error('CacheService', '路径验证失败，取消清理操作')
      return
    }

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
