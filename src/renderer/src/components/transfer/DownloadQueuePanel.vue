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
            <el-button
              size="small"
              type="danger"
              :disabled="downloadQueue.length === 0"
              @click="handleClearPendingQueue"
            >
              清空等待
            </el-button>
            <el-button
              size="small"
              type="danger"
              :disabled="activeDownloads.length === 0"
              @click="handleClearActiveQueue"
            >
              清空下载中
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
          <template v-else>
            <div class="task-list">
              <div v-for="task in pagedPending" :key="task.id" class="task-item">
                <el-icon :size="20" color="#2080f0"><Clock /></el-icon>
                <div class="task-content">
                  <div class="task-title">{{ task.fileName }}</div>
                  <div class="task-meta">
                    <el-text type="info" size="small">{{ formatBytes(task.fileSize) }}</el-text>
                  </div>
                </div>
              </div>
            </div>
            <el-pagination
              v-if="downloadQueue.length > PAGE_SIZE"
              v-model:current-page="pendingPage"
              :page-size="PAGE_SIZE"
              :total="downloadQueue.length"
              layout="prev, pager, next"
              class="task-pagination"
            />
          </template>
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
                <div class="task-meta">
                  <el-text type="info" size="small">
                    {{ formatBytes(getTaskDownloadedBytes(task.id)) }} / {{ formatBytes(task.fileSize) }}
                  </el-text>
                  <el-text type="info" size="small">{{ formatSpeed(getTaskSpeed(task.id)) }}</el-text>
                </div>
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
          <template v-else>
            <div class="task-list">
              <div v-for="task in pagedCompleted" :key="task.id" class="task-item">
                <el-icon :size="20" color="#67c23a"><Check /></el-icon>
                <div class="task-content">
                  <div class="task-title">{{ task.fileName }}</div>
                  <div class="task-meta">
                    <el-text type="info" size="small">{{ formatBytes(task.fileSize) }}</el-text>
                  </div>
                </div>
              </div>
            </div>
            <el-pagination
              v-if="completedDownloads.length > PAGE_SIZE"
              v-model:current-page="completedPage"
              :page-size="PAGE_SIZE"
              :total="completedDownloads.length"
              layout="prev, pager, next"
              class="task-pagination"
            />
          </template>
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
          <template v-else>
            <div class="task-list">
              <div v-for="task in pagedFailed" :key="task.id" class="task-item">
                <el-icon :size="20" color="#f56c6c"><CircleClose /></el-icon>
                <div class="task-content">
                  <div class="task-title">{{ task.fileName }}</div>
                  <el-text type="danger" size="small">{{ task.error }}</el-text>
                </div>
              </div>
            </div>
            <el-pagination
              v-if="failedDownloads.length > PAGE_SIZE"
              v-model:current-page="failedPage"
              :page-size="PAGE_SIZE"
              :total="failedDownloads.length"
              layout="prev, pager, next"
              class="task-pagination"
            />
          </template>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElCard, ElTabs, ElTabPane, ElProgress, ElEmpty, ElButton, ElIcon, ElTag, ElText, ElSpace, ElNotification, ElPagination } from 'element-plus'
import { Clock, Download, Check, CircleClose } from '@element-plus/icons-vue'
import { useTransferStore } from '@/stores/transferStore'

const transferStore = useTransferStore()

const downloadQueue = computed(() => transferStore.downloadQueue)
const activeDownloads = computed(() => transferStore.activeDownloads)
const completedDownloads = computed(() => transferStore.completedDownloads)
const failedDownloads = computed(() => transferStore.failedDownloads)
const isDownloadQueuePaused = computed(() => transferStore.isDownloadQueuePaused)
const downloadProgressMap = computed(() => transferStore.downloadProgressMap)

const PAGE_SIZE = 20
const pendingPage = ref(1)
const completedPage = ref(1)
const failedPage = ref(1)

// 页码越界时修正（避免数据减少后停留在空白页）
function clampPage(len: number, page: { value: number }) {
  const max = Math.ceil(len / PAGE_SIZE) || 1
  if (page.value > max) page.value = max
}
watch(() => downloadQueue.value.length, (len) => clampPage(len, pendingPage))
watch(() => completedDownloads.value.length, (len) => clampPage(len, completedPage))
watch(() => failedDownloads.value.length, (len) => clampPage(len, failedPage))

function paginate<T>(list: T[], page: number) {
  const start = (page - 1) * PAGE_SIZE
  return list.slice(start, start + PAGE_SIZE)
}

