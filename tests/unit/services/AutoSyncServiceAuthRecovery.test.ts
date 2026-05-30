import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoSyncService } from '../../../src/main/features/autoSync/auto-sync.core.service'

const {
  mockDb,
  mockAlistService,
  mockShareTransferService,
  mockDownloadQueueManager,
  mockEnsureValidSession
} = vi.hoisted(() => {
  const runs: any[] = []
  const plans = new Map<number, any>([[
    1,
    {
      id: 1,
      user_id: 7,
      name: '同步计划',
      share_url: 'https://pan.baidu.com/s/abc',
      share_code: 'abc',
      local_sync_dir: 'C:\\Sync',
      last_alist_path: null,
      status: 'enabled',
      expires_at: Date.now() + 86_400_000,
      auto_run_on_startup: 1,
      conflict_policy: 'skip_existing',
      last_sync_at: null,
      last_success_at: null,
      last_error_message: null,
      created_at: Date.now(),
      updated_at: Date.now()
    }
  ]])

  return {
    mockDb: {
      prepare: vi.fn((sql: string) => ({
        get: vi.fn((...args: any[]) => {
          if (sql.includes('SELECT * FROM auto_sync_plans')) return plans.get(args[0])
          if (sql.includes('INSERT INTO auto_sync_runs') && sql.includes('RETURNING id')) {
            const row = { id: runs.length + 1, plan_id: args[0], user_id: args[1], trigger_type: args[2], status: 'running', started_at: Date.now(), finished_at: null }
            runs.push(row)
            return { id: row.id }
          }
          if (sql.includes('SELECT * FROM auto_sync_runs')) return runs.find(r => r.id === args[0])
          return undefined
        }),
        all: vi.fn(() => []),
        run: vi.fn((...args: any[]) => {
          if (sql.includes('UPDATE auto_sync_runs')) {
            const run = runs.find(r => r.id === args[9])
            if (run) {
              run.status = args[0]
              run.error_message = args[8]
              run.finished_at = args[9]
            }
          }
        })
      }))
    },
    mockAlistService: {
      listFiles: vi.fn()
    },
    mockShareTransferService: {
      execTransfer: vi.fn()
    },
    mockDownloadQueueManager: {
      setCredentials: vi.fn(),
      addBatchToQueue: vi.fn()
    },
    mockEnsureValidSession: vi.fn()
  }
})

vi.mock('../../../src/main/database', () => ({ getDatabase: vi.fn(() => mockDb) }))
vi.mock('../../../src/main/core/api/alist.service', () => ({ alistService: mockAlistService }))
vi.mock('../../../src/main/features/shareTransfer/share-transfer.core.service', () => ({ shareTransferService: mockShareTransferService }))
vi.mock('../../../src/main/features/transfer/download-queue.manager', () => ({ downloadQueueManager: mockDownloadQueueManager }))
vi.mock('../../../src/main/features/auth/auth.service', () => ({ authService: { ensureValidSession: mockEnsureValidSession } }))
vi.mock('../../../src/main/core/logger/logger.service', () => ({ loggerService: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('fs', () => ({ default: { mkdirSync: vi.fn(), accessSync: vi.fn(), constants: { W_OK: 2 } }, mkdirSync: vi.fn(), accessSync: vi.fn(), constants: { W_OK: 2 } }))

describe('AutoSyncService auth recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureValidSession.mockResolvedValue({ userId: 7, username: 'alice', token: 'valid-token', basePath: '/alist/' })
    mockShareTransferService.execTransfer.mockResolvedValue({
      success: true,
      alistPath: 'https://alist.local/d/%E5%88%86%E4%BA%AB'
    })
  })

  it('远程扫描认证失败且 session 恢复失败时，run 为 failed 且不发送空扫描完成', async () => {
    const service = AutoSyncService.getInstance()
    const progress: any[] = []
    service.setProgressCallback((_planId, event) => progress.push(event))

    mockAlistService.listFiles.mockRejectedValue({ code: 'ALIST_401', message: 'token is expired' })
    mockEnsureValidSession
      .mockResolvedValueOnce({ userId: 7, username: 'alice', token: 'old-token', basePath: '/alist/' })
      .mockResolvedValueOnce(null)

    const result = await service.runPlan(1, { userId: 7, username: 'alice', token: 'old-token' }, 'manual')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Alist 登录已过期，请重新登录后重试同步')
    expect(progress.some(e => e.stage === 'scan' && e.status === 'completed' && e.message.includes('扫描完成，共 0 个文件'))).toBe(false)
    expect(progress.some(e => e.stage === 'complete' && e.status === 'failed' && e.message === 'Alist 登录已过期，请重新登录后重试同步')).toBe(true)
  })

  it('远程扫描认证失败但 session 恢复成功时，重试扫描一次', async () => {
    const service = AutoSyncService.getInstance()
    mockEnsureValidSession
      .mockResolvedValueOnce({ userId: 7, username: 'alice', token: 'old-token', basePath: '/alist/' })
      .mockResolvedValueOnce({ userId: 7, username: 'alice', token: 'new-token', basePath: '/alist/' })
    mockAlistService.listFiles
      .mockRejectedValueOnce({ code: 'ALIST_401', message: 'token is expired' })
      .mockResolvedValueOnce({ content: [], total: 0, readme: '', write: false, provider: 'mock' })
    mockDownloadQueueManager.addBatchToQueue.mockResolvedValue([])

    const result = await service.runPlan(1, { userId: 7, username: 'alice', token: 'old-token' }, 'manual')

    expect(mockAlistService.listFiles).toHaveBeenCalledTimes(2)
    expect(result.message).toBe('同步完成，没有新增文件')
  })
})
