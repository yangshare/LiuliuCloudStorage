<template>
  <div class="download-progress-panel">
    <el-card
      shadow="never"
      :class="{ 'collapsed': transferStore.isProgressPanelCollapsed }"
    >
      <template #header>
        <div class="card-header">
          <el-space :size="12">
            <el-badge :value="activeCount" :max="99" type="primary">
              <el-icon :size="20" color="#67c23a">
                <Download />
              </el-icon>
            </el-badge>
            <el-text v-if="!transferStore.isProgressPanelCollapsed" type="info" size="small">
              {{ formatSpeed(totalSpeed) }}
            </el-text>
          </el-space>
          <el-button
            link
            @click="transferStore.toggleProgressPanel"
            style="padding: 4px"
          >
            <el-icon :size="18">
              <ArrowDown v-if="!transferStore.isProgressPanelCollapsed" />
              <ArrowUp v-else />
            </el-icon>
          </el-button>
        </div>
      </template>

      <!-- 折叠状态：紧凑摘要 -->
      <div v-if="transferStore.isProgressPanelCollapsed" class="collapsed-summary" @click="transferStore.toggleProgressPanel">
        <el-text v-if="activeCount === 0" type="info" size="small">
          暂无下载任务
        </el-text>
        <el-space v-else align="center" :size="12">
          <el-text size="small">
            {{ activeCount }} 个任务下载中
          </el-text>
          <el-divider direction="vertical" />
          <el-text type="info" size="small">
            总速度 {{ formatSpeed(totalSpeed) }}
          </el-text>
          <el-divider direction="vertical" />
          <el-progress
            :percentage="totalProgress"
            :show-text="false"
            :stroke-width="6"
            color="#409eff"
            style="flex: 1; min-width: 100px"
          />
        </el-space>
      </div>

      <!-- 展开状态：完整内容 -->
      <template v-else>
        <!-- 空状态 -->
        <el-empty
          v-if="activeCount === 0"
          description="暂无下载任务"
          :image-size="80"
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
          <el-divider />
          <el-space direction="vertical" :size="8" style="width: 100%">
            <el-text type="info" size="small">
              总进度
            </el-text>
            <el-progress
              :percentage="totalProgress"
              :stroke-width="20"
              color="#409eff"
            />
            <el-text type="info" size="small">
              {{ activeCount }} 个任务下载中 · 总速度 {{ formatSpeed(totalSpeed) }}
            </el-text>
          </el-space>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElCard, ElProgress, ElEmpty, ElText, ElBadge, ElIcon, ElDivider, ElButton, ElSpace } from 'element-plus'
import { Download, ArrowUp, ArrowDown } from '@element-plus/icons-vue'
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  background-color: var(--el-border-color-darker);
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
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapsed-summary:hover {
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  padding: 8px 12px;
  margin: -8px -12px;
}

/* 卡片过渡动画 */
.el-card {
  transition: all 0.3s ease-in-out;
}

.el-card.collapsed :deep(.el-card__body) {
  padding: 8px 20px;
}
</style>
