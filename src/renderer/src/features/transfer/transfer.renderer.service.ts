import { useIPC } from '@/core/composables/useIPC'

export function createTransferService() {
  const { invoke } = useIPC()

  return {
    // ===== 上传 =====
    async upload(params: any) {
      return invoke(window.electronAPI.invoke('transfer:upload', params))
    },

    async addToQueue(task: any) {
      return invoke(window.electronAPI.invoke('transfer:add-to-queue', task))
    },

    async getQueueStatus() {
      return invoke(window.electronAPI.invoke('transfer:queue-status'))
    },

    async cancel(taskId: number) {
      return invoke(window.electronAPI.invoke('transfer:cancel', taskId))
    },

    async resume(taskId: number, userId: number, userToken: string, username: string) {
      return invoke(window.electronAPI.invoke('transfer:resume', { taskId, userId, userToken, username }))
    },

    async autoRetryAll(userId: number, userToken: string, username: string) {
      return invoke(window.electronAPI.invoke('transfer:auto-retry-all', { userId, userToken, username }))
    },

    // ===== 下载 =====
    async download(params: any) {
      return invoke(window.electronAPI.invoke('transfer:download', params))
    },

    async saveAs(fileName: string, userId: number) {
      return invoke(window.electronAPI.invoke('transfer:saveAs', { fileName, userId }))
    },

    async initDownloadQueue(userId: number, userToken: string) {
      return invoke(window.electronAPI.invoke('transfer:initDownloadQueue', { userId, userToken }))
    },

    async queueDownload(taskData: any) {
      return invoke(window.electronAPI.invoke('transfer:queueDownload', taskData))
    },

    async batchQueueDownload(remotePaths: string[]) {
      return invoke(window.electronAPI.invoke('transfer:batchQueueDownload', { remotePaths }))
    },

    async getDownloadQueue() {
      return invoke(window.electronAPI.invoke('transfer:getDownloadQueue'))
    },

    async pauseDownloadQueue() {
      return invoke(window.electronAPI.invoke('transfer:pauseDownloadQueue'))
    },

    async resumeDownloadQueue() {
      return invoke(window.electronAPI.invoke('transfer:resumeDownloadQueue'))
    },

    async clearDownloadQueue() {
      return invoke(window.electronAPI.invoke('transfer:clearDownloadQueue'))
    },

    async clearPendingQueue() {
      return invoke(window.electronAPI.invoke('transfer:clearPendingQueue'))
    },

    async clearActiveQueue() {
      return invoke(window.electronAPI.invoke('transfer:clearActiveQueue'))
    },

    async resumeDownload(taskId: number) {
      return invoke(window.electronAPI.invoke('transfer:resumeDownload', { taskId }))
    },

    async cancelDownload(taskId: string | number) {
      return invoke(window.electronAPI.invoke('transfer:cancelDownload', { taskId }))
    },

    async cancelAllDownloads(userId: number) {
      return invoke(window.electronAPI.invoke('transfer:cancelAllDownloads', { userId }))
    },

    // ===== 任务列表 =====
    async list(userId: number) {
      return invoke(window.electronAPI.invoke('transfer:list', userId))
    },

    async restoreQueue(userId: number, userToken: string, username?: string) {
      return invoke(window.electronAPI.invoke('transfer:restore-queue', { userId, userToken, username }))
    },

    // ===== 事件监听 =====
    onProgress(callback: (data: any) => void) {
      window.electronAPI.on('transfer:progress', callback)
    },

    onCompleted(callback: (data: any) => void) {
      window.electronAPI.on('transfer:completed', callback)
    },

    onFailed(callback: (data: any) => void) {
      window.electronAPI.on('transfer:failed', callback)
    },

    onCancelled(callback: (data: any) => void) {
      window.electronAPI.on('transfer:cancelled', callback)
    },

    onDownloadProgress(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download-progress', callback)
    },

    onDownloadCompleted(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download-completed', callback)
    },

    onDownloadFailed(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download-failed', callback)
    },

    onDownloadCancelled(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download-cancelled', callback)
    },

    removeListener(channel: string, callback: Function) {
      window.electronAPI.removeListener(channel, callback)
    }
  }
}

export const transferRendererService = createTransferService()
