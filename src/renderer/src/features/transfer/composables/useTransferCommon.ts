import { ref } from 'vue'
import { ElNotification } from 'element-plus'

// ==================== 常量定义 ====================

const NOTIFICATIONS_STORAGE_KEY = 'liuliu_notifications_enabled'

export function isNotificationsEnabled(): boolean {
  return localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) !== 'false'
}

const STORAGE_KEY_PANEL_COLLAPSED = 'liuliu_progress_panel_collapsed'

export function useTransferCommon() {
  // 网络状态监听
  const isOnline = ref(navigator.onLine)
  let onlineHandler: (() => void) | null = null
  let offlineHandler: (() => void) | null = null

  // UI 状态：进度面板折叠状态（持久化到 localStorage）
  const isProgressPanelCollapsed = ref<boolean>(
    localStorage.getItem(STORAGE_KEY_PANEL_COLLAPSED) === 'true'
  )

  // 监听网络状态变化
  if (typeof window !== 'undefined') {
    onlineHandler = async () => {
      isOnline.value = true
      if (isNotificationsEnabled()) {
        ElNotification.success({
          title: '网络已恢复',
          message: '正在重试失败的上传任务...',
          duration: 3000
        })
      }
    }

    offlineHandler = () => {
      isOnline.value = false
      if (isNotificationsEnabled()) {
        ElNotification.warning({
          title: '网络已断开',
          message: '上传任务已暂停，等待网络恢复...',
          duration: 5000
        })
      }
    }

    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
  }

  /**
   * 切换进度面板折叠状态
   */
  function toggleProgressPanel() {
    isProgressPanelCollapsed.value = !isProgressPanelCollapsed.value
    localStorage.setItem(STORAGE_KEY_PANEL_COLLAPSED, String(isProgressPanelCollapsed.value))
  }

  // 清理函数
  function cleanupCommon() {
    // 清理网络状态监听器
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler)
      onlineHandler = null
    }
    if (offlineHandler) {
      window.removeEventListener('offline', offlineHandler)
      offlineHandler = null
    }
  }

  return {
    isOnline,
    isProgressPanelCollapsed,
    toggleProgressPanel,
    cleanupCommon
  }
}
