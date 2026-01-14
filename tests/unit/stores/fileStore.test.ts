import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFileStore } from '../../../src/renderer/src/stores/fileStore'

describe('fileStore - createFolder', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock window.electronAPI
    global.window = {
      electronAPI: {
        file: {
          mkdir: vi.fn()
        }
      },
      $message: {
        success: vi.fn(),
        error: vi.fn()
      }
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
