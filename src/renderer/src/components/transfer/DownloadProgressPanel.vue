<template>
  <div class="download-progress-panel">
    <n-card
      :title="transferStore.isProgressPanelCollapsed ? '' : '下载进度'"
      size="small"
      :bordered="false"
      :class="{ 'collapsed': transferStore.isProgressPanelCollapsed }"
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
          <n-button
            text
            @click="transferStore.toggleProgressPanel"
            style="padding: 4px"
          >
            <n-icon size="18">
              <ChevronDownIcon v-if="!transferStore.isProgressPanelCollapsed" />
              <ChevronUpIcon v-else />
            </n-icon>
          </n-button>
        </n-space>
      </template>

      <!-- 折叠状态：紧凑摘要 -->
      <div v-if="transferStore.isProgressPanelCollapsed" class="collapsed-summary" @click="transferStore.toggleProgressPanel">
        <n-text v-if="activeCount === 0" depth="3" style="font-size: 13px">
          暂无下载任务
        </n-text>
        <n-space v-else align="center" :size="12">
          <n-text style="font-size: 13px">
            {{ activeCount }} 个任务下载中
          </n-text>
          <n-divider vertical />
          <n-text depth="3" style="font-size: 13px">
            总速度 {{ formatSpeed(totalSpeed) }}
          </n-text>
          <n-divider vertical />
          <n-progress
            type="line"
            :percentage="totalProgress"
            :show-indicator="false"
            :height="6"
            color="#2080f0"
            style="flex: 1; min-width: 100px"
          />
        </n-space>
      </div>

      <!-- 展开状态：完整内容 -->
      <template v-else>
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
              color="#2080f0"
            />
            <n-text depth="3" style="font-size: 12px">
              {{ activeCount }} 个任务下载中 · 总速度 {{ formatSpeed(totalSpeed) }}
            </n-text>
          </n-space>
        </div>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NProgress, NEmpty, NSpace, NText, NBadge, NIcon, NDivider, NButton } from 'naive-ui'
import { Download as DownloadIcon, ChevronUp as ChevronUpIcon, ChevronDown as ChevronDownIcon } from '@vicons/ionicons5'
import { useTransferStore } from '@/stores/transferStore'
import { formatSpeed } from '@/utils/formatters'
import DownloadProgressItem from './DownloadProgressItem.vue'
import type { DownloadProgressData } from './DownloadProgressItem.vue'

const transferStore = useTransferStore()

const activeProgress = computed<DownloadProgressData[]>(() => {
  // 优先使用 activeDownloads，如果为空则从 downloadQueue 中提取
  let tasks: DownloadProgressData[] = []

  if (transferStore.activeDownloads.length > 0) {
    tasks = transferStore.activeDownloads.map(task => ({
      taskId: task.id,
      fileName: task.fileName || '未知文件',
      downloadedBytes: task.downloadedBytes || 0,
      totalBytes: task.fileSize || 0,
      percentage: task.progress || 0,
      speed: task.speed || 0,
      eta: calculateETA(task.downloadedBytes || 0, task.fileSize || 0, task.speed || 0),
      status: (task.status || 'pending') as 'pending' | 'in_progress' | 'completed' | 'failed',
      errorMessage: task.error
    }))
  } else {
    // 备用方案：从 downloadQueue 中提取进行中和等待中的任务
    tasks = transferStore.downloadQueue
      .filter(task => task.status === 'in_progress' || task.status === 'pending')
      .map(task => ({
        taskId: task.id,
        fileName: task.fileName || '未知文件',
        downloadedBytes: task.downloadedBytes || 0,
        totalBytes: task.fileSize || 0,
        percentage: task.progress || 0,
        speed: task.speed || 0,
        eta: calculateETA(task.downloadedBytes || 0, task.fileSize || 0, task.speed || 0),
        status: (task.status || 'pending') as 'pending' | 'in_progress' | 'completed' | 'failed',
        errorMessage: task.error
      }))
  }

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

/* 折叠状态样式 */
.collapsed-summary {
  padding: 8px 0;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.collapsed-summary:hover {
  background-color: var(--n-color-hover);
  border-radius: 4px;
}

/* 卡片过渡动画 */
.n-card {
  transition: all 0.3s ease-in-out;
}

.n-card.collapsed :deep(.n-card__content) {
  padding: 8px 20px;
}
</style>
