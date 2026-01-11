import { describe, it, expect } from 'vitest'
import { DEFAULT_QUOTA, QUOTA_CACHE_DURATION, SESSION_EXPIRY_DAYS } from '@/shared/constants'

describe('Constants', () => {
  describe('DEFAULT_QUOTA', () => {
    it('应该等于10GB（字节）', () => {
      const expected = 10 * 1024 * 1024 * 1024 // 10737418240
      expect(DEFAULT_QUOTA).toBe(expected)
    })

    it('应该大于0', () => {
      expect(DEFAULT_QUOTA).toBeGreaterThan(0)
    })

    it('应该是整数', () => {
      expect(Number.isInteger(DEFAULT_QUOTA)).toBe(true)
    })
  })

  describe('QUOTA_CACHE_DURATION', () => {
    it('应该等于5分钟（毫秒）', () => {
      const expected = 5 * 60 * 1000 // 300000
      expect(QUOTA_CACHE_DURATION).toBe(expected)
    })

    it('应该大于0', () => {
      expect(QUOTA_CACHE_DURATION).toBeGreaterThan(0)
    })
  })

  describe('SESSION_EXPIRY_DAYS', () => {
    it('应该等于7天', () => {
      expect(SESSION_EXPIRY_DAYS).toBe(7)
    })

    it('应该大于0', () => {
      expect(SESSION_EXPIRY_DAYS).toBeGreaterThan(0)
    })
  })
})
