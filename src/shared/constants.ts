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
 * 单次批量下载的文件数量上限
 *
 * 限制原因：批量下载最终会一次性 INSERT 到 SQLite，受单语句绑定参数上限
 * （better-sqlite3 默认 32766）约束，且去重检查为每文件一次串行 DB 查询，
 * 文件过多会触发 Drizzle mergeQueries 递归爆栈或显著拖慢。
 * 超过此值时前端拦截并提示用户分批下载。
 */
export const MAX_BATCH_DOWNLOAD_FILES = 1000

/**
 * 批量下载统计目录树时的并发 list 请求数
 *
 * 背景：判定是否超过 MAX_BATCH_DOWNLOAD_FILES 需要递归数文件，串行遍历
 * 大目录树（文件分散在大量子目录）会因几十次串行 HTTP 累计耗时数十秒。
 * 同层子目录受控并发可把统计耗时从 ~30s 压到数秒。
 * 取值平衡：太大会给 Alist/百度网盘造成并发压力甚至触发限流，太小则加速不明显。
 */
export const DIRECTORY_SCAN_CONCURRENCY = 6

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

