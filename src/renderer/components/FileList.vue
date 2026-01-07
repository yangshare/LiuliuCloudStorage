/**
 * 文件列表组件（表格视图）
 * 支持排序、选择、批量操作
 */

<template>
  <div class="file-list-container">
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="fileList"
      row-key="path"
      :height="height"
      @selection-change="handleSelectionChange"
      @row-dblclick="handleRowDoubleClick"
      @row-contextmenu="handleRowContextMenu"
      stripe
      highlight-current-row
    >
      <!-- 选择列 -->
      <el-table-column
        type="selection"
        width="55"
        :reserve-selection="true"
      />

      <!-- 图标列 -->
      <el-table-column
        label="名称"
        prop="name"
        min-width="200"
        sortable
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <div class="file-name-cell">
            <el-icon :size="20" :color="getFileIconColor(row)">
              <component :is="getFileIcon(row)" />
            </el-icon>
            <span class="file-name">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>

      <!-- 大小列 -->
      <el-table-column
        label="大小"
        prop="size"
        width="120"
        sortable
        align="right"
      >
        <template #default="{ row }">
          {{ row.is_dir ? '-' : formatFileSize(row.size) }}
        </template>
      </el-table-column>

      <!-- 修改时间列 -->
      <el-table-column
        label="修改时间"
        prop="modified"
        width="180"
        sortable
      >
        <template #default="{ row }">
          {{ formatModifiedTime(row.modified) }}
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column
        label="操作"
        width="180"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button-group size="small">
            <el-tooltip content="打开" placement="top">
              <el-button
                v-if="row.is_dir"
                @click="handleOpenDirectory(row)"
                circle
              >
                <el-icon><FolderOpened /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="下载" placement="top">
              <el-button
                v-if="!row.is_dir"
                @click="handleDownload(row)"
                circle
              >
                <el-icon><Download /></el-icon>
              </el-button>
            </el-tooltip>
            <el-dropdown trigger="click" @command="(cmd) => handleMoreAction(cmd, row)">
              <el-button circle>
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">
                    <el-icon><Edit /></el-icon>
                    重命名
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <!-- 空状态 -->
    <el-empty
      v-if="!loading && isEmpty"
      description="当前目录为空"
      :image-size="120"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElTable } from 'element-plus';
import {
  FolderOpened,
  Download,
  Edit,
  Delete,
  MoreFilled
} from '@element-plus/icons-vue';
import { IFileItem } from '@shared/types/filesystem.types';
import { useFileSystem } from '../composables/useFileSystem';

interface Props {
  height?: string | number;
}

interface Emits {
  (e: 'open-directory', file: IFileItem): void;
  (e: 'download', file: IFileItem): void;
  (e: 'rename', file: IFileItem): void;
  (e: 'delete', file: IFileItem): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const {
  loading,
  fileList,
  isEmpty,
  selectedFiles,
  getFileIcon,
  formatFileSize,
  formatModifiedTime,
  toggleSelection,
  clearSelection
} = useFileSystem();

const tableRef = ref<InstanceType<typeof ElTable>>();

/**
 * 获取文件图标颜色
 */
const getFileIconColor = (file: IFileItem): string => {
  if (file.is_dir) {
    return '#409eff';
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const colorMap: Record<string, string> = {
    pdf: '#f56c6c',
    doc: '#409eff',
    docx: '#409eff',
    xls: '#67c23a',
    xlsx: '#67c23a',
    ppt: '#e6a23c',
    pptx: '#e6a23c'
  };
  return colorMap[ext] || '#909399';
};

/**
 * 选择变化事件
 */
const handleSelectionChange = (selection: IFileItem[]): void => {
  clearSelection();
  selection.forEach(file => toggleSelection(file));
};

/**
 * 双击行事件
 */
const handleRowDoubleClick = (row: IFileItem): void => {
  if (row.is_dir) {
    handleOpenDirectory(row);
  } else {
    handleDownload(row);
  }
};

/**
 * 右键菜单事件
 */
const handleRowContextMenu = (row: IFileItem, column: any, event: MouseEvent): void => {
  event.preventDefault();
  if (!selectedFiles.value.some(f => f.path === row.path)) {
    tableRef.value?.clearSelection();
    tableRef.value?.toggleRowSelection(row, true);
  }
};

/**
 * 打开目录
 */
const handleOpenDirectory = (file: IFileItem): void => {
  emit('open-directory', file);
};

/**
 * 下载文件
 */
const handleDownload = (file: IFileItem): void => {
  emit('download', file);
};

/**
 * 更多操作
 */
const handleMoreAction = (command: string, file: IFileItem): void => {
  switch (command) {
    case 'rename':
      emit('rename', file);
      break;
    case 'delete':
      emit('delete', file);
      break;
  }
};

/**
 * 清空选择
 */
const clearTableSelection = (): void => {
  tableRef.value?.clearSelection();
  clearSelection();
};

defineExpose({
  clearSelection: clearTableSelection
});
</script>

<style scoped>
.file-list-container {
  height: 100%;
  background: #ffffff;
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}
</style>
