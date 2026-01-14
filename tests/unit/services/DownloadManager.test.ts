import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DownloadManager } from '../../../src/main/services/DownloadManager'
import * as downloadConfigService from '../../../src/main/services/downloadConfigService'
import * as fs from 'fs'
import * as path from 'path'

// Mock dependencies
vi.mock('../../../src/main/services/TransferService')
vi.mock('../../../src/main/services/downloadConfigService')
vi.mock('fs')
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
    // Mock 配置返回开启状态
    vi.spyOn(downloadConfigService, 'getConfig').mockReturnValue({
      id: 1,
      defaultPath: 'C:\\Downloads\\溜溜网盘',
      autoCreateDateFolder: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Mock fs 方法
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined)

    // 调用私有方法 applyDateFolderLogic (通过反射)
    const result = await (downloadManager as any).applyDateFolderLogic(
      'C:\\Downloads\\溜溜网盘\\test.txt',
      'test.txt'
    )

    // 验证生成的路径包含 YYYY-MM 格式
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(result).toContain(yearMonth)
    expect(result).toContain('test.txt')

    // 验证创建了目录
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(yearMonth),
      { recursive: true }
    )
  })

  it('应该在配置关闭时不创建日期子目录', async () => {
    // Mock 配置返回关闭状态
    vi.spyOn(downloadConfigService, 'getConfig').mockReturnValue({
      id: 1,
      defaultPath: 'C:\\Downloads\\溜溜网盘',
      autoCreateDateFolder: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined)

    // 调用私有方法
    const result = await (downloadManager as any).applyDateFolderLogic(
      'C:\\Downloads\\溜溜网盘\\test.txt',
      'test.txt'
    )

    // 验证返回原路径
    expect(result).toBe('C:\\Downloads\\溜溜网盘\\test.txt')

    // 验证没有创建目录
    expect(mkdirSpy).not.toHaveBeenCalled()
  })

  it('应该在日期目录已存在时不重复创建', async () => {
    // Mock 配置返回开启状态
    vi.spyOn(downloadConfigService, 'getConfig').mockReturnValue({
      id: 1,
      defaultPath: 'C:\\Downloads\\溜溜网盘',
      autoCreateDateFolder: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Mock 目录已存在
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined)

    // 调用私有方法
    const result = await (downloadManager as any).applyDateFolderLogic(
      'C:\\Downloads\\溜溜网盘\\test.txt',
      'test.txt'
    )

    // 验证生成的路径包含日期
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(result).toContain(yearMonth)

    // 验证没有创建目录(因为已存在)
    expect(mkdirSpy).not.toHaveBeenCalled()
  })

  it('应该在出错时返回原路径', async () => {
    // Mock 配置抛出错误
    vi.spyOn(downloadConfigService, 'getConfig').mockImplementation(() => {
      throw new Error('配置读取失败')
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // 调用私有方法
    const result = await (downloadManager as any).applyDateFolderLogic(
      'C:\\Downloads\\溜溜网盘\\test.txt',
      'test.txt'
    )

    // 验证返回原路径
    expect(result).toBe('C:\\Downloads\\溜溜网盘\\test.txt')

    // 验证记录了错误
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '应用日期文件夹逻辑失败:',
      expect.any(Error)
    )
  })
})
