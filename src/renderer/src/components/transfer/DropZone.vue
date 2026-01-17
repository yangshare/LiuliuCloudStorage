<script setup lang="ts">
import { ref } from 'vue'
import { ElIcon, ElText, ElButton, ElSpace } from 'element-plus'
import { Upload, Document, FolderOpened } from '@element-plus/icons-vue'
import { useTransferStore } from '../../stores/transferStore'
import { useFileStore } from '../../stores/fileStore'

const transferStore = useTransferStore()
const fileStore = useFileStore()

const isDragging = ref(false)
const dragCount = ref(0)
let dragCounter = 0

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragCounter++
  if (dragCounter === 1) {
    isDragging.value = true
    if (e.dataTransfer?.items) {
      dragCount.value = e.dataTransfer.items.length
    }
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragCounter--
  if (dragCounter === 0) {
    isDragging.value = false
    dragCount.value = 0
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false
  dragCounter = 0
  dragCount.value = 0

  if (!fileStore.isOnline) return

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    transferStore.addToUploadQueue(Array.from(files), fileStore.currentPath)
  }
}

async function selectFiles() {
  if (!fileStore.isOnline) return
  const result = await window.electronAPI.dialog.openFile()
  if (!result.canceled && result.files?.length) {
    transferStore.addPathsToUploadQueue(result.files.map(f => f.path), fileStore.currentPath)
  }
}

async function selectFolder() {
  if (!fileStore.isOnline) return
  const result = await window.electronAPI.dialog.openFile({ directory: true })
  if (!result.canceled && result.files?.length) {
    transferStore.addPathsToUploadQueue(result.files.map(f => f.path), fileStore.currentPath)
  }
}
</script>

<template>
  <div
    class="drop-zone"
    :class="{ 'is-dragging': isDragging, 'is-disabled': !fileStore.isOnline }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <el-icon :size="48" color="var(--el-color-info)">
      <Upload />
    </el-icon>
    <el-text v-if="isDragging" type="primary" size="large">
      释放即可上传 {{ dragCount > 0 ? `(${dragCount} 个文件)` : '' }}
    </el-text>
    <el-text v-else type="info" size="default">
      拖拽文件到此处上传
    </el-text>
    <el-space v-if="!isDragging" :size="12" style="margin-top: 12px">
      <el-button size="small" :disabled="!fileStore.isOnline" @click.stop="selectFiles" :icon="Document">
        选择文件
      </el-button>
      <el-button size="small" :disabled="!fileStore.isOnline" @click.stop="selectFolder" :icon="FolderOpened">
        选择文件夹
      </el-button>
    </el-space>
  </div>
</template>

<style scoped>
.drop-zone {
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.drop-zone:hover {
  border-color: var(--el-color-primary);
}

.drop-zone.is-dragging {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.drop-zone.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
