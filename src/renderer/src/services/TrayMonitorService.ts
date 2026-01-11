/**
 * 托盘监控服务
 * 负责监控传输状态并更新托盘图标
 */

import { watch } from 'vue'
import { useTransferStore } from '@/stores/transferStore'

export class TrayMonitorService {
  private static instance: TrayMonitorService | null = null
  private isMonitoring = false

  private constructor() {}

  static getInstance(): TrayMonitorService {
    if (!TrayMonitorService.instance) {
      TrayMonitorService.instance = new TrayMonitorService()
    }
    return TrayMonitorService.instance
  }

  /**
   * 开始监控传输状态
   */
  startMonitoring(): void {
    if (this.isMonitoring) return

    const transferStore = useTransferStore()

    // 监控上传队列状态变化
    watch(
      () => [
        transferStore.uploadQueue.filter(t => t.status === 'in_progress').length,
        transferStore.downloadQueue.filter(t => t.status === 'in_progress').length
      ],
      ([activeUploads, activeDownloads]) => {
        this.updateTrayStatus(
          activeUploads > 0 || activeDownloads > 0,
          activeUploads,
          activeDownloads
        )
      },
      { immediate: true, deep: true }
    )

    // 监控上传队列变化
    watch(
      () => transferStore.uploadQueue,
      (queue) => {
        const activeUploads = queue.filter(t => t.status === 'in_progress').length
        const activeDownloads = transferStore.downloadQueue.filter(t => t.status === 'in_progress').length
        this.updateTrayStatus(
          activeUploads > 0 || activeDownloads > 0,
          activeUploads,
          activeDownloads
        )
      },
      { deep: true }
    )

    // 监控下载队列变化
    watch(
      () => transferStore.downloadQueue,
      (queue) => {
        const activeUploads = transferStore.uploadQueue.filter(t => t.status === 'in_progress').length
        const activeDownloads = queue.filter(t => t.status === 'in_progress').length
        this.updateTrayStatus(
          activeUploads > 0 || activeDownloads > 0,
          activeUploads,
          activeDownloads
        )
      },
      { deep: true }
    )

    this.isMonitoring = true
  }

  /**
   * 更新托盘状态
   */
  private async updateTrayStatus(
    isTransferring: boolean,
    uploadCount: number,
    downloadCount: number
  ): Promise<void> {
    try {
      if (window.electronAPI?.tray) {
        // 更新传输状态图标
        await window.electronAPI.tray.updateTransferStatus(isTransferring)

        // 更新传输任务数量
        await window.electronAPI.tray.updateTransferCounts(uploadCount, downloadCount)
      }
    } catch (error) {
      console.error('[TrayMonitorService] 更新托盘状态失败:', error)
    }
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    this.isMonitoring = false
  }
}

// 导出单例
export const trayMonitorService = TrayMonitorService.getInstance()
