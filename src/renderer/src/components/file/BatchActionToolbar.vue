<script setup lang="ts">
import { ref } from 'vue'
import { ElText, ElButton, ElDialog, ElIcon, ElSpace, ElMessage, ElMessageBox, ElInput } from 'element-plus'
import { Download, Refresh, Search, Loading } from '@element-plus/icons-vue'
import { useFileStore } from '@/features/file'
import { useTransferDownload } from '@/features/transfer/composables/useTransferDownload'
import { MAX_BATCH_DOWNLOAD_FILES } from '@shared/constants'

const fileStore = useFileStore()
const { batchQueueDownload } = useTransferDownload()

// 删除确认对话框状态
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

// 批量下载：目录扫描进度遮罩
const showScanDialog = ref(false)
const scanCount = ref(0)
const isCancelling = ref(false)
let scanSessionId: string | null = null

async function handleBatchDownload() {
  const selectedItems = fileStore.selectedFiles

  if (selectedItems.length === 0) {
    ElMessage.warning('没有选中的项目')
    return
  }

  const currentPath = fileStore.currentPath === '/' ? '' : fileStore.currentPath
  let failedCount = 0

  // 收集所有需要下载的文件路径
  const filePaths: string[] = []

  // 处理目录：递归获取所有文件
  const directories = selectedItems.filter(f => f.isDir)
  const files = selectedItems.filter(f => !f.isDir)

  // 直接添加文件路径
  files.forEach(file => {
    const filePath = currentPath ? `${currentPath}/${file.name}` : `/${file.name}`
    filePaths.push(filePath)
  })

  // 处理目录：弹出进度遮罩，并发扫描（后端），支持取消
  let dirTruncated = false
  let scanCancelled = false
  let completedDirectoryFileCount = 0
  let currentDirectoryProgressBase = 0

  if (directories.length > 0) {
    scanSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    scanCount.value = 0
    isCancelling.value = false
    showScanDialog.value = true

    const onProgress = (data: { sessionId: string; count: number }) => {
      if (data.sessionId === scanSessionId) {
        scanCount.value = Math.max(scanCount.value, currentDirectoryProgressBase + data.count)
      }
    }
    window.electronAPI.file.onGetAllFilesProgress(onProgress)

    try {
      for (const dir of directories) {
        const dirRemotePath = currentPath ? `${currentPath}/${dir.name}` : `/${dir.name}`
        currentDirectoryProgressBase = completedDirectoryFileCount
        try {
          const result = await window.electronAPI.file.getAllFilesInDirectory(dirRemotePath, MAX_BATCH_DOWNLOAD_FILES, scanSessionId)
          if (result.success && result.data) {
            // 用户取消：主进程 abort 后返回 cancelled=true，立即中止整轮扫描
            if (result.data.cancelled) {
              scanCancelled = true
              break
            }
            filePaths.push(...result.data.files)
            completedDirectoryFileCount += result.data.files.length
            scanCount.value = Math.max(scanCount.value, completedDirectoryFileCount)
            if (result.data.truncated) {
              dirTruncated = true
              break  // 已超阈值，无需继续展开剩余目录
            }
          } else {
            failedCount++
          }
        } catch (error) {
          console.error('[BatchActionToolbar] 获取目录文件异常:', error)
          failedCount++
        }
      }
    } finally {
      window.electronAPI.file.removeGetAllFilesProgressListener(onProgress)
      showScanDialog.value = false
      scanSessionId = null
      isCancelling.value = false
    }

    if (scanCancelled) {
      ElMessage.info('已取消批量下载')
      return
    }
  }

  const totalFiles = filePaths.length

  if (totalFiles === 0) {
    ElMessage.warning('没有可下载的文件')
    return
  }

  // 文件数量上限拦截：目录展开时已超阈值（dirTruncated）或累计超限，
  // 阻断以避免后端批量 INSERT 触发 Drizzle mergeQueries 递归爆栈 / SQLite 参数超限
  if (dirTruncated || totalFiles > MAX_BATCH_DOWNLOAD_FILES) {
    await ElMessageBox.alert(
      `选中的文件超过单次批量下载上限 ${MAX_BATCH_DOWNLOAD_FILES} 个。\n为避免程序异常，请缩小选中范围（如减少文件夹）或分多次下载。`,
      '文件数量过多',
      { confirmButtonText: '我知道了', type: 'warning' }
    )
    return
  }

  ElMessage.info(`正在添加 ${totalFiles} 个文件到下载队列...`)

  // 使用批量入队：先立即显示在等待列表，再分批获取下载链接
  const result = await batchQueueDownload(filePaths)

  // 清空选中状态
  fileStore.clearSelection()

  // 显示结果
  if (!result.success) {
    ElMessage.error(result.error || '添加失败，请稍后重试')
  } else if (result.successCount === 0) {
    ElMessage.warning('没有新的文件需要下载（可能已在队列中）')
  } else {
    const skipped = totalFiles - (result.successCount ?? 0)
    if (skipped > 0) {
      ElMessage.success(`已添加 ${result.successCount} 个文件到下载队列(${skipped} 个已在队列)`)
    } else {
      ElMessage.success(`已添加 ${result.successCount} 个文件到下载队列`)
    }
  }
}

// 取消进行中的目录扫描：通知主进程 abort，扫描循环随即拿到 cancelled 返回值
async function handleCancelScan() {
  if (!scanSessionId || isCancelling.value) return
  isCancelling.value = true
  try {
    await window.electronAPI.file.cancelGetAllFiles(scanSessionId)
  } catch (error) {
    console.error('[BatchActionToolbar] 取消扫描失败:', error)
    isCancelling.value = false
  }
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

  let content = `确定要删除 ${files.length} 项吗？`
  if (folderCount > 0) {
    content += `\n\n⚠️ 包含 ${folderCount} 个文件夹，删除后其中所有内容都将被删除！`
  }

  return content
}
</script>

<template>
  <div class="batch-toolbar-wrapper">
    <el-space v-if="fileStore.selectedFiles.length > 0" align="center" :size="8">
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
    <div class="batch-toolbar-spacer"></div>
    <el-input
      v-model="fileStore.searchKeyword"
      class="search-input"
      placeholder="搜索当前目录"
      clearable
      :prefix-icon="Search"
    />
  </div>

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

  <!-- 目录扫描进度对话框 -->
  <el-dialog
    v-model="showScanDialog"
    title="正在统计文件"
    width="420px"
    :close-on-click-modal="false"
    :show-close="false"
    :close-on-press-escape="false"
  >
    <div class="scan-dialog-body">
      <el-icon class="is-loading scan-icon"><Loading /></el-icon>
      <div class="scan-text">
        <div>正在扫描选中目录的文件…</div>
        <div class="scan-count">已找到 <b>{{ scanCount }}</b> 个文件</div>
      </div>
    </div>
    <template #footer>
      <el-button @click="handleCancelScan" :loading="isCancelling">取消</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.batch-toolbar-wrapper {
  display: flex;
  align-items: center;
  padding: 8px 0;
  margin-bottom: 8px;
}

.batch-toolbar-spacer {
  flex: 1;
}

.search-input {
  width: 180px;
}

.scan-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.scan-icon {
  font-size: 32px;
  color: var(--el-color-primary);
}

.scan-text {
  text-align: center;
  line-height: 1.8;
}

.scan-count {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
}
</style>
