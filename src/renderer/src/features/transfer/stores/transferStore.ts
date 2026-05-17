import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TransferTask } from '../../../../shared/types/transfer'

export const useTransferStore = defineStore('transfer', () => {
  const uploadTasks = ref<TransferTask[]>([])
  const downloadTasks = ref<TransferTask[]>([])
  const isLoading = ref(false)

  const pendingUploads = computed(() => uploadTasks.value.filter(t => t.status === 'pending'))
  const activeUploads = computed(() => uploadTasks.value.filter(t => t.status === 'in_progress'))

  function setUploadTasks(tasks: TransferTask[]) { uploadTasks.value = tasks }
  function setDownloadTasks(tasks: TransferTask[]) { downloadTasks.value = tasks }

  return {
    uploadTasks, downloadTasks, isLoading,
    pendingUploads, activeUploads,
    setUploadTasks, setDownloadTasks
  }
})
