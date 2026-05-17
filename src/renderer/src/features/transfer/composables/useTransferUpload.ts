import { ref, computed } from 'vue'
import { ElNotification } from 'element-plus'
import { useQuotaStore } from '@/features/quota'
import { isNotificationsEnabled } from './useTransferCommon'
import type { UploadTask, QueueStatus } from '../stores/transferStore'

export function useTransferUpload() {
  // State
  const uploadQueue = ref<UploadTask[]>([])
  const isUploading = ref<boolean>(false)
  const uploadError = ref<string | null>(null)
  const queueStatus = ref<QueueStatus>({ active: 0, pending: 0, maxConcurrent: 5 })

  // 批量通知状态
  const pendingUploadNotifications = ref<string[]>([])
  let uploadNotifyTimer: ReturnType<typeof setTimeout> | null = null

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

  // 清理函数
  function cleanupUpload() {
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
