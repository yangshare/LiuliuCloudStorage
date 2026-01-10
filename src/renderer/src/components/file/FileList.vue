<script setup lang="ts">
import { NDataTable, NSpin, NAlert, NButton, NEmpty, NTag, NDropdown } from 'naive-ui'
import { h, computed, ref } from 'vue'
import { useFileStore } from '../../stores/fileStore'
import { useTransferStore } from '../../stores/transferStore'
import { useAuthStore } from '../../stores/authStore'
import FileIcon from './FileIcon.vue'
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
    title: '',
    key: 'icon',
    width: 40,
    render: (row: FileItem) => h(FileIcon, { isDir: row.isDir, name: row.name })
  },
  {
    title: '名称',
    key: 'name',
    sorter: 'default'
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

function handleRowClick(row: FileItem) {
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

function handleRowKeydown(row: FileItem, e: KeyboardEvent) {
  if (e.key === 'Enter' && row.isDir) {
    // Enter 键进入文件夹
    e.preventDefault()
    fileStore.enterFolder(row)
  }
}

async function handleDownload(file: FileItem) {
  // TODO: 需要获取用户认证信息（userId, token, username）
  // 暂时使用占位值，需要在 Epic 1 实现认证后更新
  console.log('[FileList] 下载文件:', file.name, '路径:', fileStore.currentPath)

  // 获取当前路径（相对于用户根目录的路径）
  const currentPath = fileStore.currentPath === '/' ? '' : fileStore.currentPath
  const remotePath = `${currentPath}/${file.name}`

  // 临时实现：直接调用 download，但实际需要用户认证信息
  // await transferStore.startDownload(remotePath, file.name, userId, token, username)
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
      label: '另存为...',
      key: 'saveAs',
      disabled: selectedFileForContextMenu.value.isDir
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
  }

  selectedFileForContextMenu.value = null
}

const rowProps = (row: FileItem) => ({
  style: 'cursor: pointer',
  onClick: () => handleRowClick(row),
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
    </n-spin>
  </div>
</template>

<style scoped>
.file-list {
  min-height: 200px;
}
</style>
