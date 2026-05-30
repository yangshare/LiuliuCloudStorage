import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueueService } from '../../../src/main/features/transfer/queue.service'

const { mockEnsureValidSession, mockRestoreQueue, mockAddToQueue } = vi.hoisted(() => ({
  mockEnsureValidSession: vi.fn(),
  mockRestoreQueue: vi.fn(),
  mockAddToQueue: vi.fn()
}))

vi.mock('../../../src/main/features/auth/auth.service', () => ({
  authService: {
    ensureValidSession: mockEnsureValidSession
  }
}))

vi.mock('../../../src/main/features/transfer/download-queue.manager', () => ({
  downloadQueueManager: {
    setCredentials: vi.fn(),
    restoreQueue: mockRestoreQueue,
    addToQueue: mockAddToQueue,
    addBatchToQueue: vi.fn(async () => []),
    getQueueState: vi.fn(),
    pauseQueue: vi.fn(),
    resumeQueue: vi.fn(),
    clearQueue: vi.fn(),
    clearPendingQueue: vi.fn(),
    clearActiveQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    getStatus: vi.fn()
  }
}))

vi.mock('../../../src/main/features/transfer/transfer-queue.manager', () => ({
  transferQueueManager: {
    addTask: vi.fn(),
    getStatus: vi.fn(),
    cancelTask: vi.fn(),
    autoRetryAll: vi.fn()
  }
}))

vi.mock('../../../src/main/core/logger/logger.service', () => ({
  loggerService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

describe('QueueService download session authority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureValidSession.mockResolvedValue({
      userId: 42,
      username: 'alice',
      token: 'authoritative-token',
      basePath: '/alist/'
    })
  })

  it('恢复下载队列时忽略 renderer 传入 token，使用 AuthService token', async () => {
    const service = new QueueService()

    await service.restoreDownloadQueue(1, 'stale-renderer-token')

    expect(mockRestoreQueue).toHaveBeenCalledWith(42, 'authoritative-token')
  })

  it('排队下载时使用 AuthService session', async () => {
    mockAddToQueue.mockResolvedValue(101)
    const service = new QueueService()

    const result = await service.queueDownloadWithSession({
      id: 'download_1',
      fileName: 'a.zip',
      fileSize: 0,
      remotePath: '/a.zip',
      priority: 0
    })

    expect(mockAddToQueue).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      userToken: 'authoritative-token'
    }))
    expect(result).toEqual({ taskId: 'download_1', dbId: 101 })
  })
})