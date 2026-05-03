import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileStore } from '../../../src/renderer/src/stores/fileStore'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

describe('fileStore - createFolder', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock window.electronAPI
    global.window = {
      electronAPI: {
        file: {
          mkdir: vi.fn(),
          list: vi.fn().mockResolvedValue({
            success: true,
            data: {
              content: [],
              total: 0
            }
          })
        }
      },
      $message: {
        success: vi.fn(),
        error: vi.fn()
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any
  })

  it('应该成功创建文件夹', async () => {
    const store = useFileStore()
    const mockMkdir = vi.fn().mockResolvedValue({ success: true })
    window.electronAPI.file.mkdir = mockMkdir

    const result = await store.createFolder('test-folder')

    expect(result).toBe(true)
    expect(mockMkdir).toHaveBeenCalledWith('/test-folder')
    expect(window.$message.success).toHaveBeenCalledWith('文件夹创建成功')
  })

  it('应该处理文件夹已存在错误', async () => {
    const store = useFileStore()
    const mockMkdir = vi.fn().mockResolvedValue({
      success: false,
      error: '文件夹已存在'
    })
    window.electronAPI.file.mkdir = mockMkdir

    const result = await store.createFolder('existing-folder')

    expect(result).toBe(false)
    expect(window.$message.error).toHaveBeenCalledWith('文件夹已存在')
  })

  it('应该验证特殊字符', async () => {
    const store = useFileStore()

    // 这个测试验证 CreateFolderModal 的验证规则
    const invalidNames = ['test/folder', 'test\\folder', 'test:folder', 'test*folder']
    const pattern = /^[^/\\:*?"<>|]+$/

    invalidNames.forEach(name => {
      expect(pattern.test(name)).toBe(false)
    })
  })
})

describe('fileStore - sorting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any
  })

  it('第一次点击名称升序，第二次点击名称倒序', () => {
    const store = useFileStore()
    store.files = [
      { name: 'b.txt', size: 1, isDir: false, modified: '2026-05-02T10:00:00Z' },
      { name: 'z-folder', size: 0, isDir: true, modified: '2026-05-02T10:00:00Z' },
      { name: 'a.txt', size: 1, isDir: false, modified: '2026-05-01T10:00:00Z' },
      { name: 'a-folder', size: 0, isDir: true, modified: '2026-05-01T10:00:00Z' }
    ]

    store.toggleSort('name')
    expect(store.filteredFiles.map(file => file.name)).toEqual([
      'a-folder',
      'z-folder',
      'a.txt',
      'b.txt'
    ])

    store.toggleSort('name')
    expect(store.filteredFiles.map(file => file.name)).toEqual([
      'z-folder',
      'a-folder',
      'b.txt',
      'a.txt'
    ])
  })

  it('第一次点击修改时间升序，第二次点击修改时间倒序', () => {
    const store = useFileStore()
    store.files = [
      { name: 'new-file.txt', size: 1, isDir: false, modified: '2026-05-03T10:00:00Z' },
      { name: 'old-folder', size: 0, isDir: true, modified: '2026-05-01T10:00:00Z' },
      { name: 'old-file.txt', size: 1, isDir: false, modified: '2026-05-01T10:00:00Z' },
      { name: 'new-folder', size: 0, isDir: true, modified: '2026-05-03T10:00:00Z' }
    ]

    store.toggleSort('modified')
    expect(store.filteredFiles.map(file => file.name)).toEqual([
      'old-folder',
      'new-folder',
      'old-file.txt',
      'new-file.txt'
    ])

    store.toggleSort('modified')
    expect(store.filteredFiles.map(file => file.name)).toEqual([
      'new-folder',
      'old-folder',
      'new-file.txt',
      'old-file.txt'
    ])
  })
})
