/**
 * 检测错误消息是否为 Alist 认证失败
 *
 * 用于 renderer 进程（无法直接 import main 模块）和 main 进程共用的字符串级检测。
 * main 进程应优先使用 isAlistAuthError()（支持对象/状态码检测），
 * renderer 进程使用此函数对 error message 字符串做轻量判断。
 */
export function isAlistAuthFailureMessage(error: string | undefined): boolean {
  const value = (error || '').toLowerCase()
  return value.includes('alist 登录已过期') ||
    value.includes('alist错误(401)') ||
    value.includes('token is expired') ||
    value.includes('401') ||
    value.includes('guest user') ||
    value.includes('unauthorized') ||
    value.includes('未认证') ||
    value.includes('未登录') ||
    value.includes('登录已过期')
}
