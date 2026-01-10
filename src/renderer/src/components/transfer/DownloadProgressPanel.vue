<template>
  <div class="download-progress-panel">
    <n-card
      title="下载进度"
      size="small"
      :bordered="false"
      style="margin-bottom: 16px"
    >
      <template #header-extra>
        <n-space align="center">
          <n-badge :value="activeCount" :max="99">
            <n-icon size="20" color="#18a058">
              <DownloadIcon />
            </n-icon>
          </n-badge>
          <n-text depth="3" style="font-size: 12px">
            {{ formatSpeed(totalSpeed) }}
          </n-text>
        </n-space>
      </template>

      <!-- 空状态 -->
      <n-empty
        v-if="activeCount === 0"
        description="暂无下载任务"
        size="small"
        style="padding: 40px 0"
      />

      <!-- 进度列表 -->
      <div v-else class="progress-list">
        <DownloadProgressItem
          v-for="progress in activeProgress"
          :key="progress.taskId"
          :progress="progress"
        />
      </div>

      <!-- 总进度（多个任务时显示） -->
      <div v-if="activeCount > 1" class="total-progress">
        <n-divider />
        <n-space vertical :size="8">
          <n-text depth="3" style="font-size: 12px">
            总进度
          </n-text>
          <n-progress
            type="line"
            :percentage="totalProgress"
            :indicator-placement="'inside'"
            :height="20"
            :border-radius="4"
            :color="getProgressColor(totalProgress)"
          />
          <n-text depth="3" style="font-size: 12px">
            {{ activeCount }} 个任务下载中 · 总速度 {{ formatSpeed(totalSpeed) }}
          </n-text>
        </n-space>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NProgress, NEmpty, NSpace, NText, NBadge, NIcon, NDivider } from 'naive-ui'
import { Download as DownloadIcon } from '@vicons/ionicons5'
import { useTransferStore } from '@/stores/transferStore'
import { formatSpeed } from '@/utils/formatters'
import DownloadProgressItem from './DownloadProgressItem.vue'
import type { DownloadProgressData } from './DownloadProgressItem.vue'

const transferStore = useTransferStore()

const activeProgress = computed<DownloadProgressData[]>(() => {
  // 从 downloadQueue 中提取进行中的任务并添加进度信息
  const tasks = transferStore.activeDownloads.map(task => ({
    taskId: task.id,
    fileName: task.fileName,
    downloadedBytes: task.downloadedBytes,
    totalBytes: task.fileSize,
    percentage: task.progress,
    speed: task.speed,
    eta: calculateETA(task.downloadedBytes, task.fileSize, task.speed),
    status: task.status as 'pending' | 'in_progress' | 'completed' | 'failed'
  }))

  return tasks
})

const activeCount = computed(() => activeProgress.value.length)

const totalSpeed = computed(() => {
  return activeProgress.value.reduce((sum, p) => sum + p.speed, 0)
})

const totalProgress = computed(() => {
  if (activeProgress.value.length === 0) return 0

  const totalDownloaded = activeProgress.value.reduce((sum, p) => sum + p.downloadedBytes, 0)
  const totalSize = activeProgress.value.reduce((sum, p) => sum + p.totalBytes, 0)

  if (totalSize === 0) return 0
  return Math.round((totalDownloaded / totalSize) * 100)
})

function calculateETA(downloadedBytes: number, totalBytes: number, speed: number): number {
  if (speed === 0 || totalBytes === 0) return Infinity
  const remainingBytes = totalBytes - downloadedBytes
  return remainingBytes / speed
}

function getProgressColor(percentage: number): string {
  if (percentage < 30) return '#f56c6c'
  if (percentage < 70) return '#e6a23c'
  return '#18a058'
}
</script>

<style scoped>
.download-progress-panel {
  width: 100%;
}

.progress-list {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

.progress-list::-webkit-scrollbar {
  width: 6px;
}

.progress-list::-webkit-scrollbar-thumb {
  background-color: var(--n-scrollbar-color);
  border-radius: 3px;
}

.total-progress {
  margin-top: 12px;
}
</style>
