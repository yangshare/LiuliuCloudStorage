import { useIPC } from '@/core/composables/useIPC'

export function createTransferService() {
  const { invoke } = useIPC()

  return {
    // ===== 上传 =====
    async upload(params: any) {
      return invoke(window.electronAPI.invoke('transfer:upload:file', params))
    },

    async addToQueue(task: any) {
      return invoke(window.electronAPI.invoke('transfer:upload:add-to-queue', task))
    },

    async getQueueStatus() {
      return invoke(window.electronAPI.invoke('transfer:upload:queue-status'))
    },

    async cancel(taskId: number) {
      return invoke(window.electronAPI.invoke('transfer:upload:cancel', taskId))
    },

    async resume(taskId: number, userId: number, userToken: string, username: string) {
      return invoke(window.electronAPI.invoke('transfer:upload:resume', { taskId, userId, userToken, username }))
    },

    async autoRetryAll(userId: number, userToken: string, username: string) {
      return invoke(window.electronAPI.invoke('transfer:upload:auto-retry-all', { userId, userToken, username }))
    },

    // ===== 下载 =====
    async download(params: any): Promise<{ success: boolean; taskId?: string; savePath?: string; error?: string } | null> {
      return invoke<{ success: boolean; taskId?: string; savePath?: string; error?: string }>(window.electronAPI.invoke('transfer:download:file', params))
    },

    async saveAs(fileName: string, userId: number): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string } | null> {
      return invoke<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>(window.electronAPI.invoke('transfer:download:saveAs', { fileName, userId }))
    },

    async initDownloadQueue(userId: number, userToken: string): Promise<{ restoredCount?: number; error?: string } | null> {
      return invoke<{ restoredCount?: number; error?: string }>(window.electronAPI.invoke('transfer:download:init-queue', { userId, userToken }))
    },

    async queueDownload(taskData: any): Promise<{ success: boolean; taskId?: string; dbId?: number; error?: string } | null> {
      return invoke<{ success: boolean; taskId?: string; dbId?: number; error?: string }>(window.electronAPI.invoke('transfer:download:queue', taskData))
    },

    async batchQueueDownload(remotePaths: string[]): Promise<{ success: boolean; successCount?: number; failedCount?: number; batchId?: string; error?: string } | null> {
      return invoke<{ success: boolean; successCount?: number; failedCount?: number; batchId?: string; error?: string }>(window.electronAPI.invoke('transfer:download:batch-queue', { remotePaths }))
    },

    async getDownloadQueue(): Promise<any> {
      return invoke<any>(window.electronAPI.invoke('transfer:download:get-queue'))
    },

    async pauseDownloadQueue(): Promise<any> {
      return invoke<any>(window.electronAPI.invoke('transfer:download:pause-queue'))
    },

    async resumeDownloadQueue(): Promise<any> {
      return invoke<any>(window.electronAPI.invoke('transfer:download:resume-queue'))
    },

    async clearDownloadQueue(): Promise<any> {
      return invoke<any>(window.electronAPI.invoke('transfer:download:clear-queue'))
    },

    async clearPendingQueue(): Promise<any> {
      return invoke<any>(window.electronAPI.invoke('transfer:download:clear-pending'))
    },

    async clearActiveQueue(): Promise<any> {
      return invoke<any>(window.electronAPI.invoke('transfer:download:clear-active'))
    },

    async resumeDownload(taskId: number): Promise<any> {
      return invoke<any>(window.electronAPI.invoke('transfer:download:resume', { taskId }))
    },

    async cancelDownload(taskId: string | number): Promise<any> {
      return invoke<any>(window.electronAPI.invoke('transfer:download:cancel', { taskId }))
    },

    async cancelAllDownloads(userId: number): Promise<any> {
      return invoke<any>(window.electronAPI.invoke('transfer:download:cancel-all', { userId }))
    },

    // ===== 任务列表 =====
    async list(userId: number) {
      return invoke(window.electronAPI.invoke('transfer:task:list', userId))
    },

    async restoreQueue(userId: number, userToken: string, username?: string) {
      return invoke(window.electronAPI.invoke('transfer:upload:restore-queue', { userId, userToken, username }))
    },

    // ===== 事件监听 =====
    onProgress(callback: (data: any) => void) {
      window.electronAPI.on('transfer:upload:progress', callback)
    },

    onCompleted(callback: (data: any) => void) {
      window.electronAPI.on('transfer:upload:completed', callback)
    },

    onFailed(callback: (data: any) => void) {
      window.electronAPI.on('transfer:upload:failed', callback)
    },

    onCancelled(callback: (data: any) => void) {
      window.electronAPI.on('transfer:upload:cancelled', callback)
    },

    onDownloadProgress(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download:progress', callback)
    },

    onDownloadCompleted(callback: (data: { taskId: string; fileName: string; savePath: string; batchId?: string; batchTotal?: number }) => void) {
      window.electronAPI.on('transfer:download:completed', callback)
    },

    onDownloadFailed(callback: (data: { taskId: string; fileName: string; error: string; batchId?: string; batchTotal?: number }) => void) {
      window.electronAPI.on('transfer:download:failed', callback)
    },

    onDownloadCancelled(callback: (data: { taskId: string | number; fileName?: string; batchId?: string; batchTotal?: number }) => void) {
      window.electronAPI.on('transfer:download:cancelled', callback)
    },

    onDownloadAuthFailed(callback: (data: any) => void) {
      window.electronAPI.on('transfer:download:auth-failed', callback)
    },

    onQueueUpdated(callback: (data: any) => void) {
      window.electronAPI.on('transfer:queue:updated', callback)
    },

    removeListener(channel: string, callback: Function) {
      window.electronAPI.removeListener(channel, callback)
    }
  }
}

export const transferRendererService = createTransferService()
