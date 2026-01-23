<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElContainer, ElMain, ElCard, ElButton, ElIcon, ElText, ElDrawer, ElDropdown, ElDropdownMenu, ElDropdownItem, ElBadge } from 'element-plus'
import { Upload, Folder, List, Setting, Grid, Refresh, Document, FolderOpened, Memo, ArrowLeft, Download } from '@element-plus/icons-vue'
import FileList from '../components/file/FileList.vue'
import Breadcrumb from '../components/file/Breadcrumb.vue'
import FileDetail from '../components/file/FileDetail.vue'
import OfflineBanner from '../components/common/OfflineBanner.vue'
import TransferProgressList from '../components/transfer/TransferProgressList.vue'
import DownloadQueuePanel from '../components/transfer/DownloadQueuePanel.vue'
import CreateFolderModal from '../components/file/CreateFolderModal.vue'
import BatchActionToolbar from '../components/file/BatchActionToolbar.vue'
import UpdateButton from '../components/common/UpdateButton.vue'
import { useFileStore } from '../stores/fileStore'
import { useTransferStore } from '../stores/transferStore'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const fileStore = useFileStore()
const transferStore = useTransferStore()
const authStore = useAuthStore()
const showCreateFolderModal = ref(false)
const showFileInput = ref(false)
const showQueueDrawer = ref(false)

// 隐藏的文件输入元素
const fileInputRef = ref<HTMLInputElement | null>(null)

const uploadQueue = computed(() => transferStore.uploadQueue)
const downloadQueue = computed(() => transferStore.downloadQueue)

// 计算活跃下载数量（用于徽章显示）
const activeDownloadsCount = computed(() => {
  const activeCount = transferStore.activeDownloads.length
  const pendingCount = transferStore.downloadQueue.filter(
    t => t.status === 'in_progress' || t.status === 'pending'
  ).length
  return activeCount + pendingCount
})

const showOverlay = ref(false)
const dragCount = ref(0)
let dragCounter = 0

function handleWindowDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  if (dragCounter === 1 && fileStore.isOnline) {
    showOverlay.value = true
    if (e.dataTransfer?.items) {
      dragCount.value = e.dataTransfer.items.length
    }
  }
}

function handleWindowDragLeave(e: DragEvent) {
  e.preventDefault()
  dragCounter--
  if (dragCounter === 0) {
    showOverlay.value = false
    dragCount.value = 0
  }
}

function handleWindowDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleWindowDrop(e: DragEvent) {
  e.preventDefault()
  dragCounter = 0
  showOverlay.value = false
  dragCount.value = 0

  if (!fileStore.isOnline) return

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    transferStore.addToUploadQueue(Array.from(files), fileStore.currentPath)
  }
}

function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }

  if (fileStore.currentPath === '/') {
    return
  }

  if (e.key === 'Backspace') {
    e.preventDefault()
    fileStore.goUp()
  }

  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault()
    fileStore.goUp()
  }
}

// Story 8.3: 处理托盘快速上传
function handleTrayQuickUpload() {
  showFileInput.value = true
  // 触发隐藏的文件输入
  fileInputRef.value?.click()
}

// 处理新建文件（预留功能）
function handleCreateFile() {
  // TODO: 实现新建文件功能
  console.log('新建文件功能待实现')
}

// 处理上传文件
function handleUpload() {
  showFileInput.value = true
  fileInputRef.value?.click()
}

// 处理文件选择
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    transferStore.addToUploadQueue(Array.from(files), fileStore.currentPath)
  }
  // 重置输入以允许重复选择同一文件
  target.value = ''
  showFileInput.value = false
}

onMounted(() => {
  // 加载网格密度偏好
  fileStore.loadGridDensityPreference()
  fileStore.fetchFiles('/')

  // 初始化下载队列
  if (authStore.isLoggedIn && authStore.user) {
    transferStore.initDownloadQueue(
      authStore.user.id,
      authStore.token,
      authStore.user.username
    )
  }

  window.addEventListener('dragenter', handleWindowDragEnter)
  window.addEventListener('dragleave', handleWindowDragLeave)
  window.addEventListener('dragover', handleWindowDragOver)
  window.addEventListener('drop', handleWindowDrop)
  window.addEventListener('keydown', handleKeydown)
  // Story 8.3: 监听托盘快速上传消息
  window.electronAPI?.onTrayQuickUpload?.(handleTrayQuickUpload)
})

