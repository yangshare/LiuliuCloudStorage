<script setup lang="ts">
import { ref, computed, h, reactive } from 'vue'
import { ElTable, ElTableColumn, ElCheckbox, ElButton, ElInput, ElTag, ElDropdown, ElMessage, ElLoading, ElAlert, ElEmpty } from 'element-plus'
import { useFileStore } from '../../stores/fileStore'
import { useTransferStore } from '../../stores/transferStore'
import { useAuthStore } from '../../stores/authStore'
import FileIcon from './FileIcon.vue'
import DownloadDialog from '../download/DownloadDialog.vue'
import ConfirmDeleteDialog from './ConfirmDeleteDialog.vue'
import { formatFileSize, formatDate } from '../../utils/formatters'
import type { FileItem } from '../../../../shared/types/electron'

const fileStore = useFileStore()
const transferStore = useTransferStore()
const authStore = useAuthStore()

// 右键菜单状态
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const selectedFileForContextMenu = ref<FileItem | null>(null)

// 删除确认对话框状态
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

// 重命名状态
const editingFile = ref<FileItem | null>(null)
const editingName = ref('')
const isRenaming = ref(false)

// 下载对话框状态
const showDownloadDialog = ref(false)
const fileForDownload = ref<FileItem | null>(null)

// 离线模式提示
const offlineModeMessage = computed(() => {
  if (!fileStore.isOnline && fileStore.cacheTime) {
    return `离线模式 - 显示缓存数据（最后更新：${fileStore.cacheTime}）`
  } else if (!fileStore.isOnline) {
    return '离线模式 - 无法连接服务器'
  }
  return null
})

function handleRetry() {
  fileStore.refresh()
}

function handleRowClick(row: FileItem, column: any, event: MouseEvent) {
  // 处理多选逻辑
  if (event?.ctrlKey || event?.metaKey) {
    // Ctrl/Cmd + 点击：切换选中状态
    fileStore.toggleSelect(row)
    return
  }

  if (event?.shiftKey && fileStore.lastClickedIndex >= 0) {
    // Shift + 点击：范围选择
    const index = fileStore.sortedFiles.findIndex(f => f.name === row.name)
    fileStore.selectRange(fileStore.lastClickedIndex, index)
    return
  }

  // 普通点击 - 清空之前的选中状态
  fileStore.clearSelection()

  if (row.isDir) {
    // 单击目录直接进入
    fileStore.enterFolder(row)
  } else {
    // 单击文件显示详情
    fileStore.selectFile(row)
  }
}

function handleRowDoubleClick(row: FileItem) {
  if (row.isDir) {
    // 双击目录进入（备用导航方式）
    fileStore.enterFolder(row)
  }
}

async function handleDownload(file: FileItem) {
  // 获取当前路径（相对于用户根目录的路径）
  const currentPath = fileStore.currentPath === '/' ? '' : fileStore.currentPath
  const remotePath = `${currentPath}/${file.name}`

  console.log('[FileList] 开始下载:', { remotePath, fileName: file.name })

  // 立即显示 toast 提示
  ElMessage.info(`正在添加到下载队列: ${file.name}`)

  // 添加到下载队列
  try {
    console.log('[FileList] 调用 transferStore.queueDownload, remotePath:', remotePath, 'fileName:', file.name)
    const result = await transferStore.queueDownload(remotePath, file.name)
    console.log('[FileList] queueDownload 返回值类型:', typeof result, '是否为null:', result === null, '值:', result)
    if (result?.success) {
      console.log('[FileList] 准备显示成功消息')
      ElMessage.success(`已添加到下载队列: ${file.name}`)
    } else {
      console.log('[FileList] 准备显示错误消息, error:', result?.error)
      ElMessage.error(result?.error || '添加到下载队列失败')
    }
  } catch (error: any) {
    console.error('[FileList] queueDownload 异常:', error)
    ElMessage.error(error.message || '下载失败')
  }
}

// 右键菜单选项
const contextMenuOptions = computed(() => {
  if (!selectedFileForContextMenu.value) return []

  const options = [
    {
      label: '下载',
      key: 'download',
      disabled: selectedFileForContextMenu.value.isDir
    },
    {
      label: '下载到...',
      key: 'downloadTo',
      disabled: selectedFileForContextMenu.value.isDir
    },
    {
      label: '另存为...',
      key: 'saveAs',
      disabled: selectedFileForContextMenu.value.isDir
    },
    { label: 'divider', key: 'd1', divided: true },
    {
      label: '打开下载目录',
      key: 'openDownloadDir'
    },
    { label: 'divider', key: 'd2', divided: true },
    {
      label: '重命名',
      key: 'rename'
    },
    {
      label: '删除',
      key: 'delete'
    }
  ]

  return options
})

// 显示右键菜单
function handleContextMenu(row: FileItem, column: any, event: MouseEvent) {
  event.preventDefault()
  selectedFileForContextMenu.value = row
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = true
}

