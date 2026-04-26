export function formatFileSize(bytes: number, precision: number = 1): string {
  if (!isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const k = 1024
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(precision)} ${units[i]}`
}

export function formatFileSizePrecise(bytes: number): string {
  return formatFileSize(bytes, 2)
}

export function formatQuotaSize(bytes: number): string {
  return formatFileSize(bytes, 0)
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

export function formatSpeed(bytesPerSecond: number, precision: number = 1): string {
  if (!isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
  const k = 1024
  const i = Math.min(Math.floor(Math.log(bytesPerSecond) / Math.log(k)), units.length - 1)
  return `${(bytesPerSecond / Math.pow(k, i)).toFixed(precision)} ${units[i]}`
}

export function formatSpeedPrecise(bytesPerSecond: number): string {
  return formatSpeed(bytesPerSecond, 2)
}

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

export function formatPercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

export function calculateETA(
  downloadedBytes: number,
  totalBytes: number,
  speed: number
): number {
  if (speed === 0 || totalBytes === 0) return Infinity

  const remainingBytes = totalBytes - downloadedBytes
  return remainingBytes / speed
}
