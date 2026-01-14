<script setup lang="ts">
import { ref } from 'vue'
import { NSpace, NText, NButton, NIcon, NModal, useMessage } from 'naive-ui'
import { DownloadOutline as DownloadIcon, TrashOutline as DeleteIcon, RefreshOutline as InvertIcon } from '@vicons/ionicons5'
import { useFileStore } from '../../stores/fileStore'
import { useTransferStore } from '../../stores/transferStore'

const fileStore = useFileStore()
const transferStore = useTransferStore()
const message = useMessage()

// 删除确认对话框状态
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

async function handleBatchDownload() {
  // 过滤掉文件夹,只保留文件
  const filesToDownload = fileStore.selectedFiles.filter(f => !f.isDir)

  if (filesToDownload.length === 0) {
    message.warning('没有可下载的文件')
    return
  }

  message.info(`正在添加 ${filesToDownload.length} 个文件到下载队列...`)

  // 批量添加到下载队列并统计结果
  const currentPath = fileStore.currentPath === '/' ? '' : fileStore.currentPath
  let successCount = 0
  let failedFiles: string[] = []

  const downloadPromises = filesToDownload.map(async (file) => {
    const remotePath = `${currentPath}/${file.name}`
    try {
      const result = await transferStore.queueDownload(remotePath, file.name)
      if (result?.success) {
        successCount++
      } else {
        failedFiles.push(file.name)
      }
    } catch (error) {
      failedFiles.push(file.name)
    }
  })

  await Promise.all(downloadPromises)

  // 清空选中状态
  fileStore.clearSelection()

  // 显示结果
  if (failedFiles.length === 0) {
    message.success(`已添加 ${successCount} 个文件到下载队列`)
  } else if (successCount === 0) {
    message.error(`添加失败: ${failedFiles.join(', ')}`)
  } else {
    message.warning(`成功添加 ${successCount} 个文件，失败 ${failedFiles.length} 个: ${failedFiles.join(', ')}`)
  }
}

function handleBatchDelete() {
  showDeleteConfirm.value = true
}

async function confirmBatchDelete() {
  const files = fileStore.selectedFiles
  const dir = fileStore.currentPath
  const names = files.map(f => f.name)

  isDeleting.value = true
  try {
    // 使用批量删除 API
    const result = await window.electronAPI.file.batchDelete(dir, names)

    if (result.success) {
      message.success(`成功删除 ${names.length} 个文件`)
    } else {
      message.error(`删除失败: ${result.error}`)
    }

    // 清空选中状态并刷新文件列表
    fileStore.clearSelection()
    fileStore.refresh()
  } catch (error: any) {
    message.error(error.message || '批量删除失败')
  } finally {
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}

function cancelDelete() {
  showDeleteConfirm.value = false
}

function handleInvertSelection() {
  fileStore.invertSelection()
}

function handleCancelSelection() {
  fileStore.clearSelection()
}

// 计算删除确认对话框的内容
function getDeleteConfirmContent() {
  const files = fileStore.selectedFiles
  const folderCount = files.filter(f => f.isDir).length
  const fileCount = files.filter(f => !f.isDir).length

  let content = `确定要删除 ${files.length} 项吗？`
  if (folderCount > 0) {
    content += `\n\n⚠️ 包含 ${folderCount} 个文件夹，删除后其中所有内容都将被删除！`
  }

  return content
}
</script>

<template>
  <n-space v-if="fileStore.selectedFiles.length > 0" align="center" class="batch-toolbar">
    <n-text>已选择 {{ fileStore.selectedFiles.length }} 项</n-text>
    <n-button @click="handleBatchDownload">
      <template #icon>
        <n-icon :component="DownloadIcon" />
      </template>
      批量下载
    </n-button>
    <n-button type="error" @click="handleBatchDelete">
      <template #icon>
        <n-icon :component="DeleteIcon" />
      </template>
      批量删除
    </n-button>
    <n-button @click="handleInvertSelection">
      <template #icon>
        <n-icon :component="InvertIcon" />
      </template>
      反选
    </n-button>
    <n-button @click="handleCancelSelection">取消选择</n-button>
  </n-space>

  <!-- 批量删除确认对话框 -->
  <n-modal
    v-model:show="showDeleteConfirm"
    preset="dialog"
    title="确认批量删除"
    :content="getDeleteConfirmContent()"
    positive-text="删除"
    negative-text="取消"
    :positive-button-props="{ type: 'error', loading: isDeleting }"
    @positive-click="confirmBatchDelete"
    @negative-click="cancelDelete"
  />
</template>

<style scoped>
.batch-toolbar {
  padding: 8px 16px;
  background-color: var(--n-color-hover);
  border-radius: 4px;
  margin-bottom: 8px;
}
</style>
