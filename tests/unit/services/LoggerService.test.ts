import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock electron app before importing LoggerService
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/tmp/test')
  }
}))

describe('LoggerService', () => {
  describe('服务基础功能', () => {
    it('应该能够导入 LoggerService', async () => {
      const { loggerService } = await import('../../../src/main/services/LoggerService')
      expect(loggerService).toBeDefined()
      expect(loggerService).toBeInstanceOf(Object)
    })

    it('应该提供所有必需的日志方法', async () => {
      const { loggerService } = await import('../../../src/main/services/LoggerService')

      expect(typeof loggerService.info).toBe('function')
      expect(typeof loggerService.error).toBe('function')
      expect(typeof loggerService.warn).toBe('function')
      expect(typeof loggerService.debug).toBe('function')
      expect(typeof loggerService.getLogsDir).toBe('function')
    })

    it('应该返回日志目录路径', async () => {
      const { loggerService } = await import('../../../src/main/services/LoggerService')
      const logsDir = loggerService.getLogsDir()

      expect(typeof logsDir).toBe('string')
      expect(logsDir.length).toBeGreaterThan(0)
      expect(logsDir).toContain('logs')
    })

    it('应该能够调用 info 方法而不抛出错误', async () => {
      const { loggerService } = await import('../../../src/main/services/LoggerService')

      expect(() => {
        loggerService.info('TestModule', '测试信息消息')
      }).not.toThrow()
    })

    it('应该能够调用 error 方法而不抛出错误', async () => {
      const { loggerService } = await import('../../../src/main/services/LoggerService')

      expect(() => {
        loggerService.error('TestModule', '测试错误消息', new Error('测试错误'))
      }).not.toThrow()
    })

    it('应该能够调用 warn 方法而不抛出错误', async () => {
      const { loggerService } = await import('../../../src/main/services/LoggerService')

      expect(() => {
        loggerService.warn('TestModule', '测试警告消息')
      }).not.toThrow()
    })

    it('应该能够调用 debug 方法而不抛出错误', async () => {
      const { loggerService } = await import('../../../src/main/services/LoggerService')

      expect(() => {
        loggerService.debug('TestModule', '测试调试消息')
      }).not.toThrow()
    })
  })

  describe('单例模式', () => {
    it('应该返回相同的实例', async () => {
      const module1 = await import('../../../src/main/services/LoggerService')
      const module2 = await import('../../../src/main/services/LoggerService')

      expect(module1.loggerService).toBe(module2.loggerService)
    })
  })

  describe('日志级别枚举', () => {
    it('应该导出 LogLevel 枚举', async () => {
      const { LogLevel } = await import('../../../src/main/services/LoggerService')

      expect(LogLevel).toBeDefined()
      expect(LogLevel.ERROR).toBe('error')
      expect(LogLevel.WARN).toBe('warn')
      expect(LogLevel.INFO).toBe('info')
      expect(LogLevel.DEBUG).toBe('debug')
    })
  })
})
