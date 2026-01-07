/**
 * 传输历史组件
 * 显示传输任务的历史记录
 */

<template>
  <div class="transfer-history">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索历史记录..."
          :prefix-icon="Search"
          clearable
          style="width: 250px;"
          @input="handleSearch"
        />

        <el-select
          v-model="filterType"
          placeholder="筛选类型"
          style="width: 120px;"
          @change="handleFilter"
        >
          <el-option label="全部" value="" />
          <el-option label="上传" value="upload" />
          <el-option label="下载" value="download" />
        </el-select>

        <el-select
          v-model="filterStatus"
          placeholder="筛选状态"
          style="width: 120px;"
          @change="handleFilter"
        >
          <el-option label="全部" value="" />
          <el-option label="成功" value="completed" />
          <el-option label="失败" value="failed" />
        </el-select>
      </div>

      <div class="toolbar-right">
        <el-button
          type="danger"
          :icon="Delete"
          @click="handleClearHistory"
          :disabled="filteredHistory.length === 0"
        >
          清空历史
        </el-button>
      </div>
    </div>

    <!-- 历史记录列表 -->
    <div class="history-list">
      <el-table
        :data="filteredHistory"
        stripe
        style="width: 100%"
        :empty-text="'暂无历史记录'"
      >
        <!-- 类型图标 -->
        <el-table-column label="类型" width="60" align="center">
          <template #default="{ row }">
            <el-icon
              :class="['type-icon', row.type]"
              :size="20"
            >
              <component :is="row.type === 'upload' ? Upload : Download" />
            </el-icon>
          </template>
        </el-table-column>

        <!-- 文件名 -->
        <el-table-column prop="fileName" label="文件名" min-width="200">
          <template #default="{ row }">
            <div class="file-name">
              <el-icon class="file-icon"><Document /></el-icon>
              <span class="name-text">{{ row.fileName }}</span>
            </div>
          </template>
        </el-table-column>

        <!-- 文件路径 -->
        <el-table-column prop="filePath" label="路径" min-width="150" show-overflow-tooltip />

        <!-- 文件大小 -->
        <el-table-column label="大小" width="100" align="right">
          <template #default="{ row }">
            {{ formatSize(row.fileSize) }}
          </template>
        </el-table-column>

        <!-- 状态 -->
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag
              :type="getStatusType(row.status)"
              size="small"
            >
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 进度 -->
        <el-table-column label="进度" width="120">
          <template #default="{ row }">
            <el-progress
              :percentage="row.progress.percentage"
              :status="row.status === 'completed' ? 'success' : (row.status === 'failed' ? 'exception' : undefined)"
              :stroke-width="6"
            />
          </template>
        </el-table-column>

        <!-- 持续时间 -->
        <el-table-column label="耗时" width="90" align="right">
          <template #default="{ row }">
            {{ formatDuration(row.duration) }}
          </template>
        </el-table-column>

        <!-- 开始时间 -->
        <el-table-column label="开始时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.startTime) }}
          </template>
        </el-table-column>

        <!-- 操作 -->
        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="danger"
              link
              :icon="Delete"
              @click="handleRemove(row)"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import {
  Search,
  Delete,
  Upload,
  Download,
  Document
} from '@element-plus/icons-vue';
import { useTransferStore } from '../../stores/transferStore';
import { TransferType } from '@shared/types/transfer.types';

const transferStore = useTransferStore();

// 搜索和筛选
const searchKeyword = ref('');
const filterType = ref('');
const filterStatus = ref('');

// 过滤后的历史记录
const filteredHistory = computed(() => {
  let history = [...transferStore.transferHistory];

  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    history = history.filter(item =>
      item.fileName.toLowerCase().includes(keyword) ||
      item.filePath.toLowerCase().includes(keyword)
    );
  }

  // 类型过滤
  if (filterType.value) {
    history = history.filter(item => {
      if (filterType.value === 'upload') {
        return item.type === TransferType.UPLOAD;
      } else if (filterType.value === 'download') {
        return item.type === TransferType.DOWNLOAD;
      }
      return true;
    });
  }

  // 状态过滤
  if (filterStatus.value) {
    history = history.filter(item => item.status === filterStatus.value);
  }

  return history;
});

/**
 * 搜索
 */
function handleSearch(): void {
  // 搜索逻辑通过 computed 实现
}

/**
 * 筛选
 */
function handleFilter(): void {
  // 筛选逻辑通过 computed 实现
}

/**
 * 移除历史记录
 */
async function handleRemove(item: any): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除 "${item.fileName}" 的历史记录吗？`,
      '确认删除',
      {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }
    );

    transferStore.removeHistoryItem(item.id);
    ElMessage.success('删除成功');
  } catch {
    // 用户取消
  }
}

/**
 * 清空历史记录
 */
async function handleClearHistory(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有历史记录吗？此操作不可恢复。',
      '确认清空',
      {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }
    );

    transferStore.clearHistory();
    ElMessage.success('历史记录已清空');
  } catch {
    // 用户取消
  }
}

/**
 * 获取状态类型
 */
function getStatusType(status: string): string {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'cancelled':
      return 'info';
    default:
      return '';
  }
}

/**
 * 获取状态文本
 */
function getStatusText(status: string): string {
  switch (status) {
    case 'completed':
      return '成功';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
    case 'paused':
      return '已暂停';
    default:
      return '未知';
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

/**
 * 格式化持续时间
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}分${secs}秒`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分`;
  }
}

/**
 * 格式化时间
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 今天
  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // 昨天
  if (diff < 48 * 60 * 60 * 1000) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // 更早
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
</script>

<style scoped>
.transfer-history {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
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

.history-list {
  flex: 1;
  overflow-y: auto;
  background: #ffffff;
}

.type-icon {
  font-size: 20px;
}

.type-icon.upload {
  color: #409eff;
}

.type-icon.download {
  color: #67c23a;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  color: #909399;
  font-size: 16px;
}

.name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
