import { defineStore } from 'pinia'
import { ref } from 'vue'

// 缓存时长常量（5分钟）
const CACHE_DURATION = 5 * 60 * 1000

export const useQuotaStore = defineStore('quota', () => {
  // 状态
  const quotaUsed = ref<number>(0)
  const quotaTotal = ref<number>(0)
  const isLoading = ref<boolean>(true)
  const hasLoaded = ref<boolean>(false)
  const lastUpdated = ref<number>(0) // 缓存时间戳（Story 6.2）

  /**
   * 加载配额信息（带缓存机制 - Story 6.2）
   */
  async function loadQuota(forceRefresh = false) {
    try {
      // 检查缓存（Story 6.2）
      const now = Date.now()
      if (!forceRefresh && lastUpdated.value && (now - lastUpdated.value) < CACHE_DURATION) {
        console.log('[quotaStore] 使用缓存的配额数据')
        return
      }

      isLoading.value = true

      const result = await window.electronAPI.quota.get()

      quotaUsed.value = result.quotaUsed
      quotaTotal.value = result.quotaTotal
      hasLoaded.value = true
      lastUpdated.value = now

    } catch (error) {
      console.error('加载配额失败:', error)
      // 保持hasLoaded为false，让UI显示错误状态
      hasLoaded.value = false
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 刷新配额（强制重新加载）
   */
  async function refreshQuota() {
    await loadQuota(true)
  }

  /**
   * 计算并更新配额（上传/下载后调用 - Story 6.2）
   */
  async function calculateQuota() {
    try {
      isLoading.value = true

      const result = await window.electronAPI.quota.calculate()

      quotaUsed.value = result.quotaUsed
      quotaTotal.value = result.quotaTotal
      lastUpdated.value = Date.now()

      console.log('[quotaStore] 配额已更新:', result)

    } catch (error) {
      console.error('计算配额失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 更新配额使用量（内部使用）
   */
  async function updateQuotaUsage(newQuotaUsed: number) {
    try {
      await window.electronAPI.quota.update(newQuotaUsed)
      quotaUsed.value = newQuotaUsed
    } catch (error) {
      console.error('更新配额失败:', error)
      throw error
    }
  }

  return {
    quotaUsed,
    quotaTotal,
    isLoading,
    hasLoaded,
    lastUpdated,
    loadQuota,
    refreshQuota,
    calculateQuota,
    updateQuotaUsage
  }
})
