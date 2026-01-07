/**
 * 文件浏览主视图
 * 集成所有文件浏览功能
 */

<template>
  <div class="file-explorer-view">
    <!-- 拖拽上传区域 -->
    <UploadDropZone
      :target-path="currentPath"
      :active="true"
      @dropped="handleFilesDropped"
    />

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button-group>
          <el-tooltip content="新建文件夹" placement="bottom">
            <el-button @click="handleCreateFolder" :icon="FolderAdd">
              新建文件夹
            </el-button>
          </el-tooltip>
          <!-- 上传按钮 -->
          <UploadButton :target-path="currentPath" @selected="handleFilesSelected" />
        </el-button-group>

        <el-divider direction="vertical" />

        <el-button-group>
          <el-tooltip content="粘贴" placement="bottom">
            <el-button
              @click="handlePaste"
              :disabled="!clipboardFiles || clipboardFiles.length === 0"
              :icon="Paste"
            >
              粘贴 ({{ clipboardFiles?.length || 0 }})
            </el-button>
          </el-tooltip>
        </el-button-group>

        <el-divider direction="vertical" />

        <el-button-group>
          <el-tooltip content="删除" placement="bottom">
            <el-button
              @click="handleDelete"
              :disabled="!hasSelection"
              type="danger"
              :icon="Delete"
            >
              删除
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>

      <div class="toolbar-right">
        <!-- 传输管理 -->
        <el-badge :value="transferStore.totalActiveCount" :hidden="transferStore.totalActiveCount === 0">
          <el-button @click="handleOpenTransferManager" :icon="Files">
            传输管理
          </el-button>
        </el-badge>

        <!-- 视图切换 -->
        <el-button-group>
          <el-tooltip content="列表视图" placement="bottom">
            <el-button
              :type="viewMode === 'list' ? 'primary' : ''"
              @click="setViewMode('list')"
              :icon="List"
            />
          </el-tooltip>
          <el-tooltip content="网格视图" placement="bottom">
            <el-button
              :type="viewMode === 'grid' ? 'primary' : ''"
              @click="setViewMode('grid')"
              :icon="Grid"
            />
          </el-tooltip>
        </el-button-group>

        <!-- 排序 -->
        <el-dropdown trigger="click" @command="handleSortCommand">
          <el-button :icon="Sort">
            排序
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="name-asc">
                <el-icon><Top /></el-icon>
                名称升序
              </el-dropdown-item>
              <el-dropdown-item command="name-desc">
                <el-icon><Bottom /></el-icon>
                名称降序
              </el-dropdown-item>
              <el-dropdown-item command="size-asc" divided>
                <el-icon><Top /></el-icon>
                大小升序
              </el-dropdown-item>
              <el-dropdown-item command="size-desc">
                <el-icon><Bottom /></el-icon>
                大小降序
              </el-dropdown-item>
              <el-dropdown-item command="modified-asc" divided>
                <el-icon><Top /></el-icon>
                时间升序
              </el-dropdown-item>
              <el-dropdown-item command="modified-desc">
                <el-icon><Bottom /></el-icon>
                时间降序
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 搜索 -->
        <el-input
          v-model="searchKeyword"
          placeholder="搜索文件..."
          :prefix-icon="Search"
          clearable
          @input="handleSearch"
          style="width: 200px;"
        />
      </div>
    </div>

    <!-- 面包屑导航 -->
    <Breadcrumb />

    <!-- 文件列表/网格视图 -->
    <div class="file-view-container">
      <FileList
        v-if="viewMode === 'list'"
        height="calc(100vh - 200px)"
        @open-directory="handleOpenDirectory"
        @download="handleDownload"
        @rename="handleRename"
        @delete="handleDelete"
      />

      <GridView
        v-else
        height="calc(100vh - 200px)"
        @select="handleFileSelect"
        @open="handleOpenFile"
      />
    </div>

    <!-- 新建文件夹对话框 -->
    <CreateFolderDialog
      v-model="showCreateFolderDialog"
      :current-path="currentPath"
      @confirm="handleCreateFolderConfirm"
    />

    <!-- 重命名对话框 -->
    <RenameDialog
      v-model="showRenameDialog"
      :file="currentFile"
      @confirm="handleRenameConfirm"
    />

    <!-- 删除确认对话框 -->
    <DeleteConfirmDialog
      v-model="showDeleteDialog"
      :files="selectedFiles"
      @confirm="handleDeleteConfirm"
    />

    <!-- 上传队列 -->
    <UploadQueue v-if="showUploadQueue" @close="showUploadQueue = false" />

    <!-- 下载队列 -->
    <DownloadQueue v-if="showDownloadQueue" @close="showDownloadQueue = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  FolderAdd,
  Paste,
  Delete,
  List,
  Grid,
  Sort,
  Search,
  Top,
  Bottom,
  Files
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { IFileItem } from '@shared/types/filesystem.types';
import { IUploadFile } from '@shared/types/upload.types';
import {
  useFileSystem
} from '../composables/useFileSystem';
import { useDownload } from '../composables/useDownload';
import { useTransferStore } from '../stores/transferStore';
import Breadcrumb from '../components/Breadcrumb.vue';
import FileList from '../components/FileList.vue';
import GridView from '../components/GridView.vue';
import CreateFolderDialog from '../components/CreateFolderDialog.vue';
import RenameDialog from '../components/RenameDialog.vue';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog.vue';
import UploadButton from '../components/UploadButton.vue';
import UploadDropZone from '../components/UploadDropZone.vue';
import UploadQueue from '../components/UploadQueue.vue';
import DownloadQueue from '../components/DownloadQueue.vue';

