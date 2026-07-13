import { ref, computed, h } from 'vue'
import { throttle } from 'lodash-es'
import { ElNotification, ElMessage } from 'element-plus'
import { openFileDirectory } from '@/utils/openFileDirectory'
import { isNotificationsEnabled } from './useTransferCommon'
import { isAlistAuthFailureMessage } from '@shared/auth-error-utils'
import { transferRendererService } from '../transfer.renderer.service'
import { useTransferStore } from '../stores/transferStore'

// ==================== 常量定义 ====================

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

// 模块级共享状态：确保 IPC 监听器只注册一次，避免多个组件重复弹窗
let _listenersRegistered = false
const _pendingDownloadNotifications = ref<Array<{ fileName: string; savePath: string }>>([])
let _downloadNotifyTimer: ReturnType<typeof setTimeout> | null = null
const _pendingDownloadFailNotifications = ref<string[]>([])
let _downloadFailNotifyTimer: ReturnType<typeof setTimeout> | null = null
const _notifiedDownloadTaskIds = new Set<string>()
type PendingDownloadNotification = { fileName: string; savePath: string }
type DownloadBatchNotification = {
  total: number
  completed: PendingDownloadNotification[]
  failed: string[]
  cancelled: string[]
  settledTaskIds: Set<string>
  timer: ReturnType<typeof setTimeout> | null
}
const _pendingBatchDownloadNotifications = new Map<string, DownloadBatchNotification>()

// 已 flush 的批次 ID + TTL（防止迟到事件重新创建空批次条目导致永久泄漏）
const _settledBatchIds = new Set<string>()

// 认证失败静默窗口：认证失败事件触发后 30 秒内，跳过普通下载失败通知
let _authFailureSilenceUntil = 0

type DownloadCompletedEvent = {
  taskId: string
  fileName: string
  savePath: string
  batchId?: string
  batchTotal?: number
}

type DownloadFailedEvent = {
  taskId: string
  fileName: string
  error: string
  batchId?: string
  batchTotal?: number
}

type DownloadCancelledEvent = {
  taskId: string | number
  fileName?: string
  batchId?: string
  batchTotal?: number
}

