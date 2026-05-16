// src/renderer/src/core/composables/useNotification.ts

import { ElNotification } from 'element-plus'

const NOTIFICATIONS_STORAGE_KEY = 'liuliu_notifications_enabled'

function isNotificationsEnabled(): boolean {
  return localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) !== 'false'
}

export function useNotification() {
  function showSuccess(title: string, message: string) {
    ElNotification.success({ title, message, duration: 4000 })
  }

  function showError(title: string, message: string) {
    ElNotification.error({ title, message, duration: 5000 })
  }

  function showWarning(title: string, message: string) {
    ElNotification.warning({ title, message, duration: 5000 })
  }

  function showInfo(title: string, message: string) {
    ElNotification.info({ title, message, duration: 3000 })
  }

  function showSystemNotification(title: string, body: string) {
    if (!isNotificationsEnabled()) return
    window.electronAPI?.notification?.show({ title, body })
  }

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showSystemNotification
  }
}
