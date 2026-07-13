import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DownloadManager } from '../../../src/main/features/transfer/download.manager'
import * as fs from 'fs'

const { mockExistsSync, mockMkdirSync, mockGetConfig } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockGetConfig: vi.fn()
}))

vi.mock('../../../src/main/features/transfer/transfer.service', () => ({
  TransferService: vi.fn(function () {
    return {
      updateFilePath: vi.fn(),
      getTaskById: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateProgress: vi.fn(),
      markAsFailed: vi.fn()
    }
  })
}))

vi.mock('../../../src/main/features/downloadConfig/download-config.core.service', () => ({
  getConfig: mockGetConfig,
  downloadConfigService: {
    getConfig: mockGetConfig
  }
}))

vi.mock('../../../src/main/core/logger/logger.service', () => ({
  loggerService: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync
}))

vi.mock('electron', () => ({
  net: {
    request: vi.fn()
  },
  app: {
    getPath: vi.fn(() => 'C:\\Downloads')
  }
}))

describe('DownloadManager - 按日期自动分类', () => {
  let downloadManager: DownloadManager

  beforeEach(() => {
    vi.clearAllMocks()
    downloadManager = new DownloadManager()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该在配置开启时创建日期子目录', async () => {
    mockGetConfig.mockReturnValue({
      id: 1,
      defaultPath: 'C:\\Downloads\\溜溜网盘',
      autoCreateDateFolder: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    mockExistsSync.mockReturnValue(false)

    const result = await (downloadManager as any).applyDateFolderLogic(
      'C:\\Downloads\\溜溜网盘\\test.txt',
      'test.txt'
    )

    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(result).toContain(dateStr)
    expect(result).toContain('test.txt')
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(dateStr),
      { recursive: true }
    )
  })

  it('应该在配置关闭时不创建日期子目录', async () => {
    mockGetConfig.mockReturnValue({
      id: 1,
      defaultPath: 'C:\\Downloads\\溜溜网盘',
      autoCreateDateFolder: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const result = await (downloadManager as any).applyDateFolderLogic(
      'C:\\Downloads\\溜溜网盘\\test.txt',
      'test.txt'
    )

    expect(result).toBe('C:\\Downloads\\溜溜网盘\\test.txt')
    expect(fs.mkdirSync).not.toHaveBeenCalled()
  })

  it('应该在日期目录已存在时不重复创建', async () => {
    mockGetConfig.mockReturnValue({
      id: 1,
      defaultPath: 'C:\\Downloads\\溜溜网盘',
      autoCreateDateFolder: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    mockExistsSync.mockReturnValue(true)

    const result = await (downloadManager as any).applyDateFolderLogic(
      'C:\\Downloads\\溜溜网盘\\test.txt',
      'test.txt'
    )

    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(result).toContain(dateStr)
    expect(fs.mkdirSync).not.toHaveBeenCalled()
  })

  it('应该在出错时返回原路径', async () => {
    mockGetConfig.mockImplementation(() => {
      throw new Error('配置读取失败')
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await (downloadManager as any).applyDateFolderLogic(
      'C:\\Downloads\\溜溜网盘\\test.txt',
      'test.txt'
    )

    expect(result).toBe('C:\\Downloads\\溜溜网盘\\test.txt')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '应用日期文件夹逻辑失败:',
      expect.any(Error)
    )
  })
})
