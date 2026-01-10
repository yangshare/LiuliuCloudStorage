<template>
  <div class="download-queue-panel">
    <n-card title="下载队列">
      <template #header-extra>
        <n-space>
          <n-button
            v-if="isDownloadQueuePaused"
            type="primary"
            size="small"
            @click="handleResumeQueue"
          >
            恢复队列
          </n-button>
          <n-button
            v-else
            type="warning"
            size="small"
            @click="handlePauseQueue"
          >
            暂停队列
          </n-button>
          <n-button
            size="small"
            :disabled="completedDownloads.length === 0 && failedDownloads.length === 0"
            @click="handleClearQueue"
          >
            清空已完成
          </n-button>
        </n-space>
      </template>

      <n-tabs type="line" animated>
        <!-- 等待中 -->
        <n-tab-pane name="pending" tab="等待中">
          <template #tab>
            <n-space align="center">
              <span>等待中</span>
              <n-tag size="small" :type="downloadQueue.length > 0 ? 'warning' : 'default'">
                {{ downloadQueue.length }}
              </n-tag>
            </n-space>
          </template>
          <n-empty
            v-if="downloadQueue.length === 0"
            description="暂无等待任务"
            style="padding: 40px 0"
          />
          <n-list v-else hoverable clickable>
            <n-list-item v-for="task in downloadQueue" :key="task.id">
              <template #prefix>
                <n-icon size="20" color="#2080f0">
                  <ClockIcon />
                </n-icon>
              </template>
              <n-thing :title="task.fileName">
                <template #description>
                  <n-text depth="3" style="font-size: 12px">
                    {{ formatBytes(task.fileSize) }}
                  </n-text>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-tab-pane>

        <!-- 下载中 -->
        <n-tab-pane name="active" tab="下载中">
          <template #tab>
            <n-space align="center">
              <span>下载中</span>
              <n-tag size="small" :type="activeDownloads.length > 0 ? 'info' : 'default'">
                {{ activeDownloads.length }}
              </n-tag>
            </n-space>
          </template>
          <n-empty
            v-if="activeDownloads.length === 0"
            description="暂无下载任务"
            style="padding: 40px 0"
          />
          <n-list v-else hoverable clickable>
            <n-list-item v-for="task in activeDownloads" :key="task.id">
              <template #prefix>
                <n-icon size="20" color="#18a058">
                  <DownloadIcon />
                </n-icon>
              </template>
              <n-thing :title="task.fileName">
                <template #description>
                  <n-progress
                    type="line"
                    :percentage="getTaskProgress(task.id)"
                    :indicator-placeholder="`${getTaskProgress(task.id)}%`"
                    style="margin-bottom: 8px"
                  />
                  <n-text depth="3" style="font-size: 12px">
                    {{ formatBytes(getTaskDownloadedBytes(task.id)) }} / {{ formatBytes(task.fileSize) }}
                    · {{ formatSpeed(getTaskSpeed(task.id)) }}
                  </n-text>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-tab-pane>

        <!-- 已完成 -->
        <n-tab-pane name="completed" tab="已完成">
          <template #tab>
            <n-space align="center">
              <span>已完成</span>
              <n-tag size="small" :type="completedDownloads.length > 0 ? 'success' : 'default'">
                {{ completedDownloads.length }}
              </n-tag>
            </n-space>
          </template>
          <n-empty
            v-if="completedDownloads.length === 0"
            description="暂无完成任务"
            style="padding: 40px 0"
          />
          <n-list v-else hoverable clickable>
            <n-list-item v-for="task in completedDownloads" :key="task.id">
              <template #prefix>
                <n-icon size="20" color="#18a058">
                  <CheckIcon />
                </n-icon>
              </template>
              <n-thing :title="task.fileName">
                <template #description>
                  <n-text depth="3" style="font-size: 12px">
                    {{ formatBytes(task.fileSize) }}
                  </n-text>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-tab-pane>

        <!-- 失败 -->
        <n-tab-pane name="failed" tab="失败">
          <template #tab>
            <n-space align="center">
              <span>失败</span>
              <n-tag size="small" :type="failedDownloads.length > 0 ? 'error' : 'default'">
                {{ failedDownloads.length }}
              </n-tag>
            </n-space>
          </template>
          <n-empty
            v-if="failedDownloads.length === 0"
            description="暂无失败任务"
            style="padding: 40px 0"
          />
          <n-list v-else hoverable clickable>
            <n-list-item v-for="task in failedDownloads" :key="task.id">
              <template #prefix>
                <n-icon size="20" color="#d03050">
                  <ErrorIcon />
                </n-icon>
              </template>
              <n-thing :title="task.fileName">
                <template #description>
                  <n-text type="error" style="font-size: 12px">
                    {{ task.error }}
                  </n-text>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  NCard,
  NTabs,
  NTabPane,
  NList,
  NListItem,
  NThing,
  NProgress,
  NEmpty,
  NButton,
  NSpace,
  NIcon,
  NTag,
  NText,
  useNotification
} from 'naive-ui'
import {
  Clock as ClockIcon,
  DownloadArrow as DownloadIcon,
  Check as CheckIcon,
  CloseCircle as ErrorIcon
} from '@vicons/ionicons5'
import { useTransferStore } from '@/stores/transferStore'

const transferStore = useTransferStore()
const notification = useNotification()

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
    notification.success({
      title: '队列已暂停',
      description: '下载队列已暂停，不会启动新的下载任务'
    })
  } else {
    notification.error({
      title: '暂停失败',
      description: result.error || '暂停下载队列失败'
    })
  }
}

async function handleResumeQueue() {
  const result = await transferStore.resumeDownloadQueue()
  if (result.success) {
    notification.success({
      title: '队列已恢复',
      description: '下载队列已恢复，将自动启动等待中的任务'
    })
  } else {
    notification.error({
      title: '恢复失败',
      description: result.error || '恢复下载队列失败'
    })
  }
}

async function handleClearQueue() {
  const result = await transferStore.clearDownloadQueue()
  if (result.success) {
    notification.success({
      title: '队列已清空',
      description: `已清空 ${completedDownloads.value.length} 个已完成任务和 ${failedDownloads.value.length} 个失败任务`
    })
  } else {
    notification.error({
      title: '清空失败',
      description: result.error || '清空下载队列失败'
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
</style>
