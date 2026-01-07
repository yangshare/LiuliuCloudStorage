/**
 * 传输管理视图
 * 统一管理上传和下载任务
 */

<template>
  <div class="transfer-manager-view">
    <!-- 传输统计面板 -->
    <TransferStats />

    <!-- 选项卡 -->
    <el-tabs v-model="activeTab" class="transfer-tabs">
      <!-- 上传队列 -->
      <el-tab-pane label="上传队列" name="upload">
        <UploadQueue
          v-if="hasActiveUploads || uploadCount > 0"
          @close="handleCloseUploadQueue"
        />
        <el-empty
          v-else
          description="暂无上传任务"
          :image-size="120"
        />
      </el-tab-pane>

      <!-- 下载队列 -->
      <el-tab-pane label="下载队列" name="download">
        <DownloadQueue
          v-if="hasActiveDownloads || downloadCount > 0"
          @close="handleCloseDownloadQueue"
        />
        <el-empty
          v-else
          description="暂无下载任务"
          :image-size="120"
        />
      </el-tab-pane>

      <!-- 传输历史 -->
      <el-tab-pane label="传输历史" name="history">
        <TransferHistory />
      </el-tab-pane>

      <!-- 设置 -->
      <el-tab-pane label="传输设置" name="settings">
        <TransferSettings />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTransferStore } from '../stores/transferStore';
import TransferStats from '../components/transfer/TransferStats.vue';
import UploadQueue from '../components/UploadQueue.vue';
import DownloadQueue from '../components/DownloadQueue.vue';
import TransferHistory from '../components/transfer/TransferHistory.vue';
import TransferSettings from '../components/transfer/TransferSettings.vue';

const transferStore = useTransferStore();

// 当前选项卡
const activeTab = ref('upload');

// 上传任务状态
const hasActiveUploads = computed(() => transferStore.hasActiveUploads);
const uploadCount = computed(() => transferStore.uploadCount);

// 下载任务状态
const hasActiveDownloads = computed(() => transferStore.hasActiveDownloads);
const downloadCount = computed(() => transferStore.downloadQueue.length);

/**
 * 关闭上传队列
 */
const handleCloseUploadQueue = (): void => {
  transferStore.clearUploadQueue();
};

/**
 * 关闭下载队列
 */
const handleCloseDownloadQueue = (): void => {
  transferStore.clearDownloadQueue();
};
</script>

<style scoped>
.transfer-manager-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f7fa;
  padding: 16px;
}

.transfer-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.transfer-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
}

.transfer-tabs :deep(.el-tab-pane) {
  height: 100%;
}
</style>
