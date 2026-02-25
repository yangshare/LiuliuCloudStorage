import { defineStore } from 'pinia'
import { ref, computed, h } from 'vue'
import { throttle } from 'lodash-es'
import { useQuotaStore } from './quotaStore'

// ==================== 常量定义 ====================

const NOTIFICATIONS_STORAGE_KEY = 'liuliu_notifications_enabled'

function isNotificationsEnabled(): boolean {
  return localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) !== 'false'
}

/**
 * 进度更新节流间隔（毫秒）
 * 用于限制下载/上传进度更新频率，避免 UI 过于频繁刷新
 */
const PROGRESS_UPDATE_THROTTLE_MS = 1000

/**
 * 已完成任务进度数据清理延迟（毫秒）
 * 任务完成后延迟清理进度数据，让用户看到完成状态
 */
const COMPLETED_TASK_CLEANUP_DELAY_MS = 5000

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

export const useTransferStore = defineStore('transfer', () => {
  // State
  const uploadQueue = ref<UploadTask[]>([])
  const downloadQueue = ref<DownloadTask[]>([])
  const isUploading = ref<boolean>(false)
  const uploadError = ref<string | null>(null)
  const queueStatus = ref<QueueStatus>({ active: 0, pending: 0, maxConcurrent: 5 })

  // 批量通知状态
  const pendingUploadNotifications = ref<string[]>([])
  let uploadNotifyTimer: ReturnType<typeof setTimeout> | null = null
  const pendingDownloadNotifications = ref<Array<{ fileName: string; savePath: string }>>([])
  let downloadNotifyTimer: ReturnType<typeof setTimeout> | null = null
  const pendingDownloadFailNotifications = ref<string[]>([])
  let downloadFailNotifyTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleDownloadNotification() {
    if (downloadNotifyTimer) clearTimeout(downloadNotifyTimer)
    // 队列中还有活跃或等待中的任务时，延长等待
    const hasRemaining = activeDownloads.value.length > 0 || downloadQueue.value.length > 0
    if (!hasRemaining) {
      flushDownloadNotifications()
      return
    }
    downloadNotifyTimer = setTimeout(() => {
      if (activeDownloads.value.length > 0 || downloadQueue.value.length > 0) {
        scheduleDownloadNotification()
        return
      }
      flushDownloadNotifications()
    }, 3000)
  }

  function flushUploadNotifications() {
    const files = pendingUploadNotifications.value.splice(0)
    if (files.length === 0 || !isNotificationsEnabled()) return
    const title = '上传完成'
    const content = files.length === 1
      ? `文件 "${files[0]}" 已成功上传`
      : `${files.length} 个文件上传完成`
    window.$notification?.success({ title, content, duration: 4000 })
    window.electronAPI?.notification?.show({ title: '溜溜网盘', body: content })
  }

  function flushDownloadNotifications() {
    const files = pendingDownloadNotifications.value.splice(0)
    if (files.length === 0 || !isNotificationsEnabled()) return
    const title = '下载完成'
    if (files.length === 1) {
      const { fileName, savePath } = files[0]
      window.$notification?.success({
        title,
        content: `文件 "${fileName}" 已成功下载`,
        duration: 5000,
        action: () => h(
          'button',
          {
            onClick: async () => {
              try {
                const result = await window.electronAPI?.downloadConfig.openFileDirectory(savePath)
                if (!result?.success) window.$message?.error(result?.error || '无法打开目录')
              } catch (error: any) {
                window.$message?.error('打开目录失败: ' + error.message)
              }
            },
            style: {
              padding: '4px 12px',
              backgroundColor: '#18a058',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }
          },
          '打开文件夹'
        )
      })
    } else {
      const content = `${files.length} 个文件下载完成`
      const dirs = files.map(f => (f.savePath || '').replace(/[\\/][^\\/]+$/, '').replace(/\\/g, '/'))
      const validDirs = dirs.filter(d => d.length > 0)
      const commonDir = validDirs.length > 0
        ? validDirs.reduce((a, b) => {
            const pa = a.split('/'), pb = b.split('/')
            const common: string[] = []
            for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
              if (pa[i] === pb[i]) common.push(pa[i])
              else break
            }
            return common.join('/')
          })
        : ''
      const lastSavePath = (commonDir || validDirs[0] || '').replace(/\//g, '\\')
      window.$notification?.success({
        title,
        content,
        duration: 5000,
        action: () => h(
          'button',
          {
            onClick: async () => {
              try {
                const result = await window.electronAPI?.downloadConfig.openFileDirectory(lastSavePath)
                if (!result?.success) window.$message?.error(result?.error || '无法打开目录')
              } catch (error: any) {
                window.$message?.error('打开目录失败: ' + error.message)
              }
            },
            style: {
              padding: '4px 12px',
              backgroundColor: '#18a058',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }
          },
          '打开文件夹'
        )
      })
    }
    window.electronAPI?.notification?.show({ title: '溜溜网盘', body: `${files.length} 个文件下载完成` })
  }

  function flushDownloadFailNotifications() {
    const files = pendingDownloadFailNotifications.value.splice(0)
    if (files.length === 0 || !isNotificationsEnabled()) return
    const title = '下载失败'
    const content = files.length === 1
      ? `文件 "${files[0]}" 下载失败`
      : `${files.length} 个文件下载失败`
    window.$notification?.error({ title, content, duration: 5000 })
    window.electronAPI?.notification?.show({ title, body: content })
  }

  // Getters
  const pendingUploads = computed(() =>
    uploadQueue.value.filter(t => t.status === 'pending')
  )

  const activeUploads = computed(() =>
    uploadQueue.value.filter(t => t.status === 'in_progress')
  )

  const completedUploads = computed(() =>
    uploadQueue.value.filter(t => t.status === 'completed')
  )

  // Actions
  function addToUploadQueue(files: File[], targetPath: string = '/') {
    const tasks: UploadTask[] = files.map(file => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      filePath: (file as any).path || file.name,
      fileSize: file.size,
      transferredSize: 0,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      targetPath,
      uploadSpeed: 0,
      estimatedTime: 0,
      lastUpdateTime: Date.now(),
      lastTransferredSize: 0,
      resumable: true  // 所有上传任务默认支持断点续传
    }))

    uploadQueue.value.push(...tasks)
  }

  function addPathsToUploadQueue(paths: string[], targetPath: string = '/') {
    const tasks: UploadTask[] = paths.map(filePath => ({
      id: crypto.randomUUID(),
      fileName: filePath.split(/[\\/]/).pop() || filePath,
      filePath,
      fileSize: 0,
      transferredSize: 0,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      targetPath,
      uploadSpeed: 0,
      estimatedTime: 0,
      lastUpdateTime: Date.now(),
      lastTransferredSize: 0,
      resumable: true  // 所有上传任务默认支持断点续传
    }))
    uploadQueue.value.push(...tasks)
  }

  function removeFromQueue(taskId: string | number) {
    const index = uploadQueue.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      uploadQueue.value.splice(index, 1)
    }
  }

  function clearCompleted() {
    uploadQueue.value = uploadQueue.value.filter(t => t.status !== 'completed')
  }

  async function startUpload(taskId: string, userId: number, userToken: string, username: string) {
    const task = uploadQueue.value.find(t => t.id === taskId)
    if (!task) return

    task.status = 'pending'
    uploadError.value = null

    try {
      // 使用队列管理器而不是直接上传
      await window.electronAPI.transfer.addToQueue({
        id: typeof task.id === 'number' ? task.id : parseInt(task.id as string) || 0,
        filePath: task.filePath,
        remotePath: task.targetPath,
        userId,
        userToken,
        username,
        fileName: task.fileName,
        fileSize: task.fileSize
      })
    } catch (error: any) {
      task.status = 'failed'
      task.error = error.message || '添加到队列失败'
      uploadError.value = error.message || '添加到队列失败'
    }
  }

  // 批量处理队列（使用队列管理器）
  async function processQueue(userId: number, userToken: string, username: string) {
    const pending = pendingUploads.value
    for (const task of pending) {
      await startUpload(task.id as string, userId, userToken, username)
    }
  }

  // 获取队列状态
  async function fetchQueueStatus() {
    if (window.electronAPI?.transfer?.getQueueStatus) {
      queueStatus.value = await window.electronAPI.transfer.getQueueStatus()
    }
  }

  // 进度更新处理函数
  const progressHandler = (data: { taskId: string | number, progress: number, transferredSize?: number }) => {
    const task = uploadQueue.value.find(t => t.id === data.taskId || String(t.id) === String(data.taskId))
    if (!task) return

    const now = Date.now()
    const timeDiff = (now - task.lastUpdateTime) / 1000  // 秒

    // 节流：最多每秒更新一次
    if (timeDiff < 1) return

    // 使用传入的 transferredSize 或根据进度计算
    const newTransferredSize = data.transferredSize ?? Math.floor((task.fileSize * data.progress) / 100)
    const sizeDiff = newTransferredSize - task.lastTransferredSize

    // 计算上传速度（避免除以0和负值）
    if (timeDiff > 0 && sizeDiff >= 0) {
      task.uploadSpeed = sizeDiff / timeDiff
    }

    // 计算剩余时间
    const remainingSize = task.fileSize - newTransferredSize
    if (task.uploadSpeed > 0) {
      task.estimatedTime = remainingSize / task.uploadSpeed
    } else {
      task.estimatedTime = 0
    }

    // 更新进度
    task.progress = data.progress
    task.transferredSize = newTransferredSize
    task.lastUpdateTime = now
    task.lastTransferredSize = newTransferredSize
  }

  // 注册进度监听器
  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onProgress) {
    window.electronAPI.transfer.onProgress(progressHandler)
  }

  // 任务完成处理函数
  const completedHandler = (data: { taskId: string | number, fileName: string }) => {
    const task = uploadQueue.value.find(t => t.id === data.taskId || String(t.id) === String(data.taskId))
    if (task) {
      task.status = 'completed'
      task.progress = 100
      task.transferredSize = task.fileSize

      // 计算并更新配额（Story 6.2）
      const quotaStore = useQuotaStore()
      quotaStore.calculateQuota()

      // 批量合并上传完成通知
      pendingUploadNotifications.value.push(data.fileName)
      if (uploadNotifyTimer) clearTimeout(uploadNotifyTimer)
      uploadNotifyTimer = setTimeout(flushUploadNotifications, 1500)
    }
  }

  // 任务失败处理函数
  const failedHandler = (data: { taskId: string | number, fileName: string, error: string }) => {
    const task = uploadQueue.value.find(t => t.id === data.taskId || String(t.id) === String(data.taskId))
    if (task) {
      task.status = 'failed'
      task.error = data.error
      task.resumable = true  // 失败任务可恢复

      // 显示应用内失败通知（失败通知不合并，让用户知道哪个失败）
      if (isNotificationsEnabled()) {
        window.$notification?.error({
          title: '上传失败',
          content: `文件 "${data.fileName}" 上传失败：${data.error}`,
          duration: 5000
        })
        window.electronAPI?.notification?.show({
          title: '上传失败',
          body: `文件 ${data.fileName} 上传失败：${data.error}`
        })
      }
    }
  }

  // 任务取消处理函数
  const cancelledHandler = (data: { taskId: string | number, fileName: string }) => {
    const task = uploadQueue.value.find(t => t.id === data.taskId || String(t.id) === String(data.taskId))
    if (task) {
      task.status = 'cancelled'
      task.resumable = false  // 已取消任务不可恢复
    }
  }

  // 注册完成、失败和取消监听器
  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onCompleted) {
    window.electronAPI.transfer.onCompleted(completedHandler)
  }

  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onFailed) {
    window.electronAPI.transfer.onFailed(failedHandler)
  }

  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onCancelled) {
    window.electronAPI.transfer.onCancelled(cancelledHandler)
  }

  // 清理函数
  function cleanup() {
    // 清理上传监听器
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeProgressListener) {
      window.electronAPI.transfer.removeProgressListener(progressHandler)
    }
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeCompletedListener) {
      window.electronAPI.transfer.removeCompletedListener(completedHandler)
    }
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeFailedListener) {
      window.electronAPI.transfer.removeFailedListener(failedHandler)
    }
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeCancelledListener) {
      window.electronAPI.transfer.removeCancelledListener(cancelledHandler)
    }

    // 清理下载队列监听器
    if (queueUpdatedListener && typeof window !== 'undefined' && window.electronAPI?.transfer?.removeQueueUpdatedListener) {
      window.electronAPI.transfer.removeQueueUpdatedListener(queueUpdatedListener)
      queueUpdatedListener = null
    }

    // 清理下载进度监听器
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeDownloadProgressListener) {
      window.electronAPI.transfer.removeDownloadProgressListener(downloadProgressHandler)
    }
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeDownloadCompletedListener) {
      window.electronAPI.transfer.removeDownloadCompletedListener(downloadCompletedHandler)
    }
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeDownloadFailedListener) {
      window.electronAPI.transfer.removeDownloadFailedListener(downloadFailedHandler)
    }
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeDownloadCancelledListener) {
      window.electronAPI.transfer.removeDownloadCancelledListener(downloadCancelledHandler)
    }
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeDownloadAuthFailedListener) {
      window.electronAPI.transfer.removeDownloadAuthFailedListener(downloadAuthFailedHandler)
    }
  }

  // 恢复单个上传任务
  async function resumeUpload(taskId: string | number, userId: number, userToken: string, username: string) {
    try {
      const result = await window.electronAPI.transfer.resume(
        typeof taskId === 'number' ? taskId : parseInt(taskId as string) || 0,
        userId,
        userToken,
        username
      )
      if (result?.success) {
        const task = uploadQueue.value.find(t => t.id === taskId)
        if (task) {
          task.status = 'in_progress'
        }
      }
      return result || { success: false, error: '未返回结果' }
    } catch (error: any) {
      return { success: false, error: error.message || '恢复任务失败' }
    }
  }

  // 自动重试所有失败任务
  async function autoRetryFailedTasks(userId: number, userToken: string, username: string) {
    try {
      const result = await window.electronAPI.transfer.autoRetryAll(userId, userToken, username)
      if (result?.success) {
        // 更新所有失败任务的状态为 in_progress
        const failedTasks = uploadQueue.value.filter(t => t.status === 'failed' && t.resumable)
        failedTasks.forEach(task => {
          task.status = 'in_progress'
        })
      }
      return result || { success: false, error: '未返回结果' }
    } catch (error: any) {
      return { success: false, error: error.message || '自动重试失败' }
    }
  }

  // 网络状态监听
  const isOnline = ref(navigator.onLine)

  // 监听网络状态变化
  if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
      isOnline.value = true
      if (isNotificationsEnabled()) {
        window.$notification?.success({
          title: '网络已恢复',
          content: '正在重试失败的上传任务...',
          duration: 3000
        })
      }
      // TODO: 这里需要获取用户信息，暂时跳过
      // await autoRetryFailedTasks(userId, userToken, username)
    })

    window.addEventListener('offline', () => {
      isOnline.value = false
      if (isNotificationsEnabled()) {
        window.$notification?.warning({
          title: '网络已断开',
          content: '上传任务已暂停，等待网络恢复...',
          duration: 5000
        })
      }
    })
  }

  // ========== 下载功能 ==========

  // 下载队列状态（使用已声明的 downloadQueue）
  const activeDownloads = ref<DownloadTask[]>([])
  const completedDownloads = ref<DownloadTask[]>([])
  const failedDownloads = ref<DownloadTask[]>([])

  const isDownloadQueuePaused = ref(false)

  // UI 状态：进度面板折叠状态（持久化到 localStorage）
  const STORAGE_KEY_PANEL_COLLAPSED = 'liuliu_progress_panel_collapsed'
  const isProgressPanelCollapsed = ref<boolean>(
    localStorage.getItem(STORAGE_KEY_PANEL_COLLAPSED) === 'true'
  )

  // 下载进度数据（使用 Map 存储以便快速查找）
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

  // 节流更新函数（每秒更新一次）
  const throttledProgressUpdate = throttle((data: {
    taskId: string
    fileName: string
    progress: number
    downloadedBytes: number
    totalBytes: number
    speed: number
  }) => {
    // 计算 ETA
    const eta = data.speed > 0 && data.totalBytes > 0
      ? (data.totalBytes - data.downloadedBytes) / data.speed
      : Infinity

    downloadProgressMap.value.set(data.taskId, {
      taskId: data.taskId,
      fileName: data.fileName,
      downloadedBytes: data.downloadedBytes,
      totalBytes: data.totalBytes,
      percentage: data.progress,
      speed: data.speed,
      eta,
      status: data.progress === 100 ? 'completed' : 'in_progress',
      lastUpdate: Date.now()
    })
  }, PROGRESS_UPDATE_THROTTLE_MS)

  // 获取所有进行中的下载进度
  const activeDownloadProgress = computed(() => {
    return Array.from(downloadProgressMap.value.values())
      .filter(p => p.status === 'in_progress')
      .sort((a, b) => b.lastUpdate - a.lastUpdate) // 按更新时间排序
  })

  // 获取总下载速度
  const totalDownloadSpeed = computed(() => {
    const progressArray = Array.from(downloadProgressMap.value.values())
    return progressArray
      .filter(p => p.status === 'in_progress')
      .reduce((sum, p) => sum + p.speed, 0)
  })

  // 获取总下载进度百分比
  const totalDownloadProgress = computed(() => {
    const progressArray = Array.from(downloadProgressMap.value.values())
    if (progressArray.length === 0) return 0

    const totalDownloaded = progressArray.reduce((sum, p) => sum + p.downloadedBytes, 0)
    const totalSize = progressArray.reduce((sum, p) => sum + p.totalBytes, 0)

    if (totalSize === 0) return 0
    return Math.round((totalDownloaded / totalSize) * 100)
  })

  // 下载队列监听器引用(用于清理)
  let queueUpdatedListener: ((data: any) => void) | null = null

  // 初始化下载队列（应用启动时调用）
  async function initDownloadQueue(userId: number, userToken: string, username: string) {
    try {
      const result = await window.electronAPI.transfer.initDownloadQueue?.({ userId, userToken, username })

      if (result?.success) {
        console.log(`[transferStore] 下载队列初始化完成，恢复了 ${result.restoredCount} 个任务`)
      }

      // 监听队列更新事件(保存监听器引用以便清理)
      if (window.electronAPI?.transfer?.onQueueUpdated) {
        queueUpdatedListener = (state: any) => {
          console.log('[transferStore] 收到队列更新事件:', {
            pending: state.pending?.length || 0,
            active: state.active?.length || 0,
            completed: state.completed?.length || 0,
            failed: state.failed?.length || 0
          })
          // 添加防御性检查，确保 state 对象包含所有必需的属性
          if (!state) {
            console.warn('[transferStore] 队列更新事件的数据为空')
            return
          }
          downloadQueue.value = state.pending || []
          activeDownloads.value = state.active || []
          completedDownloads.value = state.completed || []
          failedDownloads.value = state.failed || []
        }
        window.electronAPI.transfer.onQueueUpdated(queueUpdatedListener)
      }
    } catch (error: any) {
      console.error('[transferStore] 初始化下载队列失败:', error)
    }
  }

  // 添加到下载队列
  async function queueDownload(remotePath: string, fileName: string, savePath?: string) {
    try {
      // 获取用户认证信息(延迟导入 authStore 以避免循环依赖)
      const { useAuthStore } = await import('@/stores/authStore')
      const authStore = useAuthStore()

      if (!authStore.isLoggedIn || !authStore.user) {
        return {
          success: false,
          error: '用户未登录,无法添加下载任务'
        }
      }

      const userId = authStore.user.id
      const userToken = authStore.user.token
      const username = authStore.user.username

      const taskId = `download_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

      const result = await window.electronAPI.transfer.queueDownload?.({
        id: taskId,
        remotePath,
        fileName,
        savePath,
        userId,
        userToken,
        username,
        priority: downloadQueue.value.length
      })

      console.log('[transferStore.queueDownload] IPC 返回:', result)
      const returnValue = result || { success: false, error: '队列下载功能未实现' }
      console.log('[transferStore.queueDownload] 实际返回:', returnValue)
      return returnValue
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '添加到队列失败'
      }
    }
  }

  // 批量添加到下载队列：一次 IPC 调用
  async function batchQueueDownload(filePaths: string[]) {
    try {
      const result = await window.electronAPI.transfer.batchQueueDownload?.({ remotePaths: filePaths })
      return result || { success: false, successCount: 0, failedCount: filePaths.length, error: '批量下载功能未实现' }
    } catch (error: any) {
      return { success: false, successCount: 0, failedCount: filePaths.length, error: error.message || '批量添加到队列失败' }
    }
  }

  // 暂停下载队列
  async function pauseDownloadQueue() {
    try {
      const result = await window.electronAPI.transfer.pauseDownloadQueue?.()
      if (result?.success) {
        isDownloadQueuePaused.value = true
      }
      return result || { success: false, error: '暂停队列功能未实现' }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '暂停队列失败'
      }
    }
  }

  // 恢复下载队列
  async function resumeDownloadQueue() {
    try {
      const result = await window.electronAPI.transfer.resumeDownloadQueue?.()
      if (result?.success) {
        isDownloadQueuePaused.value = false
      }
      return result || { success: false, error: '恢复队列功能未实现' }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '恢复队列失败'
      }
    }
  }

  // 清空下载队列（已完成和失败的任务）
  async function clearDownloadQueue() {
    try {
      const result = await window.electronAPI.transfer.clearDownloadQueue?.()
      return result || { success: false, error: '清空队列功能未实现' }
    } catch (error: any) {
      return { success: false, error: error.message || '清空队列失败' }
    }
  }

  // 清空等待中的任务
  async function clearPendingQueue() {
    try {
      const result = await window.electronAPI.transfer.clearPendingQueue?.()
      return result || { success: false, error: '清空等待队列功能未实现' }
    } catch (error: any) {
      return { success: false, error: error.message || '清空等待队列失败' }
    }
  }

  // 清空正在下载的任务
  async function clearActiveQueue() {
    try {
      const result = await window.electronAPI.transfer.clearActiveQueue?.()
      return result || { success: false, error: '清空下载队列功能未实现' }
    } catch (error: any) {
      return { success: false, error: error.message || '清空下载队列失败' }
    }
  }

  // 获取下载队列状态
  async function fetchDownloadQueueState() {
    try {
      const result = await window.electronAPI.transfer.getDownloadQueue?.()
      if (result?.success) {
        downloadQueue.value = result.state.pending
        activeDownloads.value = result.state.active
        completedDownloads.value = result.state.completed
        failedDownloads.value = result.state.failed
      }
    } catch (error: any) {
      console.error('[transferStore] 获取队列状态失败:', error)
    }
  }

  // 下载进度处理函数（节流优化）
  const downloadProgressHandler = (data: { taskId: string, fileName: string, progress: number, downloadedBytes: number, totalBytes: number, speed: number } | undefined) => {
    // 数据有效性检查
    if (!data || !data.taskId) {
      console.warn('[downloadProgressHandler] 收到无效的下载进度数据:', data)
      return
    }

    // 使用节流函数更新进度
    throttledProgressUpdate(data)
  }

  // 下载完成处理函数
  const notifiedDownloadTaskIds = new Set<string>()

  const downloadCompletedHandler = (data: { taskId: string, fileName: string, savePath: string } | undefined) => {
    // 数据有效性检查
    if (!data || !data.taskId) {
      console.warn('[downloadCompletedHandler] 收到无效的下载完成数据:', data)
      return
    }

    // 去重：同一个 taskId 只处理一次通知
    if (notifiedDownloadTaskIds.has(data.taskId)) return
    notifiedDownloadTaskIds.add(data.taskId)
    setTimeout(() => notifiedDownloadTaskIds.delete(data.taskId), 10000)

    // 更新进度Map
    const progress = downloadProgressMap.value.get(data.taskId)
    if (progress) {
      progress.status = 'completed'
      progress.percentage = 100
      progress.downloadedBytes = progress.totalBytes
    }

    // Story 6.2 CRITICAL FIX: 下载不应该影响配额使用量
    // 下载是保存到用户本地，不占用服务器存储空间
    // 移除了 quotaStore.refreshQuota() 调用

    // 延迟清理已完成任务的进度数据（5秒后删除）
    setTimeout(() => {
      downloadProgressMap.value.delete(data.taskId)
    }, COMPLETED_TASK_CLEANUP_DELAY_MS)

    // 批量合并下载完成通知
    pendingDownloadNotifications.value.push({ fileName: data.fileName, savePath: data.savePath })
    scheduleDownloadNotification()
  }

  // 下载失败处理函数
  const downloadFailedHandler = (data: { taskId: string, fileName: string, error: string } | undefined) => {
    // 数据有效性检查
    if (!data || !data.taskId) {
      console.warn('[downloadFailedHandler] 收到无效的下载失败数据:', data)
      return
    }

    // 清理进度数据
    downloadProgressMap.value.delete(data.taskId)

    // 批量合并失败通知
    pendingDownloadFailNotifications.value.push(data.fileName)
    if (downloadFailNotifyTimer) clearTimeout(downloadFailNotifyTimer)
    downloadFailNotifyTimer = setTimeout(flushDownloadFailNotifications, 1500)
  }

  // 下载取消处理函数
  const downloadCancelledHandler = (data: { taskId: string | number } | undefined) => {
    // 数据有效性检查
    if (!data || data.taskId === undefined) {
      console.warn('[downloadCancelledHandler] 收到无效的下载取消数据:', data)
      return
    }

    // 清理进度数据
    downloadProgressMap.value.delete(data.taskId.toString())
  }

  // 注册下载监听器
  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onDownloadProgress) {
    window.electronAPI.transfer.onDownloadProgress(downloadProgressHandler)
  }

  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onDownloadCompleted) {
    window.electronAPI.transfer.onDownloadCompleted(downloadCompletedHandler)
  }

  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onDownloadFailed) {
    window.electronAPI.transfer.onDownloadFailed(downloadFailedHandler)
  }

  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onDownloadCancelled) {
    window.electronAPI.transfer.onDownloadCancelled(downloadCancelledHandler)
  }

  // 认证失败处理：Alist token 过期时显示一次性通知
  const downloadAuthFailedHandler = (data: { error: string } | undefined) => {
    if (!data) return
    isDownloadQueuePaused.value = true
    window.$notification?.error({
      title: 'Alist 认证失效',
      content: data.error,
      duration: 0  // 不自动关闭
    })
  }

  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onDownloadAuthFailed) {
    window.electronAPI.transfer.onDownloadAuthFailed(downloadAuthFailedHandler)
  }

  // ========== 另存为下载 ==========

  // 另存为：打开保存对话框并下载到用户选择的路径
  async function downloadWithSaveAs(remotePath: string, fileName: string, userId: number, userToken: string, username: string) {
    try {
      // 1. 打开保存对话框
      const saveAsResult = await window.electronAPI.transfer.saveAs(fileName, userId)

      // 2. 用户取消操作
      if (saveAsResult?.canceled) {
        return { success: false, canceled: true }
      }

      // 3. 保存对话框失败
      if (!saveAsResult?.success || !saveAsResult?.filePath) {
        return { success: false, error: saveAsResult?.error || '选择保存位置失败' }
      }

      // 4. 开始下载到用户选择的路径
      const downloadResult = await window.electronAPI.transfer.download(
        remotePath,
        fileName,
        userId,
        userToken,
        username,
        saveAsResult.filePath
      )

      return downloadResult || { success: false, error: '下载失败' }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '另存为下载失败'
      }
    }
  }

  /**
   * 恢复下载任务（Story 4-5: 下载断点续传）
   */
  async function resumeDownload(taskId: number) {
    try {
      const result = await window.electronAPI.transfer.resumeDownload(taskId)

      if (!result?.success) {
        throw new Error(result?.error || '恢复下载失败')
      }

      return result
    } catch (error: any) {
      console.error('恢复下载失败:', error)
      window.$message?.error(error.message || '恢复下载失败')
      throw error
    }
  }

  /**
   * 取消下载任务（Story 4-6: 取消下载任务）
   */
  async function cancelDownload(taskId: string | number) {
    try {
      const result = await window.electronAPI.transfer.cancelDownload(taskId)

      if (!result?.success) {
        throw new Error(result?.error || '取消下载失败')
      }

      // 显示成功通知
      window.$message?.success('下载已取消')

      return result
    } catch (error: any) {
      console.error('取消下载失败:', error)
      window.$message?.error(error.message || '取消下载失败')
      throw error
    }
  }

  /**
   * 取消所有下载（批量取消）
   */
  async function cancelAllDownloads() {
    const authStore = (await import('./authStore')).useAuthStore()

    if (!authStore.user) {
      window.$message?.error('请先登录')
      return
    }

    try {
      const result = await window.electronAPI.transfer.cancelAllDownloads(authStore.user.id)

      if (!result?.success) {
        throw new Error(result?.error || '取消所有下载失败')
      }

      window.$message?.success('所有下载已取消')

      return result
    } catch (error: any) {
      console.error('取消所有下载失败:', error)
      window.$message?.error(error.message || '取消下载失败')
      throw error
    }
  }

  /**
   * 切换进度面板折叠状态
   */
  function toggleProgressPanel() {
    isProgressPanelCollapsed.value = !isProgressPanelCollapsed.value
    localStorage.setItem(STORAGE_KEY_PANEL_COLLAPSED, String(isProgressPanelCollapsed.value))
  }

  return {
    uploadQueue,
    downloadQueue,
    activeDownloads,
    completedDownloads,
    failedDownloads,
    isUploading,
    uploadError,
    queueStatus,
    isDownloadQueuePaused,
    isProgressPanelCollapsed,
    pendingUploads,
    activeUploads,
    completedUploads,
    addToUploadQueue,
    addPathsToUploadQueue,
    removeFromQueue,
    clearCompleted,
    startUpload,
    processQueue,
    fetchQueueStatus,
    resumeUpload,
    autoRetryFailedTasks,
    initDownloadQueue,
    queueDownload,
    batchQueueDownload,
    pauseDownloadQueue,
    resumeDownloadQueue,
    clearDownloadQueue,
    clearPendingQueue,
    clearActiveQueue,
    fetchDownloadQueueState,
    downloadWithSaveAs,
    resumeDownload,
    cancelDownload,
    cancelAllDownloads,
    toggleProgressPanel,
    isOnline,
    downloadProgressMap,
    activeDownloadProgress,
    totalDownloadSpeed,
    totalDownloadProgress,
    cleanup
  }
})
