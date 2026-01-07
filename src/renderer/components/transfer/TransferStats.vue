/**
 * 传输统计组件
 * 显示传输任务的综合统计信息
 */

<template>
  <div class="transfer-stats">
    <!-- 总体统计卡片 -->
    <el-row :gutter="16" class="stats-cards">
      <!-- 活跃任务 -->
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon active">
            <el-icon><Loading /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ totalActiveCount }}</div>
            <div class="stat-label">活跃任务</div>
          </div>
        </el-card>
      </el-col>

      <!-- 已完成 -->
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon completed">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ totalCompletedCount }}</div>
            <div class="stat-label">已完成</div>
          </div>
        </el-card>
      </el-col>

      <!-- 失败 -->
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon failed">
            <el-icon><CircleClose /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ totalFailedCount }}</div>
            <div class="stat-label">失败</div>
          </div>
        </el-card>
      </el-col>

      <!-- 总速度 -->
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon speed">
            <el-icon><Connection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ formatSpeed(totalSpeed) }}</div>
            <div class="stat-label">总速度</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 详细统计 -->
    <el-row :gutter="16" class="detail-stats">
      <!-- 上传统计 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><Upload /></el-icon>
              <span>上传统计</span>
            </div>
          </template>
          <div class="detail-list">
            <div class="detail-item">
              <span class="detail-label">上传中</span>
              <span class="detail-value">{{ uploadStats.uploading }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">已完成</span>
              <span class="detail-value">{{ uploadStats.completed }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">失败</span>
              <span class="detail-value">{{ uploadStats.failed }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">上传速度</span>
              <span class="detail-value">{{ formatSpeed(uploadStats.totalSpeed) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">总进度</span>
              <span class="detail-value">{{ uploadStats.totalProgress }}%</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 下载统计 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><Download /></el-icon>
              <span>下载统计</span>
            </div>
          </template>
          <div class="detail-list">
            <div class="detail-item">
              <span class="detail-label">下载中</span>
              <span class="detail-value">{{ downloadStats.downloading }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">已完成</span>
              <span class="detail-value">{{ downloadStats.completed }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">失败</span>
              <span class="detail-value">{{ downloadStats.failed }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">下载速度</span>
              <span class="detail-value">{{ formatSpeed(downloadStats.totalSpeed) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">总进度</span>
              <span class="detail-value">{{ downloadStats.totalProgress }}%</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 今日统计 -->
    <el-row :gutter="16" class="today-stats">
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><Calendar /></el-icon>
              <span>今日统计</span>
            </div>
          </template>
          <div class="today-stat-list">
            <div class="today-stat-item">
              <div class="today-stat-icon upload">
                <el-icon><Upload /></el-icon>
              </div>
              <div class="today-stat-content">
                <div class="today-stat-value">{{ transferStats.todayUploadCount }}</div>
                <div class="today-stat-label">上传文件数</div>
                <div class="today-stat-size">{{ formatSize(transferStats.todayUploadSize) }}</div>
              </div>
            </div>
            <el-divider direction="vertical" />
            <div class="today-stat-item">
              <div class="today-stat-icon download">
                <el-icon><Download /></el-icon>
              </div>
              <div class="today-stat-content">
                <div class="today-stat-value">{{ transferStats.todayDownloadCount }}</div>
                <div class="today-stat-label">下载文件数</div>
                <div class="today-stat-size">{{ formatSize(transferStats.todayDownloadSize) }}</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Loading,
  CircleCheck,
  CircleClose,
  Connection,
  Upload,
  Download,
  Calendar
} from '@element-plus/icons-vue';
import { useTransferStore } from '../../stores/transferStore';

const transferStore = useTransferStore();

// 计算属性
const totalActiveCount = computed(() => transferStore.totalActiveCount);
const totalCompletedCount = computed(() => transferStore.totalCompletedCount);
const totalFailedCount = computed(() => transferStore.totalFailedCount);
const totalSpeed = computed(() => transferStore.totalSpeed);
const uploadStats = computed(() => transferStore.uploadStats);
const downloadStats = computed(() => transferStore.downloadStats);
const transferStats = computed(() => transferStore.transferStats);

/**
 * 格式化速度
 */
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond} B/s`;
  } else if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  } else if (bytesPerSecond < 1024 * 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  } else {
    return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
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
</script>

<style scoped>
.transfer-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

/* 统计卡片 */
.stats-cards {
  margin-bottom: 0;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 12px;
}

.stat-icon.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.stat-icon.completed {
  background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
  color: #ffffff;
}

.stat-icon.failed {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
  color: #ffffff;
}

.stat-icon.speed {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #ffffff;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* 详细统计 */
.detail-stats {
  margin-bottom: 0;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  color: #606266;
  font-size: 14px;
}

.detail-value {
  color: #303133;
  font-weight: bold;
  font-size: 14px;
}

/* 今日统计 */
.today-stats {
  margin-bottom: 0;
}

.today-stat-list {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.today-stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.today-stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.today-stat-icon.upload {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.today-stat-icon.download {
  background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
  color: #ffffff;
}

.today-stat-content {
  flex: 1;
}

.today-stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
  line-height: 1.2;
}

.today-stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.today-stat-size {
  font-size: 12px;
  color: #67c23a;
  margin-top: 4px;
}

@media (max-width: 768px) {
  .stat-value {
    font-size: 20px;
  }

  .today-stat-value {
    font-size: 24px;
  }
}
</style>
