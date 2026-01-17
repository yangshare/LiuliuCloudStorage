<template>
  <div class="download-queue-panel">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>下载队列</span>
          <el-space :size="8">
            <el-button
              v-if="isDownloadQueuePaused"
              type="primary"
              size="small"
              @click="handleResumeQueue"
            >
              恢复队列
            </el-button>
            <el-button
              v-else
              type="warning"
              size="small"
              @click="handlePauseQueue"
            >
              暂停队列
            </el-button>
            <el-button
              size="small"
              :disabled="completedDownloads.length === 0 && failedDownloads.length === 0"
              @click="handleClearQueue"
            >
              清空已完成
            </el-button>
          </el-space>
        </div>
      </template>

      <el-tabs type="card">
        <!-- 等待中 -->
        <el-tab-pane label="等待中" name="pending">
          <template #label>
            <el-space align="center" :size="8">
              <span>等待中</span>
              <el-tag size="small" :type="downloadQueue.length > 0 ? 'warning' : 'info'">
                {{ downloadQueue.length }}
              </el-tag>
            </el-space>
          </template>
          <el-empty v-if="downloadQueue.length === 0" description="暂无等待任务" />
          <div v-else class="task-list">
            <div v-for="task in downloadQueue" :key="task.id" class="task-item">
              <el-icon :size="20" color="#2080f0">
                <Clock />
              </el-icon>
              <div class="task-content">
                <div class="task-title">{{ task.fileName }}</div>
                <el-text type="info" size="small">
                  {{ formatBytes(task.fileSize) }}
                </el-text>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 下载中 -->
        <el-tab-pane label="下载中" name="active">
          <template #label>
            <el-space align="center" :size="8">
              <span>下载中</span>
              <el-tag size="small" :type="activeDownloads.length > 0 ? 'primary' : 'info'">
                {{ activeDownloads.length }}
              </el-tag>
            </el-space>
          </template>
          <el-empty v-if="activeDownloads.length === 0" description="暂无下载任务" />
          <div v-else class="task-list">
            <div v-for="task in activeDownloads" :key="task.id" class="task-item">
              <el-icon :size="20" color="#67c23a">
                <Download />
              </el-icon>
              <div class="task-content">
                <div class="task-title">{{ task.fileName }}</div>
                <el-progress
                  :percentage="getTaskProgress(task.id)"
                  :format="() => `${getTaskProgress(task.id)}%`"
                />
                <el-text type="info" size="small">
                  {{ formatBytes(getTaskDownloadedBytes(task.id)) }} / {{ formatBytes(task.fileSize) }}
                  · {{ formatSpeed(getTaskSpeed(task.id)) }}
                </el-text>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 已完成 -->
        <el-tab-pane label="已完成" name="completed">
          <template #label>
            <el-space align="center" :size="8">
              <span>已完成</span>
              <el-tag size="small" :type="completedDownloads.length > 0 ? 'success' : 'info'">
                {{ completedDownloads.length }}
              </el-tag>
            </el-space>
          </template>
          <el-empty v-if="completedDownloads.length === 0" description="暂无完成任务" />
          <div v-else class="task-list">
            <div v-for="task in completedDownloads" :key="task.id" class="task-item">
              <el-icon :size="20" color="#67c23a">
                <Check />
              </el-icon>
              <div class="task-content">
                <div class="task-title">{{ task.fileName }}</div>
                <el-text type="info" size="small">
                  {{ formatBytes(task.fileSize) }}
                </el-text>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 失败 -->
        <el-tab-pane label="失败" name="failed">
          <template #label>
            <el-space align="center" :size="8">
              <span>失败</span>
              <el-tag size="small" :type="failedDownloads.length > 0 ? 'danger' : 'info'">
                {{ failedDownloads.length }}
              </el-tag>
            </el-space>
          </template>
          <el-empty v-if="failedDownloads.length === 0" description="暂无失败任务" />
          <div v-else class="task-list">
            <div v-for="task in failedDownloads" :key="task.id" class="task-item">
              <el-icon :size="20" color="#f56c6c">
                <CircleClose />
              </el-icon>
              <div class="task-content">
                <div class="task-title">{{ task.fileName }}</div>
                <el-text type="danger" size="small">
                  {{ task.error }}
                </el-text>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElCard, ElTabs, ElTabPane, ElProgress, ElEmpty, ElButton, ElIcon, ElTag, ElText, ElSpace, ElNotification } from 'element-plus'
import { Clock, Download, Check, CircleClose } from '@element-plus/icons-vue'
import { useTransferStore } from '@/stores/transferStore'

const transferStore = useTransferStore()

const downloadQueue = computed(() => transferStore.downloadQueue)
const activeDownloads = computed(() => transferStore.activeDownloads)
const completedDownloads = computed(() => transferStore.completedDownloads)
const failedDownloads = computed(() => transferStore.failedDownloads)
const isDownloadQueuePaused = computed(() => transferStore.isDownloadQueuePaused)
const downloadProgressMap = computed(() => transferStore.downloadProgressMap)

// 从进度 Map 获取任务进度信息
function getTaskProgress(taskId: string): number {
  const progress = downloadProgressMap.value.get(taskId)
  return progress?.percentage || 0
}

function getTaskDownloadedBytes(taskId: string): number {
  const progress = downloadProgressMap.value.get(taskId)
  return progress?.downloadedBytes || 0
}

function getTaskSpeed(taskId: string): number {
  const progress = downloadProgressMap.value.get(taskId)
  return progress?.speed || 0
}

async function handlePauseQueue() {
  const result = await transferStore.pauseDownloadQueue()
  if (result.success) {
    ElNotification.success({
      title: '队列已暂停',
      message: '下载队列已暂停，不会启动新的下载任务'
    })
  } else {
    ElNotification.error({
      title: '暂停失败',
      message: result.error || '暂停下载队列失败'
    })
  }
}

async function handleResumeQueue() {
  const result = await transferStore.resumeDownloadQueue()
  if (result.success) {
    ElNotification.success({
      title: '队列已恢复',
      message: '下载队列已恢复，将自动启动等待中的任务'
    })
  } else {
    ElNotification.error({
      title: '恢复失败',
      message: result.error || '恢复下载队列失败'
    })
  }
}

async function handleClearQueue() {
  const result = await transferStore.clearDownloadQueue()
  if (result.success) {
    ElNotification.success({
      title: '队列已清空',
      message: `已清空 ${completedDownloads.value.length} 个已完成任务和 ${failedDownloads.value.length} 个失败任务`
    })
  } else {
    ElNotification.error({
      title: '清空失败',
      message: result.error || '清空下载队列失败'
    })
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + '/s'
}
</script>

<style scoped>
.download-queue-panel {
  padding: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  transition: all 0.3s;
}

.task-item:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-fill-color-lighter);
}

.task-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.task-title {
  font-weight: 500;
  word-break: break-all;
}

:deep(.el-progress) {
  margin-bottom: 4px;
}
</style>
