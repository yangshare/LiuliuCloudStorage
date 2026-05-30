import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockTransferServiceMethods,
  mockGetDownloadUrl,
  mockExistsSync,
  mockUnlinkSync,
  mockDownloadManagerStartDownload,
  mockCancelDownload,
  mockAbortAllActive,
  mockGetDefaultDownloadPath,
  mockEnsureValidSession
} = vi.hoisted(() => ({
  mockTransferServiceMethods: {
    create: vi.fn(),
    createBatch: vi.fn(),
    markAsFailed: vi.fn(),
    updateStatus: vi.fn(),
    updateProgress: vi.fn(),
    updateFilePath: vi.fn(),
    updateFileSize: vi.fn(),
    getTaskById: vi.fn(),
    getTaskByRemotePath: vi.fn(),
    getTasksByRemotePaths: vi.fn(async () => new Map()),
    getIncompleteDownloads: vi.fn(async () => []),
    getRecentCompletedTasks: vi.fn(async () => []),
    getRecentFailedTasks: vi.fn(async () => []),
    getTaskCount: vi.fn(async () => 0),
    cancelAllIncompleteDownloads: vi.fn(),
    deleteCompletedDownloads: vi.fn(),
    deleteFailedDownloads: vi.fn()
  },
  mockGetDownloadUrl: vi.fn(),
  mockExistsSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockDownloadManagerStartDownload: vi.fn(),
  mockCancelDownload: vi.fn(),
  mockAbortAllActive: vi.fn(),
  mockGetDefaultDownloadPath: vi.fn(() => 'C:\\Downloads'),
  mockEnsureValidSession: vi.fn()
}))

vi.mock('../../../src/main/features/transfer/transfer.service', () => ({
  TransferService: vi.fn(function () { return mockTransferServiceMethods })
}))

vi.mock('../../../src/main/features/transfer/download.manager', () => ({
  DownloadManager: vi.fn(function () {
    return {
      startDownload: mockDownloadManagerStartDownload,
      cancelDownload: mockCancelDownload,
      abortAllActive: mockAbortAllActive,
      getDefaultDownloadPath: mockGetDefaultDownloadPath
    }
  })
}))

vi.mock('../../../src/main/core/api/alist.service', () => ({
  alistService: {
    setToken: vi.fn(),
    setBasePath: vi.fn(),
    setUserId: vi.fn(),
    getDownloadUrl: mockGetDownloadUrl
  }
}))