export function useTransferDownload() {
  const store = useTransferStore()

  // 下载队列状态（直接引用 store 的 state，保持响应式）
  const downloadQueue = store.downloadQueue
  const activeDownloads = store.activeDownloads
  const completedDownloads = store.completedDownloads
  const failedDownloads = store.failedDownloads
  const downloadQueueCounts = store.downloadQueueCounts
  const isDownloadQueuePaused = store.isDownloadQueuePaused

  // 下载进度数据（直接引用 store 的 state）
  const downloadProgressMap = store.downloadProgressMap

  // 已通知的下载任务ID集合（模块级共享，去重用）
  const notifiedDownloadTaskIds = _notifiedDownloadTaskIds

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

    downloadProgressMap.set(data.taskId, {
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

  // 获取所有进行中的下载进度（直接引用 store 的 getters）
  const activeDownloadProgress = computed(() => store.activeDownloadProgress)

  // 获取总下载速度（直接引用 store 的 getters）
  const totalDownloadSpeed = computed(() => store.totalDownloadSpeed)

  // 获取总下载进度百分比（直接引用 store 的 getters）
  const totalDownloadProgress = computed(() => store.totalDownloadProgress)

  // 通知函数
  // 纯防抖策略：每次新完成事件都重置计时器，3 秒内无新事件则 flush
  // 不依赖 store.activeDownloads（受 200ms 防抖滞后影响），避免误判队列为空导致单文件通知
  function scheduleDownloadNotification() {
    if (_downloadNotifyTimer) clearTimeout(_downloadNotifyTimer)
    _downloadNotifyTimer = setTimeout(() => {
      flushDownloadNotifications()
    }, 3000)
  }

  function showDownloadCompletionNotification(result: {
    completed: PendingDownloadNotification[]
    failed: string[]
    cancelled: string[]
  }) {
    const { completed, failed, cancelled } = result
    if (!isNotificationsEnabled()) return
    if (completed.length === 0 && failed.length === 0 && cancelled.length === 0) return

    const title = failed.length > 0 && completed.length === 0 && cancelled.length === 0
      ? '下载失败'
      : '下载完成'

    // 构建消息片段
    const segments: string[] = []
    if (completed.length > 0) {
      segments.push(`${completed.length} 个文件下载完成`)
    }
    if (failed.length > 0) {
      segments.push(`${failed.length} 个文件下载失败`)
    }
    if (cancelled.length > 0) {
      segments.push(`${cancelled.length} 个已取消`)
    }
    const content = segments.join(' / ')

    // 确定打开文件夹的目标路径
    const allCompleted = [...completed]
    const dirs = allCompleted.map(f => (f.savePath || '').replace(/[\\/][^\\/]+$/, '').replace(/\\/g, '/'))
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

    if (title === '下载失败') {
      ElNotification.error({
        title,
        message: h('div', [h('p', { style: 'margin: 0' }, content)]),
        duration: 5000
      })
    } else {
      ElNotification.success({
        title,
        message: h('div', [
          h('p', { style: 'margin: 0 0 8px' }, content),
          h('button', {
            onClick: () => lastSavePath && openFileDirectory(lastSavePath),
            style: 'padding: 4px 12px; background-color: #18a058; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px'
          }, '打开文件夹')
        ]),
        duration: 5000
      })
    }
    window.electronAPI?.notification?.show({ title: '溜溜网盘', body: content })
  }

  function flushDownloadNotifications() {
    showDownloadCompletionNotification({
      completed: _pendingDownloadNotifications.value.splice(0),
      failed: [],
      cancelled: []
    })
  }

  function isBatchDownloadEvent(data: { batchId?: string; batchTotal?: number }): data is { batchId: string; batchTotal: number } {
    return typeof data.batchId === 'string' && data.batchId.length > 0 && typeof data.batchTotal === 'number' && data.batchTotal > 0
  }

  function getBatchNotification(batchId: string, batchTotal: number) {
    let batch = _pendingBatchDownloadNotifications.get(batchId)
    if (!batch) {
      batch = {
        total: batchTotal,
        completed: [],
        failed: [],
        cancelled: [],
        settledTaskIds: new Set<string>(),
        timer: null
      }
      _pendingBatchDownloadNotifications.set(batchId, batch)
    } else if (batchTotal > batch.total) {
      batch.total = batchTotal
    }

    // 重置/启动超时定时器（30s 后兜底 flush，防止主进程崩溃导致永久卡住）
    if (batch.timer) clearTimeout(batch.timer)
    batch.timer = setTimeout(() => {
      flushBatchNotificationIfComplete(batchId, true)
    }, 30_000)

    return batch
  }

  function flushBatchNotificationIfComplete(batchId: string, force = false) {
    const batch = _pendingBatchDownloadNotifications.get(batchId)
    if (!batch) return

    const isComplete = batch.settledTaskIds.size >= batch.total
    if (!isComplete && !force) return

    // 清理定时器
    if (batch.timer) {
      clearTimeout(batch.timer)
      batch.timer = null
    }

    // 显示通知
    showDownloadCompletionNotification({
      completed: batch.completed,
      failed: batch.failed,
      cancelled: batch.cancelled
    })

    // 标记为已 settled，防止迟到事件重新创建空批次条目（60s TTL）
    _pendingBatchDownloadNotifications.delete(batchId)
    _settledBatchIds.add(batchId)
    setTimeout(() => _settledBatchIds.delete(batchId), 60_000)
  }

  function recordBatchDownloadCompleted(data: DownloadCompletedEvent): boolean {
    if (_settledBatchIds.has(data.batchId!)) return true
    if (!isBatchDownloadEvent(data)) return false

    const batch = getBatchNotification(data.batchId, data.batchTotal)
    if (!batch.settledTaskIds.has(data.taskId)) {
      batch.settledTaskIds.add(data.taskId)
      batch.completed.push({ fileName: data.fileName, savePath: data.savePath })
    }
    flushBatchNotificationIfComplete(data.batchId)
    return true
  }

  function recordBatchDownloadFailed(data: DownloadFailedEvent): boolean {
    if (_settledBatchIds.has(data.batchId!)) return true
    if (!isBatchDownloadEvent(data)) return false

    const batch = getBatchNotification(data.batchId, data.batchTotal)
    if (!batch.settledTaskIds.has(data.taskId)) {
      batch.settledTaskIds.add(data.taskId)
      batch.failed.push(data.fileName)
    }
    flushBatchNotificationIfComplete(data.batchId)
    return true
  }

  function recordBatchDownloadCancelled(data: DownloadCancelledEvent): boolean {
    if (_settledBatchIds.has(data.batchId!)) return true
    if (!isBatchDownloadEvent(data)) return false

    const batch = getBatchNotification(data.batchId, data.batchTotal)
    const taskIdStr = String(data.taskId)
    if (!batch.settledTaskIds.has(taskIdStr)) {
      batch.settledTaskIds.add(taskIdStr)
      batch.cancelled.push(data.fileName || taskIdStr)
    }
    flushBatchNotificationIfComplete(data.batchId)
    return true
  }

  function flushDownloadFailNotifications() {
    const files = _pendingDownloadFailNotifications.value.splice(0)
    if (files.length === 0 || !isNotificationsEnabled()) return
    const title = '下载失败'
    const content = files.length === 1
      ? `文件 "${files[0]}" 下载失败`
      : `${files.length} 个文件下载失败`
    ElNotification.error({ title, message: content, duration: 5000 })
    window.electronAPI?.notification?.show({ title, body: content })
  }

  function applyDownloadQueueState(state: any) {
    store.setDownloadQueue(state.pending || [])
    store.setActiveDownloads(state.active || [])
    store.setCompletedDownloads(state.completed || [])
    store.setFailedDownloads(state.failed || [])
    store.setDownloadQueueCounts(state.counts || {
      pending: downloadQueue.length,
      active: activeDownloads.length,
      completed: completedDownloads.length,
      failed: failedDownloads.length
    })
  }

  // 初始化下载队列（应用启动时调用）
  async function initDownloadQueue(userId: number, userToken: string) {
    try {
      const result = await transferRendererService.initDownloadQueue(userId, userToken)

      if (result?.restoredCount !== undefined) {
        console.log(`[useTransferDownload] 下载队列初始化完成，恢复了 ${result.restoredCount} 个任务`)
      }

      // 主动拉取一次当前队列状态，确保历史记录（已完成/失败）在初始化时就显示出来
      await fetchDownloadQueueState()
    } catch (error: any) {
      console.error('[useTransferDownload] 初始化下载队列失败:', error)
    }
  }

  // 添加到下载队列
  async function queueDownload(remotePath: string, fileName: string, savePath?: string) {
    try {
      // 获取用户认证信息(延迟导入 authStore 以避免循环依赖)
      const { useAuthStore } = await import('@/features/auth')
      const authStore = useAuthStore()

      if (!authStore.isLoggedIn || !authStore.user) {
        return {
          success: false,
          error: '用户未登录,无法添加下载任务'
        }
      }

      const userId = authStore.user.id
      const userToken = authStore.user.token

      const taskId = `download_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

      const result = await transferRendererService.queueDownload({
        id: taskId,
        remotePath,
        fileName,
        savePath,
        userId,
        userToken,
        priority: downloadQueue.length
      })

      if (!result) {
        return { success: false, error: '添加到队列失败' }
      }
      return { success: true, taskId: result.taskId, dbId: result.dbId }
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
      const result = await transferRendererService.batchQueueDownload(filePaths)
      if (!result) {
        return { success: false, successCount: 0, failedCount: filePaths.length, batchId: undefined, error: '批量添加到队列失败' }
      }
      return {
        success: true,
        successCount: result.successCount ?? 0,
        failedCount: result.failedCount ?? 0,
        batchId: result.batchId
      }
    } catch (error: any) {
      return { success: false, successCount: 0, failedCount: filePaths.length, batchId: undefined, error: error.message || '批量添加到队列失败' }
    }
  }

  // 暂停下载队列
  async function pauseDownloadQueue() {
    try {
      const result = await transferRendererService.pauseDownloadQueue()
      if (result !== null) {
        store.setDownloadQueuePaused(true)
      }
      return { success: result !== null }
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
      const result = await transferRendererService.resumeDownloadQueue()
      if (result !== null) {
        store.setDownloadQueuePaused(false)
      }
      return { success: result !== null }
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
      const result = await transferRendererService.clearDownloadQueue()
      return { success: result !== null }
    } catch (error: any) {
      return { success: false, error: error.message || '清空队列失败' }
    }
  }

  // 清空等待中的任务
  async function clearPendingQueue() {
    try {
      const result = await transferRendererService.clearPendingQueue()
      return { success: result !== null }
    } catch (error: any) {
      return { success: false, error: error.message || '清空等待队列失败' }
    }
  }

  // 清空正在下载的任务
  async function clearActiveQueue() {
    try {
      const result = await transferRendererService.clearActiveQueue()
      return { success: result !== null }
    } catch (error: any) {
      return { success: false, error: error.message || '清空下载队列失败' }
    }
  }

  // 获取下载队列状态
  async function fetchDownloadQueueState() {
    try {
      const result = await transferRendererService.getDownloadQueue()
      if (result) {
        applyDownloadQueueState(result)
      }
    } catch (error: any) {
      console.error('[useTransferDownload] 获取队列状态失败:', error)
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
  const downloadCompletedHandler = (data: DownloadCompletedEvent | undefined) => {
    // 数据有效性检查
    if (!data || !data.taskId) {
      console.warn('[downloadCompletedHandler] 收到无效的下载完成数据:', data)
      return
    }

    // 先记录批次（内部基于 settledTaskIds 自身去重），再做 UI 通知去重
    // 这样即使 IPC 抖动重复发送同一 taskId，settled 计数也不会丢失
    const isBatch = recordBatchDownloadCompleted(data)

    // UI 通知去重：同一个 taskId 只弹一次通知
    if (notifiedDownloadTaskIds.has(data.taskId)) return
    notifiedDownloadTaskIds.add(data.taskId)
    setTimeout(() => notifiedDownloadTaskIds.delete(data.taskId), 10000)

    // 更新进度Map
    const progress = downloadProgressMap.get(data.taskId)
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
      downloadProgressMap.delete(data.taskId)
    }, COMPLETED_TASK_CLEANUP_DELAY_MS)

    if (!isBatch) {
      // 非批次任务走 legacy 3s 防抖通知
      _pendingDownloadNotifications.value.push({ fileName: data.fileName, savePath: data.savePath })
      scheduleDownloadNotification()
    }
  }

  // 下载失败处理函数
  const downloadFailedHandler = (data: DownloadFailedEvent | undefined) => {
    // 数据有效性检查
    if (!data || !data.taskId) {
      console.warn('[downloadFailedHandler] 收到无效的下载失败数据:', data)
      return
    }

    // 清理进度数据
    downloadProgressMap.delete(data.taskId)

    // 认证失败静默窗口内跳过普通下载失败通知
    if (isAlistAuthFailureMessage(data.error) && Date.now() < _authFailureSilenceUntil) {
      return
    }

    // 批次任务：合并到批次通知；非批次：走 legacy 防抖
    const isBatch = recordBatchDownloadFailed(data)
    if (!isBatch) {
      _pendingDownloadFailNotifications.value.push(data.fileName)
      if (_downloadFailNotifyTimer) clearTimeout(_downloadFailNotifyTimer)
      _downloadFailNotifyTimer = setTimeout(flushDownloadFailNotifications, 1500)
    }
  }

  // 下载取消处理函数
  const downloadCancelledHandler = (data: DownloadCancelledEvent | undefined) => {
    // 数据有效性检查
    if (!data || data.taskId === undefined) {
      console.warn('[downloadCancelledHandler] 收到无效的下载取消数据:', data)
      return
    }

    // 清理进度数据
    downloadProgressMap.delete(data.taskId.toString())

    // 批次任务计入 settled；非批次任务静默处理（已经在 UI 中移除）
    recordBatchDownloadCancelled(data)
  }

  // 认证失败处理：Alist token 过期时显示一次性通知
  const downloadAuthFailedHandler = (data: { error: string } | undefined) => {
    if (!data) return
    _authFailureSilenceUntil = Date.now() + 30_000
    store.setDownloadQueuePaused(true)
    ElNotification.error({
      title: 'Alist 认证失效',
      message: data.error,
      duration: 0
    })
  }

  // 队列更新处理函数
  const queueUpdatedHandler = (state: any) => {
    if (state) {
      applyDownloadQueueState(state)
    }
  }

  // 注册下载监听器（模块级单例，避免多个组件重复注册导致重复弹窗）
  if (!_listenersRegistered) {
    _listenersRegistered = true
    transferRendererService.onDownloadProgress(downloadProgressHandler)
    transferRendererService.onDownloadCompleted(downloadCompletedHandler)
    transferRendererService.onDownloadFailed(downloadFailedHandler)
    transferRendererService.onDownloadCancelled(downloadCancelledHandler)
    transferRendererService.onDownloadAuthFailed(downloadAuthFailedHandler)
    transferRendererService.onQueueUpdated(queueUpdatedHandler)
  }

  // ========== 另存为下载 ==========

  // 另存为：打开保存对话框并下载到用户选择的路径
  async function downloadWithSaveAs(remotePath: string, fileName: string, userId: number, userToken: string) {
    try {
      // 1. 打开保存对话框
      const saveAsResult = await transferRendererService.saveAs(fileName, userId)

      // 2. 用户取消操作
      if (saveAsResult === null) {
        return { success: false, canceled: true }
      }

      // 3. 保存对话框失败
      if (!saveAsResult?.filePath) {
        return { success: false, error: '选择保存位置失败' }
      }

      // 4. 开始下载到用户选择的路径
      const downloadResult = await transferRendererService.download({
        remotePath,
        fileName,
        userId,
        userToken,
        savePath: saveAsResult.filePath
      })

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
      const result = await transferRendererService.resumeDownload(taskId)

      if (result === null) {
        throw new Error('恢复下载失败')
      }

      return { success: true }
    } catch (error: any) {
      console.error('恢复下载失败:', error)
      ElMessage.error(error.message || '恢复下载失败')
      throw error
    }
  }

  /**
   * 取消下载任务（Story 4-6: 取消下载任务）
   */
  async function cancelDownload(taskId: string | number) {
    try {
      const result = await transferRendererService.cancelDownload(taskId)

      if (result === null) {
        throw new Error('取消下载失败')
      }

      // 显示成功通知
      ElMessage.success('下载已取消')

      return { success: true }
    } catch (error: any) {
      console.error('取消下载失败:', error)
      ElMessage.error(error.message || '取消下载失败')
      throw error
    }
  }

  /**
   * 取消所有下载（批量取消）
   */
  async function cancelAllDownloads() {
    const authStore = (await import('@/features/auth')).useAuthStore()

    if (!authStore.user) {
      ElMessage.error('请先登录')
      return
    }

    try {
      const result = await transferRendererService.cancelAllDownloads(authStore.user.id)

      if (result === null) {
        throw new Error('取消所有下载失败')
      }

      ElMessage.success('所有下载已取消')

      return { success: true }
    } catch (error: any) {
      console.error('取消所有下载失败:', error)
      ElMessage.error(error.message || '取消下载失败')
      throw error
    }
  }

  // 清理函数
  function cleanupDownload() {
    // IPC 监听器是模块级单例，不在此处移除（避免一个组件卸载影响其他组件）
    // 只清理通知定时器
    if (_downloadNotifyTimer) {
      clearTimeout(_downloadNotifyTimer)
      _downloadNotifyTimer = null
    }
    if (_downloadFailNotifyTimer) {
      clearTimeout(_downloadFailNotifyTimer)
      _downloadFailNotifyTimer = null
    }
    // 不清除模块级 _pendingBatchDownloadNotifications Map（F-11）
    // Map 仅由 flushBatchNotificationIfComplete 管理生命周期
  }

  return {
    // State
    downloadQueue,
    activeDownloads,
    completedDownloads,
    failedDownloads,
    downloadQueueCounts,
    isDownloadQueuePaused,
    downloadProgressMap,
    // Getters
    activeDownloadProgress,
    totalDownloadSpeed,
    totalDownloadProgress,
    // Actions
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
    // Cleanup
    cleanupDownload
  }
}
