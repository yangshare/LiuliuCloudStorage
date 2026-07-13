import { describe, expect, it, vi, beforeEach } from 'vitest'

// logger.service 在模块加载时初始化，依赖 electron 的 app；测试环境无 Electron 运行时，需 mock
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '', getName: () => 'test', getVersion: () => '0.0.0' }
}))

import { alistService } from '../../../src/main/core/api/alist.service'
import type { FileItem } from '../../../src/main/core/api/alist.service'

// 生成 n 个文件项（非目录）
function makeFiles(n: number, prefix = 'f'): FileItem[] {
  return Array.from({ length: n }, (_, i) => ({ name: `${prefix}${i}.txt`, size: 1, isDir: false, modified: '' }))
}

// 构造目录项
function dir(name: string): FileItem {
  return { name, size: 0, isDir: true, modified: '' }
}

// 按路径返回内容的映射表，构造一棵可预测的目录树
function buildSpy(dirMap: Record<string, FileItem[]>, hooks?: { onList?: (p: string) => void }) {
  return vi.fn(async (path: string) => {
    hooks?.onList?.(path)
    return { content: dirMap[path] || [], total: (dirMap[path] || []).length, readme: '', write: false, provider: 'baidu' }
  })
}

describe('alistService.getAllFilesInDirectory 并发遍历', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('递归收集根目录及子目录的全部文件', async () => {
    const dirMap: Record<string, FileItem[]> = {
      '/': [{ name: 'a.txt', size: 1, isDir: false, modified: '' }, dir('sub')],
      '/sub': [{ name: 'b.txt', size: 1, isDir: false, modified: '' }, dir('deep')],
      '/sub/deep': [{ name: 'c.txt', size: 1, isDir: false, modified: '' }]
    }
    const spy = buildSpy(dirMap)
    vi.spyOn(alistService, 'listFiles').mockImplementation(spy as never)

    const result = await alistService.getAllFilesInDirectory('/')

    expect(new Set(result.files)).toEqual(new Set(['/a.txt', '/sub/b.txt', '/sub/deep/c.txt']))
    expect(result.truncated).toBe(false)
    expect(result.cancelled).toBe(false)
  })

  it('达到 maxFiles 提前中断并标记 truncated', async () => {
    // 根目录直接含 10 个文件，maxFiles=5：遍历到第 5 个即应中断
    const dirMap: Record<string, FileItem[]> = { '/': makeFiles(10) }
    vi.spyOn(alistService, 'listFiles').mockImplementation(buildSpy(dirMap) as never)

    const result = await alistService.getAllFilesInDirectory('/', 5)

    expect(result.files.length).toBe(5)
    expect(result.truncated).toBe(true)
    expect(result.cancelled).toBe(false)
  })

  it('文件数刚好等于 maxFiles 时不标记 truncated', async () => {
    const dirMap: Record<string, FileItem[]> = { '/': makeFiles(5) }
    vi.spyOn(alistService, 'listFiles').mockImplementation(buildSpy(dirMap) as never)

    const result = await alistService.getAllFilesInDirectory('/', 5)

    expect(result.files.length).toBe(5)
    expect(result.truncated).toBe(false)
    expect(result.cancelled).toBe(false)
  })

  it('并发遍历多个子目录：listFiles 被并发调用', async () => {
    // 根目录含 6 个子目录；记录同时在途（未 resolve）的最大请求数
    const dirMap: Record<string, FileItem[]> = {
      '/': [dir('d1'), dir('d2'), dir('d3'), dir('d4'), dir('d5'), dir('d6')],
      '/d1': makeFiles(1, 'd1'), '/d2': makeFiles(1, 'd2'), '/d3': makeFiles(1, 'd3'),
      '/d4': makeFiles(1, 'd4'), '/d5': makeFiles(1, 'd5'), '/d6': makeFiles(1, 'd6')
    }
    let inFlight = 0
    let maxInFlight = 0
    const impl = async (path: string) => {
      if (path !== '/') {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        // 让子目录请求异步让出，确保并发派发
        await Promise.resolve()
        inFlight--
      }
      return { content: dirMap[path] || [], total: 0, readme: '', write: false, provider: 'baidu' }
    }
    vi.spyOn(alistService, 'listFiles').mockImplementation(impl as never)

    const result = await alistService.getAllFilesInDirectory('/')

    expect(result.files.length).toBe(6)
    // 并发度应为 DIRECTORY_SCAN_CONCURRENCY(6)，至少 >1 才证明不是串行
    expect(maxInFlight).toBeGreaterThan(1)
    expect(maxInFlight).toBeLessThanOrEqual(6)
  })

  it('signal abort 后立即收尾并标记 cancelled', async () => {
    const controller = new AbortController()
    const dirMap: Record<string, FileItem[]> = {
      '/': [dir('d1'), dir('d2')],
      '/d1': makeFiles(20),
      '/d2': makeFiles(20)
    }
    const impl = async (path: string) => {
      // 进入 d1 时触发取消
      if (path === '/d1') controller.abort()
      return { content: dirMap[path] || [], total: 0, readme: '', write: false, provider: 'baidu' }
    }
    vi.spyOn(alistService, 'listFiles').mockImplementation(impl as never)

    const result = await alistService.getAllFilesInDirectory('/', undefined, { signal: controller.signal })

    expect(result.cancelled).toBe(true)
    expect(result.truncated).toBe(false)
  })

  it('把 AbortSignal 透传给 listFiles 以取消在途请求', async () => {
    const controller = new AbortController()
    const dirMap: Record<string, FileItem[]> = { '/': [dir('sub')], '/sub': makeFiles(1) }
    const spy = vi.fn(async (path: string, options?: { signal?: AbortSignal }) => {
      expect(options?.signal).toBe(controller.signal)
      return { content: dirMap[path] || [], total: 0, readme: '', write: false, provider: 'baidu' }
    })
    vi.spyOn(alistService, 'listFiles').mockImplementation(spy as never)

    await alistService.getAllFilesInDirectory('/', undefined, { signal: controller.signal })

    expect(spy).toHaveBeenCalledWith('/', { signal: controller.signal })
    expect(spy).toHaveBeenCalledWith('/sub', { signal: controller.signal })
  })

  it('onProgress 回调随文件累加被调用', async () => {
    const dirMap: Record<string, FileItem[]> = { '/': makeFiles(30) }
    vi.spyOn(alistService, 'listFiles').mockImplementation(buildSpy(dirMap) as never)
    const counts: number[] = []
    const result = await alistService.getAllFilesInDirectory('/', undefined, {
      onProgress: (c) => counts.push(c)
    })

    expect(result.files.length).toBe(30)
    expect(counts.length).toBeGreaterThan(0)
    expect(counts[counts.length - 1]).toBe(30)
  })
})
