/**
 * 拖拽上传区域组件
 * 支持拖拽文件上传
 */

<template>
  <div
    class="upload-drop-zone"
    :class="{ 'is-dragging': isDragging, 'is-active': active }"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div v-if="active || isDragging" class="drop-zone-content">
      <el-icon :size="64" color="#409eff">
        <Upload />
      </el-icon>
      <div class="drop-text">
        <div class="drop-title">拖拽文件到此处上传</div>
        <div class="drop-hint">释放鼠标即可开始上传</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Upload } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useUpload } from '../composables/useUpload';

interface Props {
  targetPath?: string;
  active?: boolean;
}

interface Emits {
  (e: 'dropped', files: IUploadFile[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  targetPath: '/',
  active: false
});

const emit = defineEmits<Emits>();

const { uploadFiles } = useUpload();
const isDragging = ref(false);

interface IUploadFile {
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: string;
}

/**
 * 处理拖拽进入
 */
const handleDragEnter = (event: DragEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  isDragging.value = true;
};

/**
 * 处理拖拽悬停
 */
const handleDragOver = (event: DragEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  isDragging.value = true;
};

/**
 * 处理拖拽离开
 */
const handleDragLeave = (event: DragEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  isDragging.value = false;
};

/**
 * 处理拖拽释放
 */
const handleDrop = async (event: DragEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  isDragging.value = false;

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const uploadFiles: IUploadFile[] = [];

  // 处理拖拽的文件
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = (file as any).path || file.name;

    uploadFiles.push({
      name: file.name,
      path,
      size: file.size,
      type: file.type || 'application/octet-stream',
      lastModified: new Date(file.lastModified).toISOString()
    });
  }

  emit('dropped', uploadFiles);

  ElMessage.success(`已添加 ${uploadFiles.length} 个文件到上传队列`);

  // 开始上传
  await uploadFiles(uploadFiles, props.targetPath);
};
</script>

<style scoped>
.upload-drop-zone {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0);
  z-index: 9999;
  pointer-events: none;
  transition: all 0.3s;
}

.upload-drop-zone.is-active.is-dragging {
  background: rgba(0, 0, 0, 0.5);
  pointer-events: auto;
}

.drop-zone-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 48px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: all 0.3s;
}

.upload-drop-zone.is-active.is-dragging .drop-zone-content {
  opacity: 1;
}

.drop-text {
  text-align: center;
}

.drop-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.drop-hint {
  font-size: 14px;
  color: #909399;
}
</style>
