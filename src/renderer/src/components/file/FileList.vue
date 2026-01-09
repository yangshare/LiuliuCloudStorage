<script setup lang="ts">
import { NDataTable, NSpin, NAlert, NButton, NEmpty } from 'naive-ui'
import { h } from 'vue'
import { useFileStore } from '../../stores/fileStore'
import FileIcon from './FileIcon.vue'
import { formatFileSize, formatDate } from '../../utils/formatters'
import type { FileItem } from '../../../../shared/types/electron'

const fileStore = useFileStore()

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

const rowProps = (row: FileItem) => ({
  style: 'cursor: pointer',
  onClick: () => handleRowClick(row)
})
</script>

<template>
  <div class="file-list">
    <n-spin :show="fileStore.isLoadingFiles">
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
    </n-spin>
  </div>
</template>

<style scoped>
.file-list {
  min-height: 200px;
}
</style>
