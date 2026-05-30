export const ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE = 'Alist 登录已过期，请重新登录后恢复下载'
export const ALIST_AUTH_EXPIRED_SYNC_MESSAGE = 'Alist 登录已过期，请重新登录后重试同步'

export class AlistAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AlistAuthError'
  }
}

function readMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const record = error as Record<string, any>
    return [
      record.message,
      record.error,
      record.response?.data?.message,
      record.response?.statusText
    ].filter(Boolean).join(' ')
  }
  return ''
}

function readCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as Record<string, any>
    return String(record.code ?? record.response?.data?.code ?? record.response?.status ?? record.status ?? '')
  }
  return ''
}

export function isAlistAuthError(error: unknown): boolean {
  const code = readCode(error).toUpperCase()
  if (code === '401' || code === 'ALIST_401') return true

  const message = readMessage(error).toLowerCase()
  if (message.includes('alist错误(401)')) return true
  if (message.includes('token is expired')) return true
  if (message.includes('guest user')) return true
  if (message.includes('unauthorized')) return true
  if (message.includes('未认证')) return true
  if (message.includes('未登录')) return true

  return false
}