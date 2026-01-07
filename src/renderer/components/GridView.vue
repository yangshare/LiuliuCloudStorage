/**
 * 文件网格视图组件
 * 适合查看图片、视频等媒体文件
 */

<template>
  <div class="grid-view-container">
    <el-scrollbar :height="height">
      <div
        v-loading="loading"
        class="grid-content"
        element-loading-text="加载中..."
      >
        <div
          v-for="file in fileList"
          :key="file.path"
          class="grid-item"
          :class="{ 'is-selected': isSelected(file) }"
          @click="handleClick(file)"
          @dblclick="handleDoubleClick(file)"
        >
          <div class="grid-item-icon">
            <el-icon :size="48" :color="getFileIconColor(file)">
              <component :is="getFileIcon(file)" />
            </el-icon>
          </div>

          <!-- 缩略图（如果有） -->
          <div v-if="file.thumb" class="grid-item-thumb">
            <el-image
              :src="file.thumb"
              fit="cover"
              lazy
              :preview-src-list="[file.thumb]"
            />
          </div>

          <div class="grid-item-info">
            <div class="file-name" :title="file.name">
              {{ file.name }}
            </div>
            <div class="file-meta">
              {{ file.is_dir ? '文件夹' : formatFileSize(file.size) }}
            </div>
          </div>

          <!-- 选中标记 -->
          <div v-if="isSelected(file)" class="grid-item-check">
            <el-icon :size="20" color="#409eff">
              <Check />
            </el-icon>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-if="!loading && isEmpty"
        description="当前目录为空"
        :image-size="120"
      />
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Check } from '@element-plus/icons-vue';
import { IFileItem } from '@shared/types/filesystem.types';
import { useFileSystem } from '../composables/useFileSystem';

interface Props {
  height?: string | number;
}

interface Emits {
  (e: 'select', file: IFileItem): void;
  (e: 'open', file: IFileItem): void;
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
  toggleSelection
} = useFileSystem();

/**
 * 判断是否选中
 */
const isSelected = (file: IFileItem): boolean => {
  return selectedFiles.value.some(f => f.path === file.path);
};

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
 * 单击事件
 */
const handleClick = (file: IFileItem): void => {
  toggleSelection(file);
  emit('select', file);
};

/**
 * 双击事件
 */
const handleDoubleClick = (file: IFileItem): void => {
  emit('open', file);
};
</script>

<style scoped>
.grid-view-container {
  height: 100%;
  background: #f5f7fa;
}

.grid-content {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  padding: 16px;
}

.grid-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  user-select: none;
}

.grid-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.grid-item.is-selected {
  background: #ecf5ff;
  border: 2px solid #409eff;
}

.grid-item-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.grid-item-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 80px;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
}

.grid-item-thumb :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.grid-item-info {
  width: 100%;
  text-align: center;
}

.grid-item-info .file-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.grid-item-info .file-meta {
  font-size: 12px;
  color: #909399;
}

.grid-item-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
