import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
  // Upload state
  const uploadQueue = ref<UploadTask[]>([])
  const isUploading = ref<boolean>(false)
  const uploadError = ref<string | null>(null)
  const queueStatus = ref<QueueStatus>({ active: 0, pending: 0, maxConcurrent: 5 })

  // Download state
  const downloadQueue = ref<DownloadTask[]>([])
  const activeDownloads = ref<DownloadTask[]>([])
  const completedDownloads = ref<DownloadTask[]>([])
  const failedDownloads = ref<DownloadTask[]>([])
  const downloadQueueCounts = ref({
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0
  })
  const isDownloadQueuePaused = ref(false)

  // Common state
  const isProgressPanelCollapsed = ref<boolean>(
    localStorage.getItem('liuliu_progress_panel_collapsed') === 'true'
  )
  const isOnline = ref(navigator.onLine)

  // Upload getters
  const pendingUploads = computed(() =>
    uploadQueue.value.filter(t => t.status === 'pending')
  )

  const activeUploads = computed(() =>
    uploadQueue.value.filter(t => t.status === 'in_progress')
  )

  const completedUploads = computed(() =>
    uploadQueue.value.filter(t => t.status === 'completed')
  )

  // Download progress data（使用 Map 存储以便快速查找）
  const downloadProgressMap = ref<Map<string, {
    taskId: string
    fileName: string
    downloadedBytes: number
    totalBytes: number
    percentage: number
    speed: number
    eta: number
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    lastUpdate: number
  }>>(new Map())

  // Download getters
  const activeDownloadProgress = computed(() => {
    return Array.from(downloadProgressMap.value.values())
      .filter(p => p.status === 'in_progress')
      .sort((a, b) => b.lastUpdate - a.lastUpdate)
  })

  const totalDownloadSpeed = computed(() => {
    const progressArray = Array.from(downloadProgressMap.value.values())
    return progressArray
      .filter(p => p.status === 'in_progress')
      .reduce((sum, p) => sum + p.speed, 0)
  })

  const totalDownloadProgress = computed(() => {
    const progressArray = Array.from(downloadProgressMap.value.values())
    if (progressArray.length === 0) return 0

    const totalDownloaded = progressArray.reduce((sum, p) => sum + p.downloadedBytes, 0)
    const totalSize = progressArray.reduce((sum, p) => sum + p.totalBytes, 0)

    if (totalSize === 0) return 0
    return Math.round((totalDownloaded / totalSize) * 100)
  })

  // ===== Setters（供 composables 使用） =====

  function setUploadTasks(tasks: UploadTask[]) {
    uploadQueue.value = tasks
  }

  function updateUploadTaskProgress(taskId: string | number, progress: number) {
    const task = uploadQueue.value.find(t => t.id === taskId || String(t.id) === String(taskId))
    if (task) task.progress = progress
  }

  function updateUploadTaskStatus(taskId: string | number, status: UploadTask['status']) {
    const task = uploadQueue.value.find(t => t.id === taskId || String(t.id) === String(taskId))
    if (task) task.status = status
  }

  function removeUploadTask(taskId: string | number) {
    const index = uploadQueue.value.findIndex(t => t.id === taskId || String(t.id) === String(taskId))
    if (index !== -1) uploadQueue.value.splice(index, 1)
  }

  function setUploadQueueStatus(status: QueueStatus) {
    queueStatus.value = status
  }

  function setIsUploading(value: boolean) {
    isUploading.value = value
  }

  function setUploadError(error: string | null) {
    uploadError.value = error
  }

  function setDownloadQueue(tasks: DownloadTask[]) {
    downloadQueue.value = tasks
  }

  function setActiveDownloads(tasks: DownloadTask[]) {
    activeDownloads.value = tasks
  }

  function setCompletedDownloads(tasks: DownloadTask[]) {
    completedDownloads.value = tasks
  }

  function setFailedDownloads(tasks: DownloadTask[]) {
    failedDownloads.value = tasks
  }

  function setDownloadQueueCounts(counts: { pending: number; active: number; completed: number; failed: number }) {
    downloadQueueCounts.value = counts
  }

  function setDownloadQueuePaused(paused: boolean) {
    isDownloadQueuePaused.value = paused
  }

  function setDownloadProgressMap(map: Map<string, any>) {
    downloadProgressMap.value = map
  }

  function setIsOnline(online: boolean) {
    isOnline.value = online
  }

  function toggleProgressPanel() {
    isProgressPanelCollapsed.value = !isProgressPanelCollapsed.value
    localStorage.setItem('liuliu_progress_panel_collapsed', String(isProgressPanelCollapsed.value))
  }

  return {
    // Upload state
    uploadQueue,
    isUploading,
    uploadError,
    queueStatus,

    // Download state
    downloadQueue,
    activeDownloads,
    completedDownloads,
    failedDownloads,
    downloadQueueCounts,
    isDownloadQueuePaused,

    // Common state
    isProgressPanelCollapsed,
    isOnline,

    // Upload getters
    pendingUploads,
    activeUploads,
    completedUploads,

    // Download getters
    downloadProgressMap,
    activeDownloadProgress,
    totalDownloadSpeed,
    totalDownloadProgress,

    // Setters
    setUploadTasks,
    updateUploadTaskProgress,
    updateUploadTaskStatus,
    removeUploadTask,
    setUploadQueueStatus,
    setIsUploading,
    setUploadError,
    setDownloadQueue,
    setActiveDownloads,
    setCompletedDownloads,
    setFailedDownloads,
    setDownloadQueueCounts,
    setDownloadQueuePaused,
    setDownloadProgressMap,
    setIsOnline,
    toggleProgressPanel
  }
})
