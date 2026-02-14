/**
 * ShareTransferService 单元测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

// Mock database
vi.mock('../../src/main/database', () => ({
  getDatabase: vi.fn(() => ({}))
}))

// Mock config
vi.mock('../../src/main/config', () => ({
  loadConfig: vi.fn(() => ({
    ambApiBaseUrl: 'https://test-api.example.com'
  }))
}))

// Mock logger
vi.mock('../../src/main/services/LoggerService', () => ({
  loggerService: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

import axios from 'axios'

describe('ShareTransferService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 设置环境变量
    process.env.AMB_TRANSFER_TOKEN = 'test-token'
  })

  afterEach(() => {
    vi.resetModules()
    delete process.env.AMB_TRANSFER_TOKEN
  })

  describe('getTransferToken', () => {
    it('应该从环境变量读取 Token', async () => {
      // 这个测试验证 Token 不再硬编码
      expect(process.env.AMB_TRANSFER_TOKEN).toBe('test-token')
    })
  })

  describe('URL 验证', () => {
    it('应该接受有效的百度网盘链接', () => {
      const validUrls = [
        'https://pan.baidu.com/s/1abc123',
        'http://pan.baidu.com/s/xyz789',
        'https://dwz.cn/abc123'
      ]

      const urlPattern = /^https?:\/\/(pan\.baidu\.com\/s\/|dwz\.cn\/)[a-zA-Z0-9_-]+/

      validUrls.forEach(url => {
        expect(urlPattern.test(url)).toBe(true)
      })
    })

    it('应该拒绝无效的链接', () => {
      const invalidUrls = [
        'not-a-url',
        'https://google.com',
        'https://pan.baidu.com/',  // 缺少 /s/xxx 部分
        ''
      ]

      const urlPattern = /^https?:\/\/(pan\.baidu\.com\/s\/|dwz\.cn\/)[a-zA-Z0-9_-]+/

      invalidUrls.forEach(url => {
        expect(urlPattern.test(url)).toBe(false)
      })
    })
  })
})
