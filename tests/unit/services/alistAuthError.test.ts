import { describe, expect, it } from 'vitest'
import {
  ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE,
  ALIST_AUTH_EXPIRED_SYNC_MESSAGE,
  AlistAuthError,
  isAlistAuthError
} from '../../../src/main/core/api/alist-auth-error'

describe('alist auth error classifier', () => {
  it('识别 HTTP 401 状态码', () => {
    expect(isAlistAuthError({ response: { status: 401 }, message: 'Unauthorized' })).toBe(true)
    expect(isAlistAuthError({ status: 401, message: 'Unauthorized' })).toBe(true)
  })

  it('识别 Alist code 401 和 ALIST_401', () => {
    expect(isAlistAuthError({ code: 401, message: 'token is expired' })).toBe(true)
    expect(isAlistAuthError({ code: 'ALIST_401', message: 'failed' })).toBe(true)
    expect(isAlistAuthError('Alist错误(401): token is expired')).toBe(true)
  })

  it('识别 token expired、guest user 和未认证用户消息', () => {
    expect(isAlistAuthError(new Error('token is expired'))).toBe(true)
    expect(isAlistAuthError(new Error('guest user cannot access'))).toBe(true)
    expect(isAlistAuthError(new Error('用户未认证，请登录'))).toBe(true)
    expect(isAlistAuthError(new Error('Unauthorized access'))).toBe(true)
    expect(isAlistAuthError(new Error('用户未登录'))).toBe(true)
  })

  it('识别内部固定的 Alist 登录过期文案', () => {
    expect(isAlistAuthError(new Error(ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE))).toBe(true)
    expect(isAlistAuthError(new Error(ALIST_AUTH_EXPIRED_SYNC_MESSAGE))).toBe(true)
  })

  it('不把普通下载错误识别为认证失败', () => {
    expect(isAlistAuthError(new Error('object not found'))).toBe(false)
    expect(isAlistAuthError({ code: 'ALIST_500', message: 'storage unavailable' })).toBe(false)
  })

  it('识别 AlistAuthError 实例本身', () => {
    expect(isAlistAuthError(new AlistAuthError(ALIST_AUTH_EXPIRED_SYNC_MESSAGE))).toBe(true)
    expect(isAlistAuthError(new AlistAuthError(ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE))).toBe(true)
  })

  it('null、undefined 和空对象不是认证错误', () => {
    expect(isAlistAuthError(null)).toBe(false)
    expect(isAlistAuthError(undefined)).toBe(false)
    expect(isAlistAuthError({})).toBe(false)
    expect(isAlistAuthError('')).toBe(false)
  })

  it('提供下载和自动同步固定文案', () => {
    expect(ALIST_AUTH_EXPIRED_DOWNLOAD_MESSAGE).toBe('Alist 登录已过期，请重新登录后恢复下载')
    expect(ALIST_AUTH_EXPIRED_SYNC_MESSAGE).toBe('Alist 登录已过期，请重新登录后重试同步')
    expect(new AlistAuthError(ALIST_AUTH_EXPIRED_SYNC_MESSAGE).name).toBe('AlistAuthError')
  })
})