// 处理右键菜单选择
async function handleContextMenuSelect(key: string) {
  showContextMenu.value = false

  if (!selectedFileForContextMenu.value) return

  const file = selectedFileForContextMenu.value
  const currentPath = fileStore.currentPath === '/' ? '' : fileStore.currentPath
  const remotePath = `${currentPath}/${file.name}`

  switch (key) {
    case 'download':
      // 直接下载
      await handleDownload(file)
      break

    case 'downloadTo':
      // 下载到指定位置
      fileForDownload.value = file
      showDownloadDialog.value = true
      break

    case 'saveAs':
      // 另存为
      await transferStore.downloadWithSaveAs(
        remotePath,
        file.name,
        authStore.user.id,
        authStore.token,
        authStore.user.username
      )
      break

    case 'openDownloadDir':
      // 打开下载目录
      try {
        const result = await window.electronAPI?.downloadConfig.openDirectory()
        if (!result?.success) {
          ElMessage.error(result?.error || '无法打开目录')
        }
      } catch (error: any) {
        ElMessage.error('打开目录失败: ' + error.message)
      }
      break

    case 'rename':
      // 开始重命名
      startRename(file)
      return // 不清空 selectedFileForContextMenu

    case 'delete':
      // 显示删除确认对话框
      showDeleteConfirm.value = true
      return // 不清空 selectedFileForContextMenu，删除对话框需要用
  }

  selectedFileForContextMenu.value = null
}

// 确认删除
async function confirmDelete() {
  if (!selectedFileForContextMenu.value) return

  isDeleting.value = true
  try {
    const result = await window.electronAPI.file.delete(
      fileStore.currentPath,
      selectedFileForContextMenu.value.name
    )

    if (result.success) {
      ElMessage.success('删除成功')

      // 如果删除的是文件夹,检查是否需要导航到父级
      if (selectedFileForContextMenu.value.isDir) {
        const deletedFolderPath = fileStore.currentPath === '/'
          ? `/${selectedFileForContextMenu.value.name}`
          : `${fileStore.currentPath}/${selectedFileForContextMenu.value.name}`

        // Task 4.2: 如果当前路径是被删除文件夹的子路径,导航到父级
        if (fileStore.currentPath.startsWith(deletedFolderPath)) {
          const parentPath = fileStore.currentPath === '/' ? '/' :
            fileStore.currentPath.split('/').slice(0, -1).join('/') || '/'
          fileStore.navigateTo(parentPath)
          return // 导航会触发刷新,不需要继续执行
        }
      }

      // 刷新文件列表
      fileStore.refresh()

      // 如果返回需要刷新配额标志,触发配额重新计算
      if (result.shouldRefreshQuota) {
        try {
          await window.electronAPI.quota.calculate()
        } catch (quotaError) {
          console.warn('配额刷新失败:', quotaError)
        }
      }
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '删除失败')
  } finally {
    isDeleting.value = false
    showDeleteConfirm.value = false
    selectedFileForContextMenu.value = null
  }
}

// 取消删除
function cancelDelete() {
  showDeleteConfirm.value = false
  selectedFileForContextMenu.value = null
}

// 开始重命名
function startRename(file: FileItem) {
  editingFile.value = file
  editingName.value = file.name
  showContextMenu.value = false
}

