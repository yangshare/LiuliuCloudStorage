/**
 * 应用程序常量定义
 */

/**
 * 默认用户配额（10GB）
 * 单位：字节
 */
export const DEFAULT_QUOTA = 10 * 1024 * 1024 * 1024 // 10737418240 字节

/**
 * 会话有效期（7天）
 * 单位：毫秒
 */
export const SESSION_EXPIRY_DAYS = 7

/**
 * 配额缓存时长（5分钟）
 * 单位：毫秒
 */
export const QUOTA_CACHE_DURATION = 5 * 60 * 1000

/**
 * 最大并发上传任务数
 */
export const MAX_CONCURRENT_UPLOADS = 10

/**
 * 最大并发下载任务数
 */
export const MAX_CONCURRENT_DOWNLOADS = 5

/**
 * API 超时时间（10秒）
 * 单位：毫秒
 */
export const API_TIMEOUT = 10 * 1000

/**
 * 上传/下载进度更新频率（1秒）
 * 单位：毫秒
 */
export const PROGRESS_UPDATE_INTERVAL = 1 * 1000
