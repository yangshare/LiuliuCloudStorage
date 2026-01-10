<script setup lang="ts">
import { ref } from 'vue'
import { NIcon, NText, NButton, NSpace } from 'naive-ui'
import { CloudUploadOutline, DocumentOutline, FolderOpenOutline } from '@vicons/ionicons5'
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
    <n-icon size="48" :depth="3">
      <CloudUploadOutline />
    </n-icon>
    <n-text v-if="isDragging" depth="2">
      释放即可上传 {{ dragCount > 0 ? `(${dragCount} 个文件)` : '' }}
    </n-text>
    <n-text v-else depth="3">
      拖拽文件到此处上传
    </n-text>
    <n-space v-if="!isDragging" style="margin-top: 12px">
      <n-button size="small" :disabled="!fileStore.isOnline" @click.stop="selectFiles">
        <template #icon><n-icon><DocumentOutline /></n-icon></template>
        选择文件
      </n-button>
      <n-button size="small" :disabled="!fileStore.isOnline" @click.stop="selectFolder">
        <template #icon><n-icon><FolderOpenOutline /></n-icon></template>
        选择文件夹
      </n-button>
    </n-space>
  </div>
</template>

<style scoped>
.drop-zone {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
  margin-bottom: 12px;
}

.drop-zone:hover {
  border-color: #1890ff;
}

.drop-zone.is-dragging {
  border-color: #1890ff;
  background-color: #e6f7ff;
}

.drop-zone.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
