import { ref, computed } from 'vue'
import { ElNotification } from 'element-plus'
import { useQuotaStore } from '@/features/quota'
import { isNotificationsEnabled } from './useTransferCommon'
import { transferRendererService } from '../transfer.renderer.service'
import { useTransferStore } from '../stores/transferStore'
import type { UploadTask, QueueStatus } from '../stores/transferStore'

export function useTransferUpload() {
  const store = useTransferStore()

  // State（直接引用 store 的 state，保持响应式）
  const uploadQueue = store.uploadQueue
  const isUploading = store.isUploading
  const uploadError = store.uploadError
  const queueStatus = store.queueStatus

  // 批量通知状态
  const pendingUploadNotifications = ref<string[]>([])
  let uploadNotifyTimer: ReturnType<typeof setTimeout> | null = null

  // Getters（直接引用 store 的 getters）
  const pendingUploads = computed(() => store.pendingUploads)
  const activeUploads = computed(() => store.activeUploads)
  const completedUploads = computed(() => store.completedUploads)

  // 通知函数
  function flushUploadNotifications() {
    const files = pendingUploadNotifications.value.splice(0)
    if (files.length === 0 || !isNotificationsEnabled()) return
    const title = '上传完成'
    const content = files.length === 1
      ? `文件 "${files[0]}" 已成功上传`
      : `${files.length} 个文件上传完成`
    ElNotification.success({ title, message: content, duration: 4000 })
    window.electronAPI?.notification?.show({ title: '溜溜网盘', body: content })
  }

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

    store.setUploadTasks([...uploadQueue, ...tasks])
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
    store.setUploadTasks([...uploadQueue, ...tasks])
  }

  function removeFromQueue(taskId: string | number) {
    store.removeUploadTask(taskId)
  }

  function clearCompleted() {
    store.setUploadTasks(uploadQueue.filter(t => t.status !== 'completed'))
  }

  async function startUpload(taskId: string, userId: number, userToken: string, username: string) {
    const task = uploadQueue.find(t => t.id === taskId || String(t.id) === String(taskId))
    if (!task) return

    store.updateUploadTaskStatus(taskId, 'pending')
    store.setUploadError(null)

    try {
      // 使用队列管理器而不是直接上传
      await transferRendererService.addToQueue({
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
      store.updateUploadTaskStatus(taskId, 'failed')
      // 需要更新 error 字段，但 store 没有专门的 setter，这里直接修改
      const t = uploadQueue.find(t => t.id === taskId || String(t.id) === String(taskId))
      if (t) t.error = error.message || '添加到队列失败'
      store.setUploadError(error.message || '添加到队列失败')
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
    const status = await transferRendererService.getQueueStatus() as QueueStatus | null
    if (status) {
      store.setUploadQueueStatus(status)
    }
  }

  // 进度更新处理函数
  const progressHandler = (data: { taskId: string | number, progress: number, transferredSize?: number }) => {
    const task = uploadQueue.find(t => t.id === data.taskId || String(t.id) === String(data.taskId))
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
    store.updateUploadTaskProgress(data.taskId, data.progress)
    task.transferredSize = newTransferredSize
    task.lastUpdateTime = now
    task.lastTransferredSize = newTransferredSize
  }

  // 注册进度监听器
  transferRendererService.onProgress(progressHandler)

  // 任务完成处理函数
  const completedHandler = (data: { taskId: string | number, fileName: string }) => {
    const task = uploadQueue.find(t => t.id === data.taskId || String(t.id) === String(data.taskId))
    if (task) {
      store.updateUploadTaskStatus(data.taskId, 'completed')
      store.updateUploadTaskProgress(data.taskId, 100)
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
    const task = uploadQueue.find(t => t.id === data.taskId || String(t.id) === String(data.taskId))
    if (task) {
      store.updateUploadTaskStatus(data.taskId, 'failed')
      // 需要更新 error 字段，直接修改
      task.error = data.error
      task.resumable = true  // 失败任务可恢复

      // 显示应用内失败通知（失败通知不合并，让用户知道哪个失败）
      if (isNotificationsEnabled()) {
        ElNotification.error({
          title: '上传失败',
          message: `文件 "${data.fileName}" 上传失败：${data.error}`,
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
    const task = uploadQueue.find(t => t.id === data.taskId || String(t.id) === String(data.taskId))
    if (task) {
      store.updateUploadTaskStatus(data.taskId, 'cancelled')
      task.resumable = false  // 已取消任务不可恢复
    }
  }

  // 注册完成、失败和取消监听器
  transferRendererService.onCompleted(completedHandler)
  transferRendererService.onFailed(failedHandler)
  transferRendererService.onCancelled(cancelledHandler)

  // 恢复单个上传任务
  async function resumeUpload(taskId: string | number, userId: number, userToken: string, username: string) {
    const result = await transferRendererService.resume(
      typeof taskId === 'number' ? taskId : parseInt(taskId as string) || 0,
      userId,
      userToken,
      username
    )
    if (result) {
      store.updateUploadTaskStatus(taskId, 'in_progress')
    }
    return result
  }

  // 自动重试所有失败任务
  async function autoRetryFailedTasks(userId: number, userToken: string, username: string) {
    const result = await transferRendererService.autoRetryAll(userId, userToken, username)
    if (result) {
      // 更新所有失败任务的状态为 in_progress
      const failedTasks = uploadQueue.filter(t => t.status === 'failed' && t.resumable)
      failedTasks.forEach(task => {
        store.updateUploadTaskStatus(task.id, 'in_progress')
      })
    }
    return result
  }

  // 清理函数
  function cleanupUpload() {
    // 清理上传监听器
    transferRendererService.removeListener('transfer:upload:progress', progressHandler)
    transferRendererService.removeListener('transfer:upload:completed', completedHandler)
    transferRendererService.removeListener('transfer:upload:failed', failedHandler)
    transferRendererService.removeListener('transfer:upload:cancelled', cancelledHandler)

    // 清理通知定时器
    if (uploadNotifyTimer) {
      clearTimeout(uploadNotifyTimer)
      uploadNotifyTimer = null
    }
  }

  return {
    // State
    uploadQueue,
    isUploading,
    uploadError,
    queueStatus,
    // Getters
    pendingUploads,
    activeUploads,
    completedUploads,
    // Actions
    addToUploadQueue,
    addPathsToUploadQueue,
    removeFromQueue,
    clearCompleted,
    startUpload,
    processQueue,
    fetchQueueStatus,
    resumeUpload,
    autoRetryFailedTasks,
    // Cleanup
    cleanupUpload
  }
}