// Router
const router = useRouter();

// Composables
const {
  loading,
  currentPath,
  fileList,
  selectedFiles,
  hasSelection,
  viewMode,
  isEmpty,
  loadFileList,
  navigateTo,
  createDirectory,
  renameFile,
  deleteFile,
  deleteMultipleFiles,
  setViewMode,
  setSort,
  searchFiles,
  clearError,
  refresh
} = useFileSystem();

const { downloadFile, downloadFiles } = useDownload();
const transferStore = useTransferStore();

// 对话框状态
const showCreateFolderDialog = ref(false);
const showRenameDialog = ref(false);
const showDeleteDialog = ref(false);
const showUploadQueue = ref(false);
const showDownloadQueue = ref(false);

// 当前操作的文件
const currentFile = ref<IFileItem | null>(null);

// 搜索关键词
const searchKeyword = ref('');

// 剪贴板（简单实现）
const clipboardFiles = ref<IFileItem[]>([]);

// 监听上传队列变化
watch(() => transferStore.hasActiveUploads, (hasActive) => {
  showUploadQueue.value = hasActive;
}, { immediate: true });

// 监听下载队列变化
watch(() => transferStore.hasActiveDownloads, (hasActive) => {
  showDownloadQueue.value = hasActive;
}, { immediate: true });

/**
 * 组件挂载时加载文件列表
 */
onMounted(async () => {
  await loadFileList('/');
});

/**
 * 打开目录
 */
const handleOpenDirectory = async (file: IFileItem): Promise<void> => {
  await navigateTo(file.path || '/');
};

/**
 * 打开文件（双击）
 */
const handleOpenFile = (file: IFileItem): void => {
  if (file.is_dir) {
    handleOpenDirectory(file);
  } else {
    handleDownload(file);
  }
};

/**
 * 文件选择事件
 */
const handleFileSelect = (file: IFileItem): void => {
  // Grid view 的选择逻辑已在 composable 中处理
};

/**
 * 下载文件
 */
const handleDownload = async (file: IFileItem): Promise<void> => {
  if (file.is_dir) {
    // 文件夹暂不支持下载
    ElMessage.info('文件夹下载功能将在后续版本中实现');
    return;
  }
  await downloadFile(file);
};

/**
 * 新建文件夹
 */
const handleCreateFolder = (): void => {
  showCreateFolderDialog.value = true;
};

/**
 * 新建文件夹确认
 */
const handleCreateFolderConfirm = async (folderName: string): Promise<void> => {
  const newPath = `${currentPath.value}/${folderName}`.replace(/\/+/g, '/');
  const result = await createDirectory(newPath);

  if (result.success) {
    ElMessage.success(result.message);
  } else {
    ElMessage.error(result.message);
  }
};

/**
 * 重命名文件
 */
const handleRename = (file: IFileItem): void => {
  currentFile.value = file;
  showRenameDialog.value = true;
};

/**
 * 重命名确认
 */
const handleRenameConfirm = async (newName: string): Promise<void> => {
  if (!currentFile.value) return;

  const result = await renameFile(currentFile.value.path || '', newName);

  if (result.success) {
    ElMessage.success(result.message);
    showRenameDialog.value = false;
  } else {
    ElMessage.error(result.message);
  }
};

/**
 * 删除文件
 */
const handleDelete = (): void => {
  showDeleteDialog.value = true;
};

/**
 * 删除确认
 */
const handleDeleteConfirm = async (): Promise<void> => {
  const files = selectedFiles.value;
  const result = await deleteMultipleFiles(files);

  if (result.success) {
    ElMessage.success(result.message);
    showDeleteDialog.value = false;
  } else {
    ElMessage.warning(result.message);
  }
};

/**
 * 上传文件
 */
const handleUpload = (): void => {
  showUploadQueue.value = true;
};

/**
 * 文件选择后
 */
const handleFilesSelected = (files: IUploadFile[]): void => {
  showUploadQueue.value = true;
};

/**
 * 文件拖放后
 */
const handleFilesDropped = (files: IUploadFile[]): void => {
  showUploadQueue.value = true;
};

/**
 * 粘贴
 */
const handlePaste = (): void => {
  ElMessage.info(`粘贴功能将在后续版本中实现`);
  // TODO: 实现复制/粘贴功能
};

/**
 * 排序命令
 */
const handleSortCommand = (command: string): void => {
  const [field, order] = command.split('-') as [any, any];
  setSort(field, order);
};

/**
 * 搜索
 */
const handleSearch = (): void => {
  searchFiles(searchKeyword.value);
};

/**
 * 打开传输管理
 */
const handleOpenTransferManager = (): void => {
  router.push('/transfers');
};
</script>

<style scoped>
.file-explorer-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f7fa;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-view-container {
  flex: 1;
  overflow: hidden;
}
</style>
