<script setup lang="ts">
import { NDataTable, NSpin, NAlert, NButton, NEmpty, NTag, NDropdown, NModal, NCheckbox, NInput, useMessage } from 'naive-ui'
import { h, computed, ref } from 'vue'
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
const message = useMessage()

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

const columns = [
  {
    title: () => h(NCheckbox, {
      checked: fileStore.isAllSelected,
      indeterminate: fileStore.isPartialSelected && !fileStore.isAllSelected,
      onUpdateChecked: (checked: boolean) => {
        if (checked) {
          fileStore.selectAll()
        } else {
          fileStore.deselectAll()
        }
      }
    }),
    key: 'checkbox',
    width: 40,
    render: (row: FileItem) => h(NCheckbox, {
      checked: fileStore.isSelected(row),
      onUpdateChecked: (checked: boolean) => {
        fileStore.toggleSelect(row)
      },
      onClick: (e: Event) => {
        e.stopPropagation() // 阻止事件冒泡，避免触发行点击
      }
    })
  },
  {
    title: '',
    key: 'icon',
    width: 40,
    render: (row: FileItem) => h(FileIcon, { isDir: row.isDir, name: row.name })
  },
  {
    title: '名称',
    key: 'name',
    sorter: 'default',
    render: (row: FileItem) => {
      // 如果正在编辑此文件,显示输入框
      if (editingFile.value && editingFile.value.name === row.name) {
        return h(NInput, {
          value: editingName.value,
          size: 'small',
          autofocus: true,
          loading: isRenaming.value,
          onUpdateValue: (value: string) => { editingName.value = value },
          onKeyup: (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              confirmRename()
            } else if (e.key === 'Escape') {
              cancelRename()
            }
          },
          onBlur: cancelRename
        })
      }
      // 否则显示文件名
      return row.name
    }
  },
  {
    title: '大小',
    key: 'size',
    width: 100,
    render: (row: FileItem) => row.isDir ? '-' : formatFileSize(row.size)
  },
  {
    title: '修改日期',
    key: 'modified',
    width: 160,
    render: (row: FileItem) => formatDate(row.modified)
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row: FileItem) => {
      // 文件显示下载按钮，目录不显示
      if (row.isDir) {
        return null
      }
      return h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          onClick: (e: Event) => {
            e.stopPropagation()
            handleDownload(row)
          }
        },
        { default: () => '下载' }
      )
    }
  }
]

function handleRetry() {
  fileStore.refresh()
}

