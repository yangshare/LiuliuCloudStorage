import { describe, expect, it } from 'vitest'
import { normalizeSessionCheckResult } from '@/features/auth/auth.renderer.service'

describe('normalizeSessionCheckResult', () => {
  it('应该兼容统一 IPC 包装后的会话结果', () => {
    const session = normalizeSessionCheckResult({
      success: true,
      data: {
        valid: true,
        user: {
          id: 1,
          username: 'testuser',
          token: 'token',
          isAdmin: false
        }
      }
    })

    expect(session.valid).toBe(true)
    expect(session.username).toBe('testuser')
    expect(session.user?.id).toBe(1)
  })

  it('应该兼容旧版未包装的会话结果', () => {
    const session = normalizeSessionCheckResult({
      valid: true,
      username: 'legacy-user'
    })

    expect(session.valid).toBe(true)
    expect(session.username).toBe('legacy-user')
  })

  it('应该把失败的 IPC 包装结果视为未登录', () => {
    const session = normalizeSessionCheckResult({
      success: false,
      data: {
        valid: true
      }
    })

    expect(session.valid).toBe(false)
  })
})