onUnmounted(() => {
  window.removeEventListener('dragenter', handleWindowDragEnter)
  window.removeEventListener('dragleave', handleWindowDragLeave)
  window.removeEventListener('dragover', handleWindowDragOver)
  window.removeEventListener('drop', handleWindowDrop)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="home">
    <el-container style="height: 100%">
      <el-main>
        <el-card class="file-card">
          <template #header>
            <div class="card-header">
              <!-- 左侧：面包屑导航 -->
              <div class="header-left">
                <Breadcrumb />
              </div>

              <!-- 中间：主要操作按钮组 -->
              <div class="header-center" v-if="false">
                <el-button
                  class="upload-btn"
                  @click="handleUpload"
                  :disabled="!fileStore.isOnline"
                >
                  <el-icon class="btn-icon"><Upload /></el-icon>
                  上传
                </el-button>
                <el-button
                  class="folder-btn"
                  @click="showCreateFolderModal = true"
                  :disabled="!fileStore.isOnline"
                >
                  <el-icon class="btn-icon"><Folder /></el-icon>
                  新建文件夹
                </el-button>
                <el-button
                  class="file-btn"
                  @click="handleCreateFile"
                  :disabled="!fileStore.isOnline"
                >
                  <el-icon class="btn-icon"><Document /></el-icon>
                  新建文件
                </el-button>
              </div>

              <!-- 右侧：视图切换和辅助按钮 -->
              <div class="header-right">
                <UpdateButton />
                <el-button
                  :class="['view-btn', { active: fileStore.viewMode === 'list' }]"
                  @click="fileStore.setViewMode('list')"
                  title="列表视图"
                >
                  <el-icon><Memo /></el-icon>
                </el-button>
                <el-button
                  :class="['view-btn', { active: fileStore.viewMode === 'grid' }]"
                  @click="fileStore.setViewMode('grid')"
                  title="网格视图"
                >
                  <el-icon><Grid /></el-icon>
                </el-button>
                <!-- 网格密度切换器（仅网格视图时显示） -->
                <el-dropdown
                  v-if="fileStore.viewMode === 'grid'"
                  trigger="click"
                  @command="(cmd: 'compact' | 'comfortable' | 'spacious') => fileStore.setGridDensity(cmd)"
                >
                  <el-button
                    class="view-btn"
                    title="网格密度"
                  >
                    <el-icon><List /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="compact">
                        <span>紧凑</span>
                        <span style="margin-left: 8px; font-size: 11px; color: var(--el-text-color-secondary);">110px</span>
                      </el-dropdown-item>
                      <el-dropdown-item command="comfortable">
                        <span>舒适</span>
                        <span style="margin-left: 8px; font-size: 11px; color: var(--el-text-color-secondary);">150px</span>
                      </el-dropdown-item>
                      <el-dropdown-item command="spacious">
                        <span>宽松</span>
                        <span style="margin-left: 8px; font-size: 11px; color: var(--el-text-color-secondary);">190px</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-button
                  class="refresh-btn"
                  @click="fileStore.refresh"
                  :disabled="!fileStore.isOnline"
                  title="刷新"
                >
                  <el-icon><Refresh /></el-icon>
                </el-button>
                <el-button
                  class="icon-btn-gray"
                  @click="fileStore.goUp"
                  :disabled="fileStore.currentPath === '/'"
                  title="返回上级"
                >
                  <el-icon><ArrowLeft /></el-icon>
                </el-button>
                <el-button
                  class="icon-btn-gray"
                  @click="router.push('/settings')"
                  title="设置"
                >
                  <el-icon><Setting /></el-icon>
                </el-button>
                <el-badge
                  :value="activeDownloadsCount"
                  :hidden="activeDownloadsCount === 0"
                  :max="99"
                  type="primary"
                >
                  <el-button
                    class="icon-btn-gray"
                    @click="showQueueDrawer = true"
                    title="下载列表"
                  >
                    <el-icon><Download /></el-icon>
                  </el-button>
                </el-badge>
              </div>
            </div>
          </template>
          <OfflineBanner />
          <BatchActionToolbar />
          <FileList />
        </el-card>
      </el-main>
    </el-container>
    <FileDetail />
    <CreateFolderModal v-model:show="showCreateFolderModal" />
    <!-- 上传进度面板（固定在底部） -->
    <div class="upload-panel-container">
      <TransferProgressList v-if="uploadQueue.length > 0" />
    </div>
    <!-- 全窗口拖拽覆盖层 -->
    <div v-if="showOverlay" class="drag-overlay">
      <div class="drag-overlay-content">
        <el-icon :size="64" :color="'var(--netease-red)'">
          <Upload />
        </el-icon>
        <el-text style="font-size: 18px; color: var(--netease-red);">
          释放文件即可上传 {{ dragCount > 0 ? `(${dragCount} 个文件)` : '' }}
        </el-text>
      </div>
    </div>
    <!-- Story 8.3: 隐藏的文件输入（用于托盘快速上传） -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />
    <!-- 下载队列管理抽屉 -->
    <el-drawer v-model="showQueueDrawer" :width="700" placement="right">
      <template #header>
        <span>下载队列管理</span>
      </template>
      <DownloadQueuePanel />
    </el-drawer>
  </div>
</template>

<style scoped>
.home {
  height: 100vh;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%);
}

.file-card {
  height: 100%;
  margin: 8px;
  display: flex;
  flex-direction: column;
}

/* 防止 el-card 的 body 产生额外滚动条 */
:deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 防止 el-main 产生滚动条 */
:deep(.el-main) {
  overflow: hidden;
}

/* 防止 el-container 产生滚动条 */
:deep(.el-container) {
  overflow: hidden;
}

/* 卡片头部 - 网易云风格 */
:deep(.el-card__header) {
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.header-left {
  flex: 1;
  min-width: 0;
}

.header-center {
  display: flex;
  gap: 8px;
}

.header-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* ===== 网易云风格按钮 ===== */

/* 上传按钮 - 网易红渐变（主操作） */
.upload-btn {
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%);
  color: #fff;
  border: none;
  height: 36px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(194, 12, 12, 0.3);
}

.upload-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(194, 12, 12, 0.4);
}

