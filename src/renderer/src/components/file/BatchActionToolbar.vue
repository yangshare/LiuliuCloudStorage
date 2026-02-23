<script setup lang="ts">
import { ref } from 'vue'
import { ElText, ElButton, ElIcon, ElDialog, ElSpace, ElMessage } from 'element-plus'
import { Download, Delete, Refresh } from '@element-plus/icons-vue'
import { useFileStore } from '../../stores/fileStore'
import { useTransferStore } from '../../stores/transferStore'

const fileStore = useFileStore()
const transferStore = useTransferStore()

// 删除确认对话框状态
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

async function handleBatchDownload() {
  const selectedItems = fileStore.selectedFiles

  if (selectedItems.length === 0) {
    ElMessage.warning('没有选中的项目')
    return
  }

  console.log('[BatchActionToolbar] handleBatchDownload: selectedItems=', selectedItems)

  ElMessage.info(`正在准备添加 ${selectedItems.length} 个项目到下载队列...`)

  const currentPath = fileStore.currentPath === '/' ? '' : fileStore.currentPath
  let successCount = 0
  let failedCount = 0

  // 收集所有需要下载的文件路径
  const filePaths: string[] = []

  // 处理目录：递归获取所有文件
  const directories = selectedItems.filter(f => f.isDir)
  const files = selectedItems.filter(f => !f.isDir)

  console.log('[BatchActionToolbar] directories=', directories, 'files=', files, 'currentPath=', currentPath)

  // 直接添加文件路径
  files.forEach(file => {
    const filePath = currentPath ? `${currentPath}/${file.name}` : `/${file.name}`
    filePaths.push(filePath)
  })

  // 处理目录：获取所有文件路径
  for (const dir of directories) {
    const dirRemotePath = currentPath ? `${currentPath}/${dir.name}` : `/${dir.name}`
    console.log('[BatchActionToolbar] 获取目录文件: dirRemotePath=', dirRemotePath)
    try {
      const result = await window.electronAPI.file.getAllFilesInDirectory(dirRemotePath)
      console.log('[BatchActionToolbar] 目录文件结果:', result)
      if (result.success && result.data) {
        console.log('[BatchActionToolbar] 找到文件数:', result.data.length)
        filePaths.push(...result.data)
      } else {
        console.log('[BatchActionToolbar] 获取目录文件失败:', result.error)
        failedCount++
      }
    } catch (error) {
      console.error('[BatchActionToolbar] 获取目录文件异常:', error)
      failedCount++
    }
  }

  const totalFiles = filePaths.length
  console.log('[BatchActionToolbar] 总文件数:', totalFiles, 'filePaths=', filePaths)

  if (totalFiles === 0) {
    ElMessage.warning('没有可下载的文件')
    return
  }

  ElMessage.info(`正在添加 ${totalFiles} 个文件到下载队列...`)

  // 批量添加到下载队列
  const downloadPromises = filePaths.map(async (remotePath) => {
    // 从完整路径中提取文件名
    const fileName = remotePath.split('/').pop() || 'unknown'
    try {
      const result = await transferStore.queueDownload(remotePath, fileName)
      if (result?.success) {
        successCount++
      } else {
        failedCount++
      }
    } catch (error) {
      failedCount++
    }
  })

  await Promise.all(downloadPromises)

  // 清空选中状态
  fileStore.clearSelection()

  // 显示结果
  if (failedCount === 0) {
    ElMessage.success(`已添加 ${successCount} 个文件到下载队列`)
  } else if (successCount === 0) {
    ElMessage.error(`添加失败，请稍后重试`)
  } else {
    ElMessage.warning(`成功添加 ${successCount} 个文件，失败 ${failedCount} 个`)
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
      ElMessage.success(`成功删除 ${names.length} 个文件`)
    } else {
      ElMessage.error(`删除失败: ${result.error}`)
    }

    // 清空选中状态并刷新文件列表
    fileStore.clearSelection()
    fileStore.refresh()
  } catch (error: any) {
    ElMessage.error(error.message || '批量删除失败')
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
  <el-space v-if="fileStore.selectedFiles.length > 0" align="center" class="batch-toolbar" :size="8">
    <el-text>已选择 {{ fileStore.selectedFiles.length }} 项</el-text>
    <el-button @click="handleBatchDownload" :icon="Download">
      批量下载
    </el-button>
    <!-- 批量删除功能暂不开放
    <el-button type="danger" @click="handleBatchDelete" :icon="Delete">
      批量删除
    </el-button>
    -->
    <el-button @click="handleInvertSelection" :icon="Refresh">
      反选
    </el-button>
    <el-button @click="handleCancelSelection">取消选择</el-button>
  </el-space>

  <!-- 批量删除确认对话框 -->
  <el-dialog
    v-model="showDeleteConfirm"
    title="确认批量删除"
    width="500px"
    :close-on-click-modal="false"
  >
    <span>{{ getDeleteConfirmContent() }}</span>
    <template #footer>
      <el-button @click="cancelDelete">取消</el-button>
      <el-button type="danger" @click="confirmBatchDelete" :loading="isDeleting">删除</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.batch-toolbar {
  padding: 8px 16px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  margin-bottom: 8px;
}
</style>
