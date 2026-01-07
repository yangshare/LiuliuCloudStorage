/**
 * 传输设置组件
 * 配置传输相关参数
 */

<template>
  <div class="transfer-settings">
    <el-form :model="settings" label-width="120px" class="settings-form">
      <!-- 并发控制 -->
      <el-card shadow="hover" class="setting-card">
        <template #header>
          <div class="card-header">
            <el-icon><Grid /></el-icon>
            <span>并发控制</span>
          </div>
        </template>

        <el-form-item label="最大上传任务">
          <el-input-number
            v-model="settings.maxConcurrentUploads"
            :min="1"
            :max="10"
            :step="1"
          />
          <span class="help-text">同时进行上传任务的最大数量</span>
        </el-form-item>

        <el-form-item label="最大下载任务">
          <el-input-number
            v-model="settings.maxConcurrentDownloads"
            :min="1"
            :max="10"
            :step="1"
          />
          <span class="help-text">同时进行下载任务的最大数量</span>
        </el-form-item>
      </el-card>

      <!-- 速度限制 -->
      <el-card shadow="hover" class="setting-card">
        <template #header>
          <div class="card-header">
            <el-icon><Switch /></el-icon>
            <span>速度限制</span>
          </div>
        </template>

        <el-form-item label="启用限制">
          <el-switch
            v-model="speedLimit.enabled"
            @change="handleSpeedLimitToggle"
          />
        </el-form-item>

        <el-form-item label="上传速度限制">
          <el-input-number
            v-model="speedLimitUploadKB"
            :min="0"
            :max="10240"
            :step="100"
            :disabled="!speedLimit.enabled"
            @change="handleUploadLimitChange"
          />
          <span class="unit-text">KB/s</span>
          <span class="help-text">0 表示不限制</span>
        </el-form-item>

        <el-form-item label="下载速度限制">
          <el-input-number
            v-model="speedLimitDownloadKB"
            :min="0"
            :max="10240"
            :step="100"
            :disabled="!speedLimit.enabled"
            @change="handleDownloadLimitChange"
          />
          <span class="unit-text">KB/s</span>
          <span class="help-text">0 表示不限制</span>
        </el-form-item>
      </el-card>

      <!-- 重试配置 -->
      <el-card shadow="hover" class="setting-card">
        <template #header>
          <div class="card-header">
            <el-icon><Refresh /></el-icon>
            <span>重试配置</span>
          </div>
        </template>

        <el-form-item label="最大重试次数">
          <el-input-number
            v-model="settings.maxRetries"
            :min="0"
            :max="10"
            :step="1"
          />
          <span class="help-text">失败后的最大重试次数</span>
        </el-form-item>

        <el-form-item label="重试延迟">
          <el-input-number
            v-model="settings.retryDelay"
            :min="1000"
            :max="60000"
            :step="1000"
          />
          <span class="unit-text">毫秒</span>
          <span class="help-text">重试前的等待时间</span>
        </el-form-item>
      </el-card>

      <!-- 默认优先级 -->
      <el-card shadow="hover" class="setting-card">
        <template #header>
          <div class="card-header">
            <el-icon><Flag /></el-icon>
            <span>默认优先级</span>
          </div>
        </template>

        <el-form-item label="任务优先级">
          <el-radio-group v-model="settings.defaultPriority">
            <el-radio-button label="low">低</el-radio-button>
            <el-radio-button label="normal">正常</el-radio-button>
            <el-radio-button label="high">高</el-radio-button>
          </el-radio-group>
          <span class="help-text">新任务的默认优先级</span>
        </el-form-item>
      </el-card>

      <!-- 历史记录设置 -->
      <el-card shadow="hover" class="setting-card">
        <template #header>
          <div class="card-header">
            <el-icon><Clock /></el-icon>
            <span>历史记录设置</span>
          </div>
        </template>

        <el-form-item label="保留天数">
          <el-input-number
            v-model="historyConfig.retentionDays"
            :min="1"
            :max="365"
            :step="1"
            @change="handleRetentionChange"
          />
          <span class="unit-text">天</span>
          <span class="help-text">自动清理超过此天数的历史记录</span>
        </el-form-item>

        <el-form-item label="最大记录数">
          <el-input-number
            v-model="historyConfig.maxHistoryItems"
            :min="100"
            :max="10000"
            :step="100"
            @change="handleMaxHistoryChange"
          />
          <span class="unit-text">条</span>
          <span class="help-text">历史记录的最大数量</span>
        </el-form-item>

        <el-form-item label="自动清理">
          <el-switch v-model="settings.autoClearCompleted" />
          <span class="help-text">完成后自动从列表中移除</span>
        </el-form-item>
      </el-card>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button type="primary" @click="handleSave">
          保存设置
        </el-button>
        <el-button @click="handleReset">
          恢复默认
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Grid,
  Switch,
  Refresh,
  Flag,
  Clock
} from '@element-plus/icons-vue';
import { useTransferStore } from '../../stores/transferStore';
import { TransferPriority } from '@shared/types/transfer.types';

