<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElContainer, ElMain, ElCard, ElButton, ElIcon, ElText, ElDrawer } from 'element-plus'
import { Upload, Folder, List, Setting } from '@element-plus/icons-vue'
import FileList from '../components/file/FileList.vue'
import Breadcrumb from '../components/file/Breadcrumb.vue'
import FileDetail from '../components/file/FileDetail.vue'
import OfflineBanner from '../components/common/OfflineBanner.vue'
import DropZone from '../components/transfer/DropZone.vue'
import TransferProgressList from '../components/transfer/TransferProgressList.vue'
import DownloadProgressPanel from '../components/transfer/DownloadProgressPanel.vue'
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
// 临时调试：同时检查 downloadQueue 和 activeDownloads
const hasActiveDownloads = computed(() =>
  transferStore.activeDownloads.length > 0 ||
  transferStore.downloadQueue.some(t => t.status === 'in_progress' || t.status === 'pending')
)
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
              <Breadcrumb />
              <div class="button-group">
                <UpdateButton />
                <el-button size="small" @click="router.push('/settings')">
                  <el-icon class="el-icon--left"><Setting /></el-icon>
                  设置
                </el-button>
                <el-button size="small" @click="showQueueDrawer = true">
                  <el-icon class="el-icon--left"><List /></el-icon>
                  队列管理
                </el-button>
                <el-button size="small" @click="showCreateFolderModal = true" :disabled="!fileStore.isOnline">
                  <el-icon class="el-icon--left"><Folder /></el-icon>
                  新建文件夹
                </el-button>
                <el-button size="small" @click="fileStore.goUp" :disabled="fileStore.currentPath === '/'" title="返回上级 (Backspace / Alt+←)">返回上级</el-button>
                <el-button size="small" @click="fileStore.refresh" :loading="fileStore.isLoadingFiles" :disabled="!fileStore.isOnline">刷新</el-button>
              </div>
            </div>
          </template>
          <OfflineBanner />
          <DropZone />
          <BatchActionToolbar />
          <FileList />
        </el-card>
      </el-main>
    </el-container>
    <FileDetail />
    <CreateFolderModal v-model:show="showCreateFolderModal" />
    <!-- 传输进度面板（固定在底部） -->
    <div class="transfer-panels">
      <TransferProgressList v-if="uploadQueue.length > 0" class="transfer-panel" />
      <DownloadProgressPanel v-if="hasActiveDownloads" class="download-panel" />
    </div>
    <!-- 全窗口拖拽覆盖层 -->
    <div v-if="showOverlay" class="drag-overlay">
      <div class="drag-overlay-content">
        <el-icon :size="64" color="#1890ff">
          <Upload />
        </el-icon>
        <el-text style="font-size: 18px; color: #1890ff;">
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
}

.file-card {
  height: 100%;
  margin: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.button-group {
  display: flex;
  gap: 8px;
}

.drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(24, 144, 255, 0.1);
  border: 3px dashed #1890ff;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drag-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.transfer-panels {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0;
  pointer-events: none;
}

.transfer-panels > * {
  pointer-events: auto;
}

.transfer-panel {
  width: 100%;
}

.download-panel {
  width: 100%;
  transition: all 0.3s ease-in-out;
}

.download-panel:has(.collapsed) {
  width: 260px;
  margin-left: 0;
  margin-bottom: 8px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