// 确认重命名
async function confirmRename() {
  if (!editingFile.value || !editingName.value.trim()) {
    cancelRename()
    return
  }

  // 名称未改变
  if (editingName.value === editingFile.value.name) {
    cancelRename()
    return
  }

  isRenaming.value = true
  try {
    const filePath = fileStore.currentPath === '/'
      ? `/${editingFile.value.name}`
      : `${fileStore.currentPath}/${editingFile.value.name}`

    const result = await window.electronAPI.file.rename(filePath, editingName.value)

    if (result.success) {
      ElMessage.success('重命名成功')

      // 如果重命名的是文件夹,需要处理路径更新
      if (editingFile.value.isDir) {
        const oldFolderPath = filePath
        const newFolderPath = fileStore.currentPath === '/'
          ? `/${editingName.value}`
          : `${fileStore.currentPath}/${editingName.value}`

        // Task 3.2: 如果当前路径包含被重命名的文件夹,更新当前路径
        if (fileStore.currentPath.startsWith(oldFolderPath)) {
          const newPath = fileStore.currentPath.replace(oldFolderPath, newFolderPath)
          fileStore.navigateTo(newPath)
          return // 导航会触发刷新,不需要继续执行
        }
      }

      // 刷新文件列表
      fileStore.refresh()
    } else {
      ElMessage.error(result.error || '重命名失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '重命名失败')
  } finally {
    isRenaming.value = false
    cancelRename()
  }
}

// 取消重命名
function cancelRename() {
  editingFile.value = null
  editingName.value = ''
  selectedFileForContextMenu.value = null
}

// 处理下载到指定路径
async function handleDownloadToPath(savePath: string) {
  if (!fileForDownload.value) return

  const file = fileForDownload.value
  const currentPath = fileStore.currentPath === '/' ? '' : fileStore.currentPath
  const remotePath = `${currentPath}/${file.name}`

  try {
    ElMessage.info(`正在下载到: ${savePath}`)
    const result = await window.electronAPI.transfer.download(
      remotePath,
      file.name,
      authStore.user.id,
      authStore.token,
      authStore.user.username,
      savePath
    )

    if (result?.success) {
      ElMessage.success(`已添加到下载队列: ${file.name}`)
    } else {
      ElMessage.error(result?.error || '下载失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '下载失败')
  } finally {
    fileForDownload.value = null
  }
}

const tableRef = ref<InstanceType<typeof ElTable>>()
</script>

<template>
  <div class="file-list" v-loading="fileStore.isLoadingFiles">
    <!-- 离线模式提示 -->
    <el-alert
      v-if="offlineModeMessage"
      type="warning"
      :title="offlineModeMessage"
      :closable="true"
      style="margin-bottom: 12px"
    />

    <!-- 错误提示 -->
    <el-alert
      v-if="fileStore.filesError"
      type="error"
      :title="fileStore.filesError"
      :closable="true"
      style="margin-bottom: 12px"
    >
      <el-button size="small" @click="handleRetry">重试</el-button>
    </el-alert>

    <el-empty v-if="fileStore.sortedFiles.length === 0 && !fileStore.isLoadingFiles" description="暂无文件" />

    <el-table
      v-else
      ref="tableRef"
      :data="fileStore.sortedFiles"
      style="width: 100%"
      :row-key="(row: FileItem) => row.name"
      @row-click="handleRowClick"
      @row-dblclick="handleRowDoubleClick"
      @row-contextmenu="handleContextMenu"
      :row-class-name="({ row }: { row: FileItem }) => fileStore.isSelected(row) ? 'selected-row' : ''"
    >
      <!-- 复选框列 -->
      <el-table-column width="50" align="center">
        <template #header>
          <el-checkbox
            :model-value="fileStore.isAllSelected"
            :indeterminate="fileStore.isPartialSelected && !fileStore.isAllSelected"
            @change="fileStore.selectAll"
          />
        </template>
        <template #default="{ row }">
          <el-checkbox
            :model-value="fileStore.isSelected(row)"
            @change="fileStore.toggleSelect(row)"
            @click.stop
          />
        </template>
      </el-table-column>

      <!-- 图标列 -->
      <el-table-column width="50" align="center">
        <template #default="{ row }">
          <FileIcon :is-dir="row.isDir" :name="row.name" />
        </template>
      </el-table-column>

      <!-- 名称列 -->
      <el-table-column prop="name" label="名称" min-width="200">
        <template #default="{ row }">
          <!-- 如果正在编辑此文件，显示输入框 -->
          <el-input
            v-if="editingFile && editingFile.name === row.name"
            :model-value="editingName"
            size="small"
            @update:model-value="editingName = $event"
            @keyup.enter="confirmRename"
            @keyup.esc="cancelRename"
            @blur="cancelRename"
            :loading="isRenaming"
            autofocus
            @click.stop
          />
          <!-- 否则显示文件名 -->
          <span v-else>{{ row.name }}</span>
        </template>
      </el-table-column>

      <!-- 大小列 -->
      <el-table-column prop="size" label="大小" width="120">
        <template #default="{ row }">
          {{ row.isDir ? '-' : formatFileSize(row.size) }}
        </template>
      </el-table-column>

      <!-- 修改日期列 -->
      <el-table-column prop="modified" label="修改日期" width="180">
        <template #default="{ row }">
          {{ formatDate(row.modified) }}
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <!-- 文件显示下载按钮，目录不显示 -->
          <el-button
            v-if="!row.isDir"
            type="primary"
            size="small"
            @click.stop="handleDownload(row)"
          >
            下载
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 右键菜单 -->
    <el-dropdown
      trigger="contextmenu"
      :show="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      @command="handleContextMenuSelect"
      @clickoutside="showContextMenu = false"
      teleported
    >
      <span></span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="option in contextMenuOptions"
            :key="option.key"
            :command="option.key"
            :disabled="option.disabled"
            :divided="option.divided"
          >
            {{ option.label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 删除确认对话框 -->
    <ConfirmDeleteDialog
      v-model:visible="showDeleteConfirm"
      :file="selectedFileForContextMenu"
      :loading="isDeleting"
      @confirm="confirmDelete"
    />

    <!-- 下载对话框 -->
    <DownloadDialog
      v-model:visible="showDownloadDialog"
      :file="fileForDownload"
      @confirm="handleDownloadToPath"
    />
  </div>
</template>

<style scoped>
.file-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-list > :deep(.el-table) {
  flex: 1;
}

:deep(.selected-row) {
  background-color: var(--el-fill-color-light) !important;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: var(--el-fill-color-lighter);
}
</style>
