import { defineStore } from 'pinia'
import { useTransferUpload } from '../composables/useTransferUpload'
import { useTransferDownload } from '../composables/useTransferDownload'
import { useTransferCommon } from '../composables/useTransferCommon'

// ==================== 类型定义 ====================

export interface UploadTask {
  id: string | number
  fileName: string
  filePath: string
  fileSize: number
  transferredSize: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  progress: number
  error?: string
  createdAt: Date
  targetPath: string
  uploadSpeed: number  // 字节/秒
  estimatedTime: number  // 剩余秒数
  lastUpdateTime: number  // 上次更新时间戳
  lastTransferredSize: number  // 上次传输大小
  resumable: boolean  // 是否支持断点续传
}

export interface DownloadTask {
  id: string
  fileName: string
  remotePath: string
  savePath: string
  fileSize: number
  downloadedBytes: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number
  speed: number  // 字节/秒
  error?: string
  createdAt: Date
}

export interface QueueStatus {
  active: number
  pending: number
  maxConcurrent: number
}

// ==================== Store 定义 ====================

export const useTransferStore = defineStore('transfer', () => {
  // 组合三个 feature-based composables
  const upload = useTransferUpload()
  const download = useTransferDownload()
  const common = useTransferCommon()

  // 清理函数：调用所有 composable 的 cleanup
  function cleanup() {
    upload.cleanupUpload()
    download.cleanupDownload()
    common.cleanupCommon()
  }

  return {
    // Upload state
    uploadQueue: upload.uploadQueue,
    isUploading: upload.isUploading,
    uploadError: upload.uploadError,
    queueStatus: upload.queueStatus,

    // Download state
    downloadQueue: download.downloadQueue,
    activeDownloads: download.activeDownloads,
    completedDownloads: download.completedDownloads,
    failedDownloads: download.failedDownloads,
    downloadQueueCounts: download.downloadQueueCounts,
    isDownloadQueuePaused: download.isDownloadQueuePaused,

    // Common state
    isProgressPanelCollapsed: common.isProgressPanelCollapsed,
    isOnline: common.isOnline,

    // Upload getters
    pendingUploads: upload.pendingUploads,
    activeUploads: upload.activeUploads,
    completedUploads: upload.completedUploads,

    // Download getters
    downloadProgressMap: download.downloadProgressMap,
    activeDownloadProgress: download.activeDownloadProgress,
    totalDownloadSpeed: download.totalDownloadSpeed,
    totalDownloadProgress: download.totalDownloadProgress,

    // Upload actions
    addToUploadQueue: upload.addToUploadQueue,
    addPathsToUploadQueue: upload.addPathsToUploadQueue,
    removeFromQueue: upload.removeFromQueue,
    clearCompleted: upload.clearCompleted,
    startUpload: upload.startUpload,
    processQueue: upload.processQueue,
    fetchQueueStatus: upload.fetchQueueStatus,
    resumeUpload: upload.resumeUpload,
    autoRetryFailedTasks: upload.autoRetryFailedTasks,

    // Download actions
    initDownloadQueue: download.initDownloadQueue,
    queueDownload: download.queueDownload,
    batchQueueDownload: download.batchQueueDownload,
    pauseDownloadQueue: download.pauseDownloadQueue,
    resumeDownloadQueue: download.resumeDownloadQueue,
    clearDownloadQueue: download.clearDownloadQueue,
    clearPendingQueue: download.clearPendingQueue,
    clearActiveQueue: download.clearActiveQueue,
    fetchDownloadQueueState: download.fetchDownloadQueueState,
    downloadWithSaveAs: download.downloadWithSaveAs,
    resumeDownload: download.resumeDownload,
    cancelDownload: download.cancelDownload,
    cancelAllDownloads: download.cancelAllDownloads,

    // Common actions
    toggleProgressPanel: common.toggleProgressPanel,

    // Cleanup
    cleanup
  }
})
