import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
}

export interface QueueStatus {
  active: number
  pending: number
  maxConcurrent: number
}

export const useTransferStore = defineStore('transfer', () => {
  // State
  const uploadQueue = ref<UploadTask[]>([])
  const isUploading = ref<boolean>(false)
  const uploadError = ref<string | null>(null)
  const queueStatus = ref<QueueStatus>({ active: 0, pending: 0, maxConcurrent: 5 })

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
      targetPath
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
      targetPath
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
  const progressHandler = (data: { taskId: string | number, progress: number }) => {
    const task = uploadQueue.value.find(t => t.id === data.taskId || String(t.id) === String(data.taskId))
    if (task) {
      task.progress = data.progress
      task.transferredSize = Math.floor((task.fileSize * data.progress) / 100)
    }
  }

  // 注册进度监听器
  if (typeof window !== 'undefined' && window.electronAPI?.transfer?.onProgress) {
    window.electronAPI.transfer.onProgress(progressHandler)
  }

  // 清理函数
  function cleanup() {
    if (typeof window !== 'undefined' && window.electronAPI?.transfer?.removeProgressListener) {
      window.electronAPI.transfer.removeProgressListener(progressHandler)
    }
  }

  return {
    uploadQueue,
    isUploading,
    uploadError,
    queueStatus,
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
    cleanup
  }
})
