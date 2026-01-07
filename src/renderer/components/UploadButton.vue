/**
 * 上传按钮组件
 * 支持文件选择和文件夹上传
 */

<template>
  <div class="upload-button-container">
    <el-dropdown trigger="click" @command="handleCommand">
      <el-button type="primary" :size="size" :loading="uploading">
        <el-icon><Upload /></el-icon>
        上传
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="file">
            <el-icon><Document /></el-icon>
            上传文件
          </el-dropdown-item>
          <el-dropdown-item command="folder">
            <el-icon><Folder /></el-icon>
            上传文件夹
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      :multiple="multiple"
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 隐藏的文件夹输入 -->
    <input
      ref="folderInputRef"
      type="file"
      webkitdirectory
      directory
      multiple
      style="display: none"
      @change="handleFolderSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Upload, Document, Folder } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useUpload } from '../composables/useUpload';

interface Props {
  targetPath?: string;
  size?: 'large' | 'default' | 'small';
  multiple?: boolean;
}

interface Emits {
  (e: 'selected', files: IUploadFile[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  targetPath: '/',
  size: 'default',
  multiple: true
});

const emit = defineEmits<Emits>();

const { uploading, uploadFiles } = useUpload();

const fileInputRef = ref<HTMLInputElement>();
const folderInputRef = ref<HTMLInputElement>();

interface IUploadFile {
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: string;
}

/**
 * 处理下拉菜单命令
 */
const handleCommand = (command: string): void => {
  if (command === 'file') {
    selectFiles();
  } else if (command === 'folder') {
    selectFolder();
  }
};

/**
 * 选择文件
 */
const selectFiles = (): void => {
  fileInputRef.value?.click();
};

/**
 * 选择文件夹
 */
const selectFolder = (): void => {
  folderInputRef.value?.click();
};

/**
 * 处理文件选择
 */
const handleFileSelect = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (!files || files.length === 0) return;

  const uploadFiles: IUploadFile[] = Array.from(files).map(file => ({
    name: file.name,
    path: (file as any).path || file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    lastModified: new Date(file.lastModified).toISOString()
  }));

  emit('selected', uploadFiles);

  // 开始上传
  await uploadFiles(uploadFiles, props.targetPath);

  // 重置输入
  target.value = '';
};

/**
 * 处理文件夹选择
 */
const handleFolderSelect = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (!files || files.length === 0) return;

  const uploadFiles: IUploadFile[] = Array.from(files).map(file => ({
    name: file.webkitRelativePath || file.name,
    path: (file as any).path || file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    lastModified: new Date(file.lastModified).toISOString()
  }));

  ElMessage.info(`已选择 ${uploadFiles.length} 个文件`);

  emit('selected', uploadFiles);

  // 开始上传
  await uploadFiles(uploadFiles, props.targetPath);

  // 重置输入
  target.value = '';
};
</script>

<style scoped>
.upload-button-container {
  display: inline-block;
}
</style>