const pagedPending = computed(() => paginate(downloadQueue.value, pendingPage.value))
const pagedCompleted = computed(() => paginate(completedDownloads.value, completedPage.value))
const pagedFailed = computed(() => paginate(failedDownloads.value, failedPage.value))

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

async function handleClearPendingQueue() {
  const result = await transferStore.clearPendingQueue()
  if (result.success) {
    ElNotification.success({ title: '已清空', message: '等待中的任务已全部取消' })
  } else {
    ElNotification.error({ title: '清空失败', message: result.error || '清空等待队列失败' })
  }
}

async function handleClearActiveQueue() {
  const result = await transferStore.clearActiveQueue()
  if (result.success) {
    ElNotification.success({ title: '已清空', message: '下载中的任务已全部取消' })
  } else {
    ElNotification.error({ title: '清空失败', message: result.error || '清空下载队列失败' })
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

/* 卡片 - 网易云风格 */
:deep(.el-card) {
  border-radius: var(--radius-lg) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  box-shadow: var(--shadow-md) !important;
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

:deep(.el-card__header) {
  background: rgba(245, 245, 245, 0.5) !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0 !important;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header span {
  font-size: 16px;
  font-weight: 600;
  color: var(--netease-gray-7);
}

/* Tabs 样式 */
:deep(.el-tabs) {
  background: transparent;
}

:deep(.el-tabs--card) {
  border: none;
}

:deep(.el-tabs__header) {
  margin: 0 0 16px 0;
  border: none;
}

:deep(.el-tabs__nav) {
  border: none;
  border-radius: var(--radius-md);
  background: rgba(245, 245, 245, 0.5);
  padding: 4px;
}

:deep(.el-tabs__item) {
  border: none !important;
  border-radius: var(--radius-sm) !important;
  transition: all 0.2s ease;
}

:deep(.el-tabs__item:hover) {
  color: var(--netease-red) !important;
}

:deep(.el-tabs__item.is-active) {
  background: var(--netease-red) !important;
  color: #fff !important;
}

:deep(.el-tabs__content) {
  padding: 0;
}

/* 标签样式 */
:deep(.el-tag) {
  border-radius: var(--radius-sm);
  font-weight: 500;
}

:deep(.el-tag--warning) {
  background: rgba(250, 140, 22, 0.1) !important;
  border-color: rgba(250, 140, 22, 0.2) !important;
  color: #FA8C16 !important;
}

:deep(.el-tag--primary) {
  background: rgba(194, 12, 12, 0.1) !important;
  border-color: rgba(194, 12, 12, 0.2) !important;
  color: var(--netease-red) !important;
}

:deep(.el-tag--success) {
  background: rgba(46, 204, 113, 0.1) !important;
  border-color: rgba(46, 204, 113, 0.2) !important;
  color: var(--netease-green) !important;
}

:deep(.el-tag--danger) {
  background: rgba(194, 12, 12, 0.1) !important;
  border-color: rgba(194, 12, 12, 0.2) !important;
  color: var(--netease-red) !important;
}

:deep(.el-tag--info) {
  background: rgba(153, 153, 153, 0.1) !important;
  border-color: rgba(153, 153, 153, 0.2) !important;
  color: var(--netease-gray-5) !important;
}

/* 按钮样式 */
:deep(.el-button--primary) {
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
  border: none !important;
  border-radius: var(--radius-sm) !important;
}

:deep(.el-button--warning) {
  background: linear-gradient(135deg, #FA8C16 0%, #F9A825 100%) !important;
  border: none !important;
  border-radius: var(--radius-sm) !important;
}

:deep(.el-button--default) {
  border-radius: var(--radius-sm) !important;
}

/* 任务列表 */
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
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.task-item:hover {
  border-color: var(--netease-red);
  background: rgba(255, 255, 255, 0.7);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
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
  color: var(--netease-gray-7);
  font-size: 14px;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 等待中/已完成只有一个 el-text，推到右边 */
.task-meta :deep(.el-text):only-child {
  margin-left: auto;
}

/* 进度条 - 网易云红 */
:deep(.el-progress) {
  margin-bottom: 4px;
}

:deep(.el-progress-bar__outer) {
  background-color: rgba(0, 0, 0, 0.06) !important;
  border-radius: 4px !important;
}

:deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
  border-radius: 4px !important;
}

.task-pagination {
  margin-top: 12px;
  justify-content: center;
}

/* 空状态 */
:deep(.el-empty) {
  padding: 32px 0;
}

:deep(.el-empty__description) {
  color: var(--netease-gray-5);
}

/* 文本样式 */
:deep(.el-text--info) {
  color: var(--netease-gray-5) !important;
}

:deep(.el-text--danger) {
  color: var(--netease-red) !important;
}
</style>
