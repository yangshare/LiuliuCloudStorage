<template>
  <div class="quota-display">
    <n-spin :show="quotaStore.isLoading">
      <n-card v-if="!hasError" size="small" title="存储空间">
        <n-space vertical>
          <n-space justify="space-between" align="center">
            <n-text>配额使用情况</n-text>
            <n-tag v-if="isNearLimit" type="warning" size="small">
              空间不足
            </n-tag>
          </n-space>

          <n-progress
            type="line"
            :percentage="percentage"
            :color="progressColor"
            :show-indicator="true"
          >
            <template #default="{ percentage }">
              {{ percentage }}%
            </template>
          </n-progress>

          <n-space justify="space-between">
            <n-text depth="3" style="font-size: 12px">
              已用 {{ formatQuotaSize(quotaStore.quotaUsed) }} / 总共 {{ formatQuotaSize(quotaStore.quotaTotal) }}
            </n-text>
            <n-text depth="3" style="font-size: 12px">
              剩余 {{ formatQuotaSize(remaining) }}
            </n-text>
          </n-space>
        </n-space>
      </n-card>
      <n-alert v-else type="error" title="无法加载配额信息" size="small">
        {{ errorMessage }}
      </n-alert>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useQuotaStore } from '@/stores/quotaStore'
import { formatQuotaSize } from '@/utils/formatters'
import { useMessage } from 'naive-ui'

const quotaStore = useQuotaStore()
const message = useMessage()
const hasError = ref(false)
const errorMessage = ref('')

// 计算百分比
const percentage = computed(() => {
  if (quotaStore.quotaTotal === 0) return 0
  return Math.round((quotaStore.quotaUsed / quotaStore.quotaTotal) * 100)
})

// 计算剩余空间
const remaining = computed(() => {
  return Math.max(0, quotaStore.quotaTotal - quotaStore.quotaUsed)
})

// 是否接近限制
const isNearLimit = computed(() => percentage.value > 90)

// 进度条颜色
const progressColor = computed(() => {
  if (percentage.value > 90) return '#f56c6c' // 红色
  if (percentage.value > 70) return '#e6a23c' // 橙色
  return '#18a058' // 绿色
})

// 组件挂载时加载配额
onMounted(async () => {
  try {
    hasError.value = false
    await quotaStore.loadQuota()
  } catch (error: any) {
    hasError.value = true
    errorMessage.value = error?.message || '请检查网络或重新登录'
    message.error('加载配额信息失败')
  }
})
</script>

<style scoped>
.quota-display {
  width: 100%;
}
</style>
