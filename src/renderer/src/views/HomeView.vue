<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { NLayout, NLayoutSider, NLayoutContent, NCard, NButton, NSpace, NIcon, NText } from 'naive-ui'
import { CloudUploadOutline, FolderOutline } from '@vicons/ionicons5'
import FileList from '../components/file/FileList.vue'
import DirectoryTree from '../components/file/DirectoryTree.vue'
import Breadcrumb from '../components/file/Breadcrumb.vue'
import FileDetail from '../components/file/FileDetail.vue'
import OfflineBanner from '../components/common/OfflineBanner.vue'
import DropZone from '../components/transfer/DropZone.vue'
import TransferProgressList from '../components/transfer/TransferProgressList.vue'
import DownloadProgressPanel from '../components/transfer/DownloadProgressPanel.vue'
import CreateFolderModal from '../components/file/CreateFolderModal.vue'
import QuotaDisplay from '../components/quota/QuotaDisplay.vue'
import { useFileStore } from '../stores/fileStore'
import { useTransferStore } from '../stores/transferStore'

const fileStore = useFileStore()
const transferStore = useTransferStore()
const showCreateFolderModal = ref(false)

const uploadQueue = computed(() => transferStore.uploadQueue)
const downloadQueue = computed(() => transferStore.downloadQueue)
const hasActiveDownloads = computed(() => transferStore.activeDownloads.length > 0)
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

onMounted(() => {
  fileStore.fetchFiles('/')
  window.addEventListener('dragenter', handleWindowDragEnter)
  window.addEventListener('dragleave', handleWindowDragLeave)
  window.addEventListener('dragover', handleWindowDragOver)
  window.addEventListener('drop', handleWindowDrop)
  window.addEventListener('keydown', handleKeydown)
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
    <n-layout has-sider style="height: 100%">
      <n-layout-sider bordered :width="260" content-style="padding: 0; overflow: auto;">
        <div class="quota-section">
          <QuotaDisplay />
        </div>
        <DirectoryTree />
      </n-layout-sider>
      <n-layout-content>
        <n-card class="file-card">
          <template #header>
            <n-space justify="space-between" align="center">
              <Breadcrumb />
              <n-space>
                <n-button size="small" @click="showCreateFolderModal = true" :disabled="!fileStore.isOnline">
                  <template #icon>
                    <n-icon><FolderOutline /></n-icon>
                  </template>
                  新建文件夹
                </n-button>
                <n-button size="small" @click="fileStore.goUp" :disabled="fileStore.currentPath === '/'" title="返回上级 (Backspace / Alt+←)">返回上级</n-button>
                <n-button size="small" @click="fileStore.refresh" :loading="fileStore.isLoadingFiles" :disabled="!fileStore.isOnline">刷新</n-button>
              </n-space>
            </n-space>
          </template>
          <OfflineBanner />
          <DropZone />
          <FileList />
        </n-card>
      </n-layout-content>
    </n-layout>
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
        <n-icon size="64" color="#1890ff">
          <CloudUploadOutline />
        </n-icon>
        <n-text style="font-size: 18px; color: #1890ff;">
          释放文件即可上传 {{ dragCount > 0 ? `(${dragCount} 个文件)` : '' }}
        </n-text>
      </div>
    </div>
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
}

.transfer-panel {
  width: 100%;
}

.download-panel {
  width: 100%;
}

.quota-section {
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}
</style>
