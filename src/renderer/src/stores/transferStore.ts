import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UploadTask {
  id: string
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

export const useTransferStore = defineStore('transfer', () => {
  // State
  const uploadQueue = ref<UploadTask[]>([])
  const isUploading = ref<boolean>(false)
  const uploadError = ref<string | null>(null)

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
      fileSize: 0, // Will be resolved by main process
      transferredSize: 0,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      targetPath
    }))
    uploadQueue.value.push(...tasks)
  }

  function removeFromQueue(taskId: string) {
    const index = uploadQueue.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      uploadQueue.value.splice(index, 1)
    }
  }

  function clearCompleted() {
    uploadQueue.value = uploadQueue.value.filter(t => t.status !== 'completed')
  }

  return {
    uploadQueue,
    isUploading,
    uploadError,
    pendingUploads,
    activeUploads,
    completedUploads,
    addToUploadQueue,
    addPathsToUploadQueue,
    removeFromQueue,
    clearCompleted
  }
})
