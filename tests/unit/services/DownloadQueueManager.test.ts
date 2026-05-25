import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockTransferServiceMethods,
  mockGetDownloadUrl,
  mockExistsSync,
  mockUnlinkSync,
  mockDownloadManagerStartDownload,
  mockCancelDownload,
  mockAbortAllActive,
  mockGetDefaultDownloadPath
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
  mockGetDefaultDownloadPath: vi.fn(() => 'C:\\Downloads')
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

import { downloadQueueManager } from '../../../src/main/features/transfer/download-queue.manager'

describe('DownloadQueueManager - 云端文件不存在时的处理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(downloadQueueManager as any).queue.clear()
    ;(downloadQueueManager as any).activeDownloads.clear()
    ;(downloadQueueManager as any).authFailedNotified = false
    downloadQueueManager.setCredentials(1, 'fake-token')
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
})
