import { useTransferStore } from '../stores/transferStore'
import { transferRendererService } from '../transfer.renderer.service'

export function useTransfer() {
  const store = useTransferStore()

  async function loadTasks(userId: number) {
    store.isLoading = true
    try {
      const result = await transferRendererService.list(userId)
      if (result.success && result.data) {
        store.setUploadTasks(result.data.filter(t => t.taskType === 'upload'))
        store.setDownloadTasks(result.data.filter(t => t.taskType === 'download'))
      }
    } finally {
      store.isLoading = false
    }
  }

  return { loadTasks, uploadTasks: store.uploadTasks, downloadTasks: store.downloadTasks }
}