const transferStore = useTransferStore();

// 设置
const settings = reactive({
  maxConcurrentUploads: 3,
  maxConcurrentDownloads: 3,
  maxRetries: 3,
  retryDelay: 2000,
  defaultPriority: TransferPriority.NORMAL,
  autoClearCompleted: false
});

// 速度限制（转换为 KB 显示）
const speedLimitUploadKB = ref(0);
const speedLimitDownloadKB = ref(0);

// 历史记录配置
const historyConfig = reactive({
  retentionDays: 30,
  maxHistoryItems: 1000
});

// 初始化
function init(): void {
  // 从 store 读取配置
  const limit = transferStore.speedLimit;
  speedLimitUploadKB.value = Math.floor(limit.uploadLimit / 1024);
  speedLimitDownloadKB.value = Math.floor(limit.downloadLimit / 1024);

  const config = transferStore.historyConfig;
  historyConfig.retentionDays = config.retentionDays;
  historyConfig.maxHistoryItems = config.maxHistoryItems;
}

init();

/**
 * 切换速度限制
 */
function handleSpeedLimitToggle(enabled: boolean): void {
  transferStore.toggleSpeedLimit();
  if (enabled) {
    ElMessage.success('速度限制已启用');
  } else {
    ElMessage.info('速度限制已关闭');
  }
}

/**
 * 上传限制改变
 */
function handleUploadLimitChange(value: number): void {
  transferStore.setSpeedLimit({ uploadLimit: value * 1024 });
}

/**
 * 下载限制改变
 */
function handleDownloadLimitChange(value: number): void {
  transferStore.setSpeedLimit({ downloadLimit: value * 1024 });
}

/**
 * 保留天数改变
 */
function handleRetentionChange(value: number): void {
  // 历史记录配置更新需要持久化
  transferStore.historyConfig.retentionDays = value;
}

/**
 * 最大历史记录数改变
 */
function handleMaxHistoryChange(value: number): void {
  transferStore.historyConfig.maxHistoryItems = value;
}

/**
 * 保存设置
 */
function handleSave(): void {
  // TODO: 持久化设置到本地存储
  ElMessage.success('设置已保存');
}

/**
 * 恢复默认
 */
function handleReset(): void {
  settings.maxConcurrentUploads = 3;
  settings.maxConcurrentDownloads = 3;
  settings.maxRetries = 3;
  settings.retryDelay = 2000;
  settings.defaultPriority = TransferPriority.NORMAL;
  settings.autoClearCompleted = false;

  speedLimitUploadKB.value = 0;
  speedLimitDownloadKB.value = 0;
  transferStore.setSpeedLimit({ enabled: false, uploadLimit: 0, downloadLimit: 0 });

  historyConfig.retentionDays = 30;
  historyConfig.maxHistoryItems = 1000;

  ElMessage.info('已恢复默认设置');
}
</script>

<style scoped>
.transfer-settings {
  padding: 16px;
  overflow-y: auto;
}

.settings-form {
  max-width: 800px;
  margin: 0 auto;
}

.setting-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.help-text {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}

.unit-text {
  margin-left: 8px;
  color: #606266;
  font-size: 14px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-input-number) {
  width: 180px;
}
</style>
