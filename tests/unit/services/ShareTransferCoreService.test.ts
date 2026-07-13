import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareTransferService } from '../../../src/main/features/shareTransfer/share-transfer.core.service'

const { fakeDb } = vi.hoisted(() => {
  const fakeDb = {
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: vi.fn()
      }))
    })),
    transaction: vi.fn((fn: () => void) => () => fn())
  }

  return { fakeDb }
})

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
vi.mock('../../../src/main/database', () => ({ getDatabase: vi.fn(() => fakeDb) }))
vi.mock('../../../src/main/config', () => ({
  loadConfig: vi.fn(() => ({ ambApiBaseUrl: 'https://test-api.example.com', ambTransferToken: 'token' }))
}))
vi.mock('../../../src/main/core/logger/logger.service', () => ({
  loggerService: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))
vi.mock('drizzle-orm/better-sqlite3', () => ({ drizzle: vi.fn(() => fakeDb) }))
vi.mock('drizzle-orm', () => ({
  count: vi.fn(() => ({ type: 'count' })),
  desc: vi.fn((field) => field),
  eq: vi.fn((field, value) => ({ type: 'eq', field: field?.name || field?.config?.name, value })),
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  inArray: vi.fn((field, values) => ({ type: 'inArray', field: field?.name || field?.config?.name, values }))
}))

describe('ShareTransferService batching', () => {
  beforeEach(() => {
    ;(ShareTransferService as any).instance = null
    vi.clearAllMocks()
  })

  it('should delete large record id lists in batches', async () => {
    const service = ShareTransferService.getInstance()
    // 使用 1801 条数据确保 SQLITE_BATCH_SIZE=900 时产生 3 个批次
    const ids = Array.from({ length: 1801 }, (_, index) => index + 1)

    const result = await service.deleteRecords(ids, 7)

    expect(result).toBe(true)
    expect(fakeDb.delete).toHaveBeenCalledTimes(3)
  })
})
