export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

/**
 * 格式化配额显示（使用整数，符合AC要求）
 * @param bytes - 字节数
 * @returns 格式化后的字符串（如 "3 GB" 而不是 "3.5 GB"）
 * @example
 * formatQuotaSize(3221225472) // "3 GB"
 * formatQuotaSize(10737418240) // "10 GB"
 */
export function formatQuotaSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  // 使用 Math.round 而不是 toFixed(1)，显示整数
  return `${Math.round(bytes / Math.pow(k, i))} ${units[i]}`
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * 格式化下载速度为人类可读格式
 * @param bytesPerSecond - 每秒下载的字节数
 * @returns 格式化后的速度字符串（如 "1.5 MB/s"）
 * @example
 * formatSpeed(1536000) // "1.5 MB/s"
 * formatSpeed(0) // "0 B/s"
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
  const k = 1024
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  return `${(bytesPerSecond / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

/**
 * 格式化剩余时间为人类可读格式
 * @param seconds - 剩余秒数
 * @returns 格式化后的时间字符串（如 "2分30秒"）
 * @example
 * formatTime(150) // "2分30秒"
 * formatTime(Infinity) // "计算中..."
 * formatTime(0) // "即将完成"
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '计算中...'
  if (seconds === 0) return '即将完成'
  if (seconds < 60) return `${Math.floor(seconds)}秒`

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else if (minutes > 0) {
    return `${minutes}分${secs}秒`
  } else {
    return `${secs}秒`
  }
}

/**
 * 格式化百分比
 * @param value - 当前值
 * @param total - 总值
 * @returns 百分比数值（0-100）
 * @example
 * formatPercentage(50, 100) // 50
 * formatPercentage(1, 3) // 33
 */
export function formatPercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

/**
 * 计算预计剩余时间（Estimated Time of Arrival）
 * @param downloadedBytes - 已下载字节数
 * @param totalBytes - 总字节数
 * @param speed - 当前下载速度（字节/秒）
 * @returns 预计剩余秒数，如果速度为 0 或总大小为 0 则返回 Infinity
 * @example
 * calculateETA(5242880, 10485760, 1048576) // 5 (5秒)
 * calculateETA(0, 10485760, 0) // Infinity
 */
export function calculateETA(
  downloadedBytes: number,
  totalBytes: number,
  speed: number
): number {
  if (speed === 0 || totalBytes === 0) return Infinity

  const remainingBytes = totalBytes - downloadedBytes
  return remainingBytes / speed
}
