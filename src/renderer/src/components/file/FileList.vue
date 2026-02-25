<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElCheckbox, ElButton, ElInput, ElMessage, ElEmpty } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
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

// 处理文件/文件夹点击
function handleItemClick(event: MouseEvent, file: FileItem, index: number) {
  // 处理多选逻辑
  if (event?.ctrlKey || event?.metaKey) {
    fileStore.toggleSelect(file)
    fileStore.lastClickedIndex = index
    return
  }

  if (event?.shiftKey && fileStore.lastClickedIndex >= 0) {
    fileStore.selectRange(fileStore.lastClickedIndex, index)
    return
  }

  // 普通点击 - 清空之前的选中状态
  fileStore.clearSelection()
  fileStore.lastClickedIndex = index

  if (file.isDir) {
    // 单击目录直接进入
    fileStore.enterFolder(file)
  } else {
    // 单击文件选中
    fileStore.selectFile(file)
  }
}

// 处理双击
function handleItemDoubleClick(file: FileItem) {
  if (file.isDir) {
    // 双击目录进入（备用导航方式）
    fileStore.enterFolder(file)
  }
}

async function handleDownload(file: FileItem) {
  const currentPath = fileStore.currentPath === '/' ? '' : fileStore.currentPath
  const remotePath = `${currentPath}/${file.name}`

  console.log('[FileList] 开始下载:', { remotePath, fileName: file.name })

  ElMessage.info(`正在添加到下载队列: ${file.name}`)

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
function handleContextMenu(file: FileItem, event: MouseEvent) {
  event.preventDefault()
  selectedFileForContextMenu.value = file
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
      await handleDownload(file)
      break

    case 'downloadTo':
      fileForDownload.value = file
      showDownloadDialog.value = true
      break

    case 'saveAs':
      await transferStore.downloadWithSaveAs(
        remotePath,
        file.name,
        authStore.user.id,
        authStore.token,
        authStore.user.username
      )
      break

    case 'openDownloadDir':
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
      startRename(file)
      return

    case 'delete':
      showDeleteConfirm.value = true
      return
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

      if (selectedFileForContextMenu.value.isDir) {
        const deletedFolderPath = fileStore.currentPath === '/'
          ? `/${selectedFileForContextMenu.value.name}`
          : `${fileStore.currentPath}/${selectedFileForContextMenu.value.name}`

        if (fileStore.currentPath.startsWith(deletedFolderPath)) {
          const parentPath = fileStore.currentPath === '/' ? '/' :
            fileStore.currentPath.split('/').slice(0, -1).join('/') || '/'
          fileStore.navigateTo(parentPath)
          return
        }
      }

      fileStore.refresh()

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

      if (editingFile.value.isDir) {
        const oldFolderPath = filePath
        const newFolderPath = fileStore.currentPath === '/'
          ? `/${editingName.value}`
          : `${fileStore.currentPath}/${editingName.value}`

        if (fileStore.currentPath.startsWith(oldFolderPath)) {
          const newPath = fileStore.currentPath.replace(oldFolderPath, newFolderPath)
          fileStore.navigateTo(newPath)
          return
        }
      }

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

    <el-empty v-if="fileStore.filteredFiles.length === 0 && !fileStore.isLoadingFiles" description="暂无文件" />

    <!-- 列表视图 -->
    <div v-else-if="fileStore.viewMode === 'list'" class="list-view">
      <!-- 列表视图表头 -->
      <div class="list-header">
        <div class="header-checkbox">
          <el-checkbox
            :model-value="fileStore.isAllSelected"
            :indeterminate="fileStore.isPartialSelected && !fileStore.isAllSelected"
            @change="fileStore.isAllSelected ? fileStore.deselectAll() : fileStore.selectAll()"
          />
        </div>
        <div class="header-icon"></div>
        <div class="header-name">名称</div>
        <div class="header-size">大小</div>
        <div class="header-date">修改日期</div>
        <div class="header-actions">操作</div>
      </div>

      <div
        v-for="(file, index) in fileStore.filteredFiles"
        :key="file.name"
        class="list-item"
        :class="{ 'selected': fileStore.isSelected(file), 'is-dir': file.isDir }"
        @click="handleItemClick($event, file, index)"
        @dblclick="handleItemDoubleClick(file)"
        @contextmenu="handleContextMenu(file, $event)"
      >
        <!-- 复选框 -->
        <div class="item-checkbox">
          <el-checkbox
            :model-value="fileStore.isSelected(file)"
            @update:model-value="() => fileStore.toggleSelect(file)"
            @click.stop
          />
        </div>

        <!-- 图标 -->
        <div class="item-icon">
          <FileIcon :is-dir="file.isDir" :name="file.name" />
        </div>

        <!-- 名称 -->
        <div class="item-name">
          <!-- 如果正在编辑此文件，显示输入框 -->
          <el-input
            v-if="editingFile && editingFile.name === file.name"
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
          <span v-else class="name-text" :title="file.name">{{ file.name }}</span>
        </div>

        <!-- 大小 -->
        <div class="item-size">
          {{ file.isDir ? '-' : formatFileSize(file.size) }}
        </div>

        <!-- 修改日期 -->
        <div class="item-date">
          {{ formatDate(file.modified) }}
        </div>

        <!-- 操作 -->
        <div class="item-actions">
          <el-button
            v-if="!file.isDir"
            type="primary"
            size="small"
            @click.stop="handleDownload(file)"
          >
            下载
          </el-button>
        </div>
      </div>
    </div>

    <!-- 网格视图 -->
    <div v-else class="grid-view" :class="`density-${fileStore.gridDensity}`" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${fileStore.gridMinWidth}, 1fr))`, columnGap: fileStore.gridGap, rowGap: fileStore.gridRowGap, padding: fileStore.gridPadding }">
      <!-- 全选复选框 -->
      <div class="grid-header">
        <el-checkbox
          :model-value="fileStore.isAllSelected"
          :indeterminate="fileStore.isPartialSelected && !fileStore.isAllSelected"
          @change="fileStore.isAllSelected ? fileStore.deselectAll() : fileStore.selectAll()"
        >
          全选
        </el-checkbox>
      </div>

      <div
        v-for="(file, index) in fileStore.filteredFiles"
        :key="file.name"
        class="grid-item"
        :class="{ 'selected': fileStore.isSelected(file), 'is-dir': file.isDir }"
        @click="handleItemClick($event, file, index)"
        @dblclick="handleItemDoubleClick(file)"
        @contextmenu="handleContextMenu(file, $event)"
      >
        <!-- 复选框 -->
        <div class="grid-item-checkbox">
          <el-checkbox
            :model-value="fileStore.isSelected(file)"
            @update:model-value="() => fileStore.toggleSelect(file)"
            @click.stop
          />
        </div>

        <!-- 图标 -->
        <div class="grid-item-icon">
          <FileIcon :is-dir="file.isDir" :name="file.name" :size="fileStore.gridIconSize" />
        </div>

        <!-- 名称 -->
        <div class="grid-item-name" :title="file.name">
          <!-- 如果正在编辑此文件，显示输入框 -->
          <el-input
            v-if="editingFile && editingFile.name === file.name"
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
          <span v-else class="name-text">{{ file.name }}</span>
        </div>

        <!-- 文件信息（紧凑显示） -->
        <div class="grid-item-info" v-if="!file.isDir">
          <span class="info-size">{{ formatFileSize(file.size) }}</span>
        </div>

        <!-- 快捷操作按钮（紧凑版） -->
        <div class="grid-item-actions" v-if="!file.isDir">
          <el-button
            size="small"
            @click.stop="handleDownload(file)"
            class="compact-action-btn"
            title="下载"
          >
            <el-icon><Download /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

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

/* Alert 样式 - 网易云风格 */
:deep(.el-alert--warning) {
  background: rgba(250, 140, 22, 0.1) !important;
  border: 1px solid rgba(250, 140, 22, 0.2) !important;
  border-radius: var(--radius-md) !important;
}

:deep(.el-alert--error) {
  background: rgba(194, 12, 12, 0.1) !important;
  border: 1px solid rgba(194, 12, 12, 0.2) !important;
  border-radius: var(--radius-md) !important;
}

/* ========== 列表视图样式 ========== */
.list-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
}

.list-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(245, 245, 245, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-weight: 600;
  font-size: 13px;
  position: sticky;
  top: 0;
  z-index: 10;
  color: var(--netease-gray-7);
}

.header-checkbox {
  width: 50px;
  text-align: center;
}

.header-icon {
  width: 50px;
  text-align: center;
}

.header-name {
  flex: 1;
  min-width: 200px;
}

.header-size {
  width: 120px;
}

.header-date {
  width: 180px;
}

.header-actions {
  width: 100px;
  text-align: center;
}

.list-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
}

.list-item:hover {
  background: rgba(245, 245, 245, 0.5);
  backdrop-filter: blur(5px);
}

.list-item.selected {
  background: var(--netease-red-pale);
  border-bottom: 1px solid rgba(194, 12, 12, 0.1);
}

.list-item.is-dir {
  font-weight: 500;
}

.item-checkbox {
  width: 50px;
  text-align: center;
}

.item-icon {
  width: 50px;
  text-align: center;
}

.item-name {
  flex: 1;
  min-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-size {
  width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--netease-gray-6);
}

.item-date {
  width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--netease-gray-6);
}

.item-actions {
  width: 100px;
  text-align: center;
}

/* 列表视图按钮 */
:deep(.list-item .el-button--primary) {
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
  border: none !important;
  border-radius: var(--radius-sm) !important;
  box-shadow: 0 2px 6px rgba(194, 12, 12, 0.25);
}

/* ========== 网格视图样式 ========== */
.grid-view {
  display: grid;
  overflow-y: auto;
  flex: 1;
  align-content: start;
  align-items: start;
  transition: all 0.3s ease;
  min-height: 0;
}

.grid-header {
  grid-column: 1 / -1;
  padding: 8px 8px 12px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  height: auto;
  align-self: start;
  margin-bottom: 0;
  background: rgba(245, 245, 245, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-md);
  margin: 4px;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  min-height: 110px;
  justify-content: space-between;
  overflow: hidden;
}

/* 密度特定样式 */
.grid-view.density-compact .grid-item {
  padding: 8px;
  min-height: 100px;
}

.grid-view.density-comfortable .grid-item {
  padding: 12px;
  min-height: 120px;
}

.grid-view.density-spacious .grid-item {
  padding: 14px;
  min-height: 140px;
}

.grid-item:hover {
  border-color: var(--netease-red);
  box-shadow: 0 4px 12px rgba(194, 12, 12, 0.2);
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.9);
}

.grid-item.selected {
  border-color: var(--netease-red);
  background: var(--netease-red-pale);
  box-shadow: 0 0 0 2px rgba(194, 12, 12, 0.1);
}

.grid-item.is-dir {
  border-color: rgba(250, 140, 22, 0.2);
  background: rgba(250, 140, 22, 0.05);
}

.grid-item.is-dir:hover {
  border-color: #FA8C16;
  background: rgba(250, 140, 22, 0.1);
}

.grid-item-checkbox {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 2;
}

.grid-item-icon {
  margin-bottom: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 48px;
  height: 48px;
}

.grid-item-name {
  width: 100%;
  text-align: center;
  font-size: 12px;
  margin-bottom: 4px;
  padding: 0 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  flex: 1;
  color: var(--netease-gray-7);
}

.grid-item-name .name-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.grid-item-info {
  display: flex;
  justify-content: center;
  gap: 4px;
  font-size: 10px;
  color: var(--netease-gray-5);
  margin-bottom: 4px;
}

.info-size {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.grid-item-actions {
  margin-top: auto;
  width: 100%;
  display: flex;
  justify-content: center;
}

.compact-action-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: var(--radius-sm);
  font-size: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}

.compact-action-btn:hover {
  border-color: var(--netease-red);
  background: var(--netease-red);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(194, 12, 12, 0.3);
}

/* Checkbox 样式 */
:deep(.el-checkbox) {
  font-weight: 500;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: var(--netease-red) !important;
  border-color: var(--netease-red) !important;
}

:deep(.el-checkbox__inner:hover) {
  border-color: var(--netease-red) !important;
}

/* 空状态 */
:deep(.el-empty) {
  padding: 60px 0;
}

:deep(.el-empty__description) {
  color: var(--netease-gray-5);
}

/* 下拉菜单 */
:deep(.el-dropdown-menu) {
  border-radius: var(--radius-md) !important;
  box-shadow: var(--shadow-lg) !important;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

:deep(.el-dropdown-menu__item:hover) {
  background: var(--netease-red-pale) !important;
  color: var(--netease-red) !important;
}

:deep(.el-dropdown-menu__item.is-disabled) {
  color: var(--netease-gray-4) !important;
}

/* 输入框 */
:deep(.el-input__wrapper) {
  border-radius: var(--radius-sm) !important;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1) inset !important;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--netease-red) inset !important;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--netease-red) inset !important;
}
</style>