<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { NLayout, NLayoutSider, NLayoutContent, NCard, NButton, NSpace, NIcon, NText } from 'naive-ui'
import { CloudUploadOutline } from '@vicons/ionicons5'
import FileList from '../components/file/FileList.vue'
import DirectoryTree from '../components/file/DirectoryTree.vue'
import Breadcrumb from '../components/file/Breadcrumb.vue'
import FileDetail from '../components/file/FileDetail.vue'
import OfflineBanner from '../components/common/OfflineBanner.vue'
import DropZone from '../components/transfer/DropZone.vue'
import { useFileStore } from '../stores/fileStore'
import { useTransferStore } from '../stores/transferStore'

const fileStore = useFileStore()
const transferStore = useTransferStore()

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

onMounted(() => {
  fileStore.fetchFiles('/')
  window.addEventListener('dragenter', handleWindowDragEnter)
  window.addEventListener('dragleave', handleWindowDragLeave)
  window.addEventListener('dragover', handleWindowDragOver)
  window.addEventListener('drop', handleWindowDrop)
})

onUnmounted(() => {
  window.removeEventListener('dragenter', handleWindowDragEnter)
  window.removeEventListener('dragleave', handleWindowDragLeave)
  window.removeEventListener('dragover', handleWindowDragOver)
  window.removeEventListener('drop', handleWindowDrop)
})
</script>

<template>
  <div class="home">
    <n-layout has-sider style="height: 100%">
      <n-layout-sider bordered :width="260" content-style="padding: 0; overflow: auto;">
        <DirectoryTree />
      </n-layout-sider>
      <n-layout-content>
        <n-card class="file-card">
          <template #header>
            <n-space justify="space-between" align="center">
              <Breadcrumb />
              <n-space>
                <n-button size="small" @click="fileStore.goUp" :disabled="fileStore.currentPath === '/'">返回上级</n-button>
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
</style>
