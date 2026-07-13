import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoSyncService } from '../../../src/main/features/autoSync/auto-sync.core.service'

const { mockDb, snapshotRows, updateRuns, insertRuns } = vi.hoisted(() => {
  const snapshotRows: any[] = []
  const updateRuns: any[][] = []
  const insertRuns: any[][] = []

  const mockDb = {
    prepare: vi.fn((sql: string) => ({
      all: vi.fn((planId: number) => {
        if (sql.includes('FROM auto_sync_remote_snapshots')) {
          return snapshotRows.filter(row => row.plan_id === planId)
        }
        return []
      }),
      get: vi.fn(),
      run: vi.fn((...args: any[]) => {
        if (sql.includes('UPDATE auto_sync_remote_snapshots')) {
          updateRuns.push(args)
        }
        if (sql.includes('INSERT OR IGNORE INTO auto_sync_remote_snapshots')) {
          insertRuns.push(args)
        }
      })
    })),
    transaction: vi.fn((fn: () => void) => () => fn())
  }

  return { mockDb, snapshotRows, updateRuns, insertRuns }
})

vi.mock('../../../src/main/database', () => ({ getDatabase: vi.fn(() => mockDb) }))
vi.mock('../../../src/main/core/api/alist.service', () => ({ alistService: { listFiles: vi.fn() } }))
vi.mock('../../../src/main/features/shareTransfer/share-transfer.core.service', () => ({
  shareTransferService: { execTransfer: vi.fn() }
}))
vi.mock('../../../src/main/features/transfer/download-queue.manager', () => ({
  downloadQueueManager: { setCredentials: vi.fn(), addBatchToQueue: vi.fn() }
}))
vi.mock('../../../src/main/features/auth/auth.service', () => ({
  authService: { ensureValidSession: vi.fn() }
}))
vi.mock('../../../src/main/core/logger/logger.service', () => ({
  loggerService: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('fs', () => ({
  default: { mkdirSync: vi.fn(), accessSync: vi.fn(), constants: { W_OK: 2 } },
  mkdirSync: vi.fn(),
  accessSync: vi.fn(),
  constants: { W_OK: 2 }
}))

describe('AutoSyncService batching', () => {
  beforeEach(() => {
    snapshotRows.splice(0, snapshotRows.length)
    updateRuns.splice(0, updateRuns.length)
    insertRuns.splice(0, insertRuns.length)
    vi.clearAllMocks()
  })

  it('should update existing snapshot verification times in batches', async () => {
    const planId = 15
    // 使用 1801 条数据确保 SQLITE_BATCH_SIZE=900 时产生 3 个批次
    const remoteFiles = Array.from({ length: 1801 }, (_, index) => ({
      relativePath: `dir/file-${index}.txt`,
      remotePath: `/alist/dir/file-${index}.txt`,
      fileName: `file-${index}.txt`,
      fileSize: 1024,
      modified: ''
    }))
    snapshotRows.push(...remoteFiles.map((file, index) => ({
      id: index + 1,
      plan_id: planId,
      relative_path: file.relativePath,
      file_size: file.fileSize,
      first_seen_at: 1,
      last_verified_at: 1
    })))

    const service = new AutoSyncService()
    const result = await (service as any).diffFilesIncremental(planId, remoteFiles, 'C:\\Sync')

    expect(result).toEqual([])
    expect(updateRuns).toHaveLength(3)
    // 每个 batch 的 run() 参数：1 个时间戳 + N 个 ID
    expect(updateRuns.map(args => args.length)).toEqual([901, 901, 2])
  })

  it('should keep snapshot insert batches within the SQLite parameter budget', () => {
    const files = Array.from({ length: 181 }, (_, index) => ({
      relativePath: `dir/file-${index}.txt`,
      remotePath: `/alist/dir/file-${index}.txt`,
      fileName: `file-${index}.txt`,
      fileSize: 1024,
      modified: ''
    }))

    const service = new AutoSyncService()
    ;(service as any).insertSnapshotsBatch(15, files, 100)

    expect(insertRuns.map(args => args.length)).toEqual([900, 5])
    expect(insertRuns.every(args => args.length <= 900)).toBe(true)
  })
})
