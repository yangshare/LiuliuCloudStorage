/**
 * 登录历史组件
 * 显示用户的登录历史记录
 */

<template>
  <div class="login-history-list">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h3>登录历史</h3>
        <el-select
          v-model="filterStatus"
          placeholder="筛选状态"
          style="width: 120px;"
          @change="handleFilter"
        >
          <el-option label="全部" value="" />
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button
          :icon="Download"
          @click="handleExport"
          :disabled="history.length === 0"
        >
          导出记录
        </el-button>
      </div>
    </div>

    <!-- 历史记录列表 -->
    <div class="history-list">
      <el-timeline>
        <el-timeline-item
          v-for="item in filteredHistory"
          :key="item.id"
          :timestamp="formatFullTime(item.timestamp)"
          placement="top"
          :type="getTimelineType(item.status)"
          :icon="getTimelineIcon(item.status)"
        >
          <el-card class="history-card" :class="{ 'suspicious': item.isSuspicious }">
            <div class="history-header">
              <div class="status-info">
                <el-tag
                  :type="getStatusType(item.status)"
                  size="small"
                >
                  {{ getStatusText(item.status) }}
                </el-tag>
                <el-tag v-if="item.isSuspicious" type="danger" size="small" style="margin-left: 8px;">
                  可疑登录
                </el-tag>
              </div>
              <div class="device-info">
                <el-icon class="platform-icon">
                  <component :is="getPlatformIcon(item.deviceInfo.platform)" />
                </el-icon>
                <span class="device-name">{{ item.deviceInfo.deviceName }}</span>
              </div>
            </div>

            <div class="history-details">
              <div class="detail-row">
                <span class="label">平台:</span>
                <span class="value">{{ getPlatformName(item.deviceInfo.platform) }}</span>
              </div>
              <div v-if="item.ipAddress" class="detail-row">
                <span class="label">IP 地址:</span>
                <span class="value">{{ item.ipAddress }}</span>
              </div>
              <div class="detail-row">
                <span class="label">应用版本:</span>
                <span class="value">{{ item.deviceInfo.appVersion }}</span>
              </div>
              <div v-if="item.failureReason" class="detail-row">
                <span class="label">失败原因:</span>
                <span class="value error">{{ item.failureReason }}</span>
              </div>
            </div>

            <div v-if="item.isSuspicious" class="security-alert">
              <el-icon color="#f56c6c"><Warning /></el-icon>
              <span>检测到异常登录，请确认是否为本人操作</span>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="filteredHistory.length === 0"
      description="暂无登录历史"
      :image-size="120"
    />

    <!-- 加载更多 -->
    <div v-if="hasMore" class="load-more">
      <el-button @click="loadMore" :loading="loading">
        加载更多
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Download,
  Warning,
  Monitor,
  SuccessFilled,
  CircleCloseFilled
} from '@element-plus/icons-vue';
import { ILoginHistory, LoginStatus } from '@shared/types/security.types';

// 状态
const filterStatus = ref('');
const loading = ref(false);
const hasMore = ref(false);

// 模拟数据
const history = ref<ILoginHistory[]>([]);

// 过滤后的历史
const filteredHistory = computed(() => {
  if (!filterStatus.value) {
    return history.value;
  }
  return history.value.filter(item => item.status === filterStatus.value);
});

/**
 * 加载登录历史
 */
onMounted(async () => {
  await loadHistory();
});

/**
 * 加载历史
 */
async function loadHistory(): Promise<void> {
  loading.value = true;
  try {
    // TODO: 从 API 获取登录历史
    // const response = await window.electronAPI.security.getLoginHistory();
    // history.value = response.history;

    // 模拟数据
    history.value = [];
    hasMore.value = false;
  } catch (error) {
    console.error('Failed to load login history:', error);
    ElMessage.error('加载登录历史失败');
  } finally {
    loading.value = false;
  }
}

/**
 * 加载更多
 */
async function loadMore(): Promise<void> {
  // TODO: 实现分页加载
  ElMessage.info('功能开发中');
}

/**
 * 筛选
 */
function handleFilter(): void {
  // 筛选逻辑通过 computed 实现
}

/**
 * 导出记录
 */
function handleExport(): Promise<void> {
  // TODO: 实现导出功能
  ElMessage.info('导出功能开发中');
  return Promise.resolve();
}

/**
 * 获取状态类型
 */
function getStatusType(status: LoginStatus): string {
  switch (status) {
    case LoginStatus.SUCCESS:
      return 'success';
    case LoginStatus.FAILED:
      return 'danger';
    case LoginStatus.LOCKED:
      return 'warning';
    case LoginStatus.BLOCKED:
      return 'info';
    default:
      return '';
  }
}

/**
 * 获取状态文本
 */
function getStatusText(status: LoginStatus): string {
  switch (status) {
    case LoginStatus.SUCCESS:
      return '成功';
    case LoginStatus.FAILED:
      return '失败';
    case LoginStatus.LOCKED:
      return '已锁定';
    case LoginStatus.BLOCKED:
      return '已阻止';
    default:
      return '未知';
  }
}

/**
 * 获取时间轴类型
 */
function getTimelineType(status: LoginStatus): string {
  switch (status) {
    case LoginStatus.SUCCESS:
      return 'success';
    case LoginStatus.FAILED:
      return 'danger';
    default:
      return 'warning';
  }
}

/**
 * 获取时间轴图标
 */
function getTimelineIcon(status: LoginStatus) {
  return status === LoginStatus.SUCCESS ? SuccessFilled : CircleCloseFilled;
}

/**
 * 获取平台图标
 */
function getPlatformIcon(platform: string) {
  return Monitor; // 简化处理，实际可根据平台返回不同图标
}

/**
 * 获取平台名称
 */
function getPlatformName(platform: string): string {
  const platformNames: Record<string, string> = {
    'win32': 'Windows',
    'darwin': 'macOS',
    'linux': 'Linux'
  };
  return platformNames[platform] || platform;
}

/**
 * 格式化完整时间
 */
function formatFullTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
</script>

<style scoped>
.login-history-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #ffffff;
  border-radius: 8px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-left h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.history-list {
  padding: 16px;
  background: #ffffff;
  border-radius: 8px;
}

.history-card {
  margin-bottom: 0;
  transition: all 0.3s;
}

.history-card.suspicious {
  border: 2px solid #f56c6c;
  background: #fef0f0;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.status-info {
  display: flex;
  align-items: center;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  font-size: 14px;
}

.platform-icon {
  font-size: 16px;
}

.device-name {
  font-weight: 500;
}

.history-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.detail-row {
  display: flex;
  font-size: 13px;
}

.detail-row .label {
  color: #909399;
  width: 100px;
  flex-shrink: 0;
}

.detail-row .value {
  color: #303133;
  font-weight: 500;
}

.detail-row .value.error {
  color: #f56c6c;
}

.security-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fef0f0;
  border-radius: 4px;
  color: #f56c6c;
  font-size: 13px;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 16px;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .history-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