function handleRowClick(row: FileItem, index: number, event?: MouseEvent) {
  // 处理多选逻辑
  if (event?.ctrlKey || event?.metaKey) {
    // Ctrl/Cmd + 点击：切换选中状态
    fileStore.toggleSelect(row)
    fileStore.lastClickedIndex = index
    return
  }

  if (event?.shiftKey && fileStore.lastClickedIndex >= 0) {
    // Shift + 点击：范围选择
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

  fileStore.lastClickedIndex = index
}

function handleRowDoubleClick(row: FileItem) {
  if (row.isDir) {
    // 双击目录进入（备用导航方式）
    fileStore.enterFolder(row)
  }
}

function handleRowKeydown(row: FileItem, e: KeyboardEvent) {
  if (e.key === 'Enter' && row.isDir) {
    // Enter 键进入文件夹
    e.preventDefault()
    fileStore.enterFolder(row)
  }
}

async function handleDownload(file: FileItem) {
  // 获取当前路径（相对于用户根目录的路径）
  const currentPath = fileStore.currentPath === '/' ? '' : fileStore.currentPath
  const remotePath = `${currentPath}/${file.name}`

  console.log('[FileList] 开始下载:', { remotePath, fileName: file.name })

  // 立即显示 toast 提示
  message.info(`正在添加到下载队列: ${file.name}`)

  // 添加到下载队列
  try {
    console.log('[FileList] 调用 transferStore.queueDownload, remotePath:', remotePath, 'fileName:', file.name)
    const result = await transferStore.queueDownload(remotePath, file.name)
    console.log('[FileList] queueDownload 返回值类型:', typeof result, '是否为null:', result === null, '值:', result)
    if (result?.success) {
      console.log('[FileList] 准备显示成功消息')
      message.success(`已添加到下载队列: ${file.name}`)
    } else {
      console.log('[FileList] 准备显示错误消息, error:', result?.error)
      message.error(result?.error || '添加到下载队列失败')
    }
  } catch (error: any) {
    console.error('[FileList] queueDownload 异常:', error)
    message.error(error.message || '下载失败')
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
    { type: 'divider', key: 'd1' },
    {
      label: '打开下载目录',
      key: 'openDownloadDir'
    },
    { type: 'divider', key: 'd2' },
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
function handleContextMenu(row: FileItem, e: MouseEvent) {
  e.preventDefault()
  selectedFileForContextMenu.value = row
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
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
          message.error(result?.error || '无法打开目录')
        }
      } catch (error: any) {
        message.error('打开目录失败: ' + error.message)
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
      message.success('删除成功')

      // 如果删除的是文件夹,从目录树中移除并刷新父节点
      if (selectedFileForContextMenu.value.isDir) {
        const deletedFolderPath = fileStore.currentPath === '/'
          ? `/${selectedFileForContextMenu.value.name}`
          : `${fileStore.currentPath}/${selectedFileForContextMenu.value.name}`

        fileStore.removeTreeNode(deletedFolderPath)
        await fileStore.refreshTreeNode(fileStore.currentPath)

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
      message.error(result.error || '删除失败')
    }
  } catch (error: any) {
    message.error(error.message || '删除失败')
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
      message.success('重命名成功')

      // 如果重命名的是文件夹,需要处理目录树和路径更新
      if (editingFile.value.isDir) {
        const oldFolderPath = filePath
        const newFolderPath = fileStore.currentPath === '/'
          ? `/${editingName.value}`
          : `${fileStore.currentPath}/${editingName.value}`

        // 更新目录树节点的label
        fileStore.updateTreeNodeLabel(oldFolderPath, editingName.value)

        // Task 3.2: 如果当前路径包含被重命名的文件夹,更新当前路径
        if (fileStore.currentPath.startsWith(oldFolderPath)) {
          const newPath = fileStore.currentPath.replace(oldFolderPath, newFolderPath)
          fileStore.navigateTo(newPath)
          return // 导航会触发刷新,不需要继续执行
        }

        // 刷新父节点以更新目录树
        await fileStore.refreshTreeNode(fileStore.currentPath)
      }

      // 刷新文件列表
      fileStore.refresh()
    } else {
      message.error(result.error || '重命名失败')
    }
  } catch (error: any) {
    message.error(error.message || '重命名失败')
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
    message.info(`正在下载到: ${savePath}`)
    const result = await window.electronAPI.transfer.download(
      remotePath,
      file.name,
      authStore.user.id,
      authStore.token,
      authStore.user.username,
      savePath
    )

    if (result?.success) {
      message.success(`已添加到下载队列: ${file.name}`)
    } else {
      message.error(result?.error || '下载失败')
    }
  } catch (error: any) {
    message.error(error.message || '下载失败')
  } finally {
    fileForDownload.value = null
  }
}

const rowProps = (row: FileItem, index: number) => ({
  style: fileStore.isSelected(row) ? 'cursor: pointer; background-color: var(--n-color-hover);' : 'cursor: pointer',
  onClick: (e: MouseEvent) => handleRowClick(row, index, e),
  onDblclick: () => handleRowDoubleClick(row),
  onKeydown: (e: KeyboardEvent) => handleRowKeydown(row, e),
  onContextmenu: (e: MouseEvent) => handleContextMenu(row, e)
})
</script>

<template>
  <div class="file-list">
    <n-spin :show="fileStore.isLoadingFiles">
      <!-- 离线模式提示 -->
      <n-alert
        v-if="offlineModeMessage"
        type="warning"
        :title="offlineModeMessage"
        closable
        style="margin-bottom: 12px"
      />

      <!-- 错误提示 -->
      <n-alert
        v-if="fileStore.filesError"
        type="error"
        :title="fileStore.filesError"
        closable
      >
        <template #action>
          <n-button size="small" @click="handleRetry">重试</n-button>
        </template>
      </n-alert>

      <n-empty v-else-if="fileStore.sortedFiles.length === 0 && !fileStore.isLoadingFiles" description="暂无文件" />

      <n-data-table
        v-else
        :columns="columns"
        :data="fileStore.sortedFiles"
        :bordered="false"
        :single-line="false"
        :row-key="(row: FileItem) => row.name"
        :row-props="rowProps"
      />

      <!-- 右键菜单 -->
      <n-dropdown
        placement="bottom-start"
        trigger="manual"
        :show="showContextMenu"
        :x="contextMenuX"
        :y="contextMenuY"
        :options="contextMenuOptions"
        @select="handleContextMenuSelect"
        @clickoutside="showContextMenu = false"
      />

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
    </n-spin>
  </div>
</template>

<style scoped>
.file-list {
  min-height: 200px;
}
</style>