vi.mock('../../../src/main/features/activity/activity.core.service', () => ({
  activityService: {
    logActivity: vi.fn().mockResolvedValue(undefined)
  },
  ActionType: { DOWNLOAD: 'download' }
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
    unlinkSync: mockUnlinkSync
  },
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

vi.mock('../../../src/main/features/auth/auth.service', () => ({
  authService: {
    ensureValidSession: mockEnsureValidSession
  }
}))

import { downloadQueueManager } from '../../../src/main/features/transfer/download-queue.manager'

describe('DownloadQueueManager - 云端文件不存在时的处理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(downloadQueueManager as any).queue.clear()
    ;(downloadQueueManager as any).activeDownloads.clear()
    ;(downloadQueueManager as any).authFailedNotified = false
    downloadQueueManager.setCredentials(1, 'fake-token')
    mockEnsureValidSession.mockResolvedValue({ userId: 1, username: 'alice', token: 'fake-token', basePath: '/alist/' })
  })

  it('当 getDownloadUrl 失败时应将数据库状态更新为 failed', async () => {
    mockGetDownloadUrl.mockResolvedValue({
      success: false,
      error: 'Alist错误(500): object not found'
    })
    mockExistsSync.mockReturnValue(false)

    const task = {
      id: 'download_1',
      fileName: 'lost-file.zip',
      fileSize: 1024,
      userId: 1,
      userToken: 'fake-token',
      remotePath: '/cloud/lost-file.zip',
      priority: 0,
      dbId: 101
    }

    ;(downloadQueueManager as any).activeDownloads.set(task.id, task)
    await (downloadQueueManager as any).startDownload(task)

    expect(mockTransferServiceMethods.markAsFailed).toHaveBeenCalledWith(
      101,
      expect.stringContaining('object not found'),
      0
    )
  })

  it('当 getDownloadUrl 失败且存在本地残留文件时应清理该文件', async () => {
    mockGetDownloadUrl.mockResolvedValue({
      success: false,
      error: 'Alist错误(500): object not found'
    })
    mockExistsSync.mockReturnValue(true)

    const task = {
      id: 'download_2',
      fileName: 'partial-file.zip',
      fileSize: 2048,
      savePath: 'C:\\Downloads\\partial-file.zip',
      userId: 1,
      userToken: 'fake-token',
      remotePath: '/cloud/partial-file.zip',
      priority: 0,
      dbId: 102
    }

    ;(downloadQueueManager as any).activeDownloads.set(task.id, task)
    await (downloadQueueManager as any).startDownload(task)

    expect(mockUnlinkSync).toHaveBeenCalledWith('C:\\Downloads\\partial-file.zip')
  })

  it('当 getDownloadUrl 失败且本地无残留文件时不应调用 unlinkSync', async () => {
    mockGetDownloadUrl.mockResolvedValue({
      success: false,
      error: 'Alist错误(500): object not found'
    })
    mockExistsSync.mockReturnValue(false)

    const task = {
      id: 'download_3',
      fileName: 'no-local-file.zip',
      fileSize: 4096,
      savePath: 'C:\\Downloads\\no-local-file.zip',
      userId: 1,
      userToken: 'fake-token',
      remotePath: '/cloud/no-local-file.zip',
      priority: 0,
      dbId: 103
    }

    ;(downloadQueueManager as any).activeDownloads.set(task.id, task)
    await (downloadQueueManager as any).startDownload(task)

    expect(mockUnlinkSync).not.toHaveBeenCalled()
    expect(mockTransferServiceMethods.markAsFailed).toHaveBeenCalledWith(
      103,
      expect.stringContaining('object not found'),
      0
    )
  })

  it('getDownloadUrl 返回认证失败时暂停队列并只发送 auth-failed，不标记 failed', async () => {
    const sent: Array<{ channel: string; payload: any }> = []
    const { BrowserWindow } = await import('electron')
    ;(BrowserWindow.getAllWindows as any).mockReturnValue([{
      isDestroyed: () => false,
      webContents: {
        send: (channel: string, payload: any) => sent.push({ channel, payload })
      }
    }])

    mockEnsureValidSession
      .mockResolvedValueOnce({ userId: 1, username: 'alice', token: 'old-token', basePath: '/alist/' })
      .mockResolvedValueOnce(null)
    mockGetDownloadUrl.mockResolvedValue({ success: false, error: 'Alist错误(401): token is expired' })

    const task = {
      id: 'download_auth_1',
      fileName: 'expired.zip',
      fileSize: 1024,
      userId: 1,
      userToken: 'old-token',
      remotePath: '/expired.zip',
      priority: 0,
      dbId: 201
    }

    ;(downloadQueueManager as any).activeDownloads.set(task.id, task)
    await (downloadQueueManager as any).startDownload(task)

    expect((downloadQueueManager as any).maxConcurrent).toBe(0)
    expect(mockTransferServiceMethods.markAsFailed).not.toHaveBeenCalled()
    expect(sent.some(e => e.channel === 'transfer:download:auth-failed')).toBe(true)
    expect(sent.some(e => e.channel === 'transfer:download:failed')).toBe(false)
  })

  it('session 恢复成功时使用新 token 重试当前任务一次', async () => {
    mockEnsureValidSession
      .mockResolvedValueOnce({ userId: 1, username: 'alice', token: 'old-token', basePath: '/alist/' })
      .mockResolvedValueOnce({ userId: 1, username: 'alice', token: 'new-token', basePath: '/alist/' })
    mockGetDownloadUrl
      .mockResolvedValueOnce({ success: false, error: 'Alist错误(401): token is expired' })
      .mockResolvedValueOnce({ success: true, rawUrl: 'https://download/a.zip', fileSize: 1024 })
    mockDownloadManagerStartDownload.mockResolvedValue('C:\\Downloads\\a.zip')

    const task = {
      id: 'download_retry_1',
      fileName: 'a.zip',
      fileSize: 1024,
      userId: 1,
      userToken: 'old-token',
      remotePath: '/a.zip',
      priority: 0,
      dbId: 202
    }

    ;(downloadQueueManager as any).activeDownloads.set(task.id, task)
    await (downloadQueueManager as any).startDownload(task)

    expect(mockGetDownloadUrl).toHaveBeenCalledTimes(2)
    expect(mockDownloadManagerStartDownload).toHaveBeenCalledTimes(1)
    expect(mockTransferServiceMethods.markAsFailed).not.toHaveBeenCalled()
  })
})