.upload-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(194, 12, 12, 0.3);
}

.upload-btn:disabled {
  background: #d9d9d9;
  box-shadow: none;
  cursor: not-allowed;
  transform: none;
}

.upload-btn .btn-icon {
  margin-right: 6px;
}

/* 新建文件夹按钮 - 毛玻璃效果 */
.folder-btn {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--netease-gray-6);
  border: 1px solid rgba(0, 0, 0, 0.1);
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.folder-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.8);
  border-color: var(--netease-red);
  color: var(--netease-red);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.folder-btn:active:not(:disabled) {
  transform: translateY(0);
}

.folder-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.folder-btn .btn-icon {
  color: #ffc53d;
  margin-right: 4px;
}

/* 新建文件按钮 - 浅红背景 */
.file-btn {
  background: var(--netease-red-pale);
  color: var(--netease-red);
  border: 1px solid rgba(194, 12, 12, 0.2);
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.file-btn:hover:not(:disabled) {
  background: #ffe0e0;
  border-color: var(--netease-red);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.file-btn:active:not(:disabled) {
  transform: translateY(0);
}

.file-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.file-btn .btn-icon {
  margin-right: 4px;
}

/* 视图切换按钮 - 毛玻璃风格 */
.view-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.view-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.view-btn.active {
  background: var(--netease-red-pale);
  border-color: var(--netease-red);
  color: var(--netease-red);
}

/* 刷新按钮 */
.refresh-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

/* 通用图标按钮 - 毛玻璃风格 */
.icon-btn-gray {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.icon-btn-gray:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.icon-btn-gray:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 拖拽覆盖层 - 网易云红风格 */
.drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(194, 12, 12, 0.05);
  border: 3px dashed var(--netease-red);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  backdrop-filter: blur(2px);
}

.drag-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

/* 上传进度面板容器（固定在底部） */
.upload-panel-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: none;
}

.upload-panel-container > * {
  pointer-events: auto;
}
</style>
