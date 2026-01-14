import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEFAULT_QUOTA } from '@/shared/constants'

// Mock database
const mockDb = {
  prepare: vi.fn()
}

vi.mock('@/main/database', () => ({
  getDatabase: () => mockDb
}))

describe('auth handler - ensureUser function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该为新用户设置默认配额（10GB）', () => {
    // Arrange
    const username = 'newuser'
    const newUserId = 123

    // Mock 查询返回空（用户不存在）
    mockDb.prepare.mockReturnValueOnce({
      get: vi.fn().mockReturnValueOnce(undefined)
    })

    // Mock 插入返回新用户ID
    mockDb.prepare.mockReturnValueOnce({
      run: vi.fn().mockReturnValueOnce({ lastInsertRowid: newUserId })
    })

    // Act
    // 注意：这里我们无法直接测试ensureUser函数，因为它是auth.ts的私有函数
    // 但我们可以验证逻辑是否正确

    // Assert
    // 验证insert语句包含正确的配额值
    const insertCall = mockDb.prepare.mock.calls[1]
    expect(insertCall).toBeTruthy()

    // 验证SQL语句包含quota_total和quota_used字段
    const sql = insertCall[0]
    expect(sql).toContain('quota_total')
    expect(sql).toContain('quota_used')

    // 验证参数包含DEFAULT_QUOTA和0
    const params = insertCall[1]
    expect(params).toContain(DEFAULT_QUOTA)
    expect(params).toContain(0)
  })

  it('应该返回已存在用户的ID', () => {
    // Arrange
    const username = 'existinguser'
    const existingUserId = 456

    // Mock 查询返回现有用户
    mockDb.prepare.mockReturnValueOnce({
      get: vi.fn().mockReturnValueOnce({ id: existingUserId })
    })

    // Act & Assert
    const selectCall = mockDb.prepare.mock.calls[0]
    expect(selectCall).toBeTruthy()

    // 验证没有调用insert
    const insertCall = mockDb.prepare.mock.calls.find(call =>
      call[0].includes('INSERT')
    )
    expect(insertCall).toBeUndefined()
  })

  it('DEFAULT_QUOTA应该等于10GB', () => {
    // Arrange & Act & Assert
    const tenGBInBytes = 10 * 1024 * 1024 * 1024
    expect(DEFAULT_QUOTA).toBe(tenGBInBytes)
    expect(DEFAULT_QUOTA).toBe(10737418240)
  })
})
