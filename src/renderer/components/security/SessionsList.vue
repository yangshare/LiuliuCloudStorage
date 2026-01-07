/**
 * 会话列表组件
 * 显示和管理用户的所有活跃会话
 */

<template>
  <div class="sessions-list">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h3>活跃会话 ({{ sessions.length }})</h3>
      </div>
      <div class="toolbar-right">
        <el-button
          type="danger"
          :icon="Delete"
          @click="handleRevokeAll"
          :disabled="sessions.length <= 1"
        >
          登出所有其他设备
        </el-button>
      </div>
    </div>

    <!-- 会话列表 -->
    <div class="session-cards">
      <el-card
        v-for="session in sessions"
        :key="session.sessionId"
        shadow="hover"
        class="session-card"
        :class="{ 'current-session': session.isCurrent }"
      >
        <div class="session-header">
          <div class="device-info">
            <el-icon class="device-icon" :size="24">
              <Monitor v-if="session.deviceInfo.platform === 'win32'" />
              <Monitor v-else-if="session.deviceInfo.platform === 'darwin'" />
              <Monitor v-else />
            </el-icon>
            <div class="device-details">
              <div class="device-name">{{ session.deviceInfo.deviceName }}</div>
              <div class="device-specs">
                {{ getPlatformName(session.deviceInfo.platform) }}
                · {{ session.deviceInfo.appVersion }}
              </div>
            </div>
          </div>
          <el-tag v-if="session.isCurrent" type="success" size="small">
            当前设备
          </el-tag>
        </div>

        <div class="session-info">
          <div class="info-item">
            <span class="label">登录时间</span>
            <span class="value">{{ formatTime(session.loginTime) }}</span>
          </div>
          <div class="info-item">
            <span class="label">最后活跃</span>
            <span class="value">{{ formatTime(session.lastActiveTime) }}</span>
          </div>
          <div v-if="session.ipAddress" class="info-item">
            <span class="label">IP 地址</span>
            <span class="value">{{ session.ipAddress }}</span>
          </div>
          <div class="info-item">
            <span class="label">过期时间</span>
            <span class="value">{{ formatTime(session.expiresAt) }}</span>
          </div>
        </div>

        <div class="session-actions">
          <el-button
            v-if="!session.isCurrent"
            type="danger"
            size="small"
            :icon="SwitchButton"
            @click="handleRevoke(session)"
          >
            远程登出
          </el-button>
          <el-tag v-else type="info" size="small">
            正在使用
          </el-tag>
        </div>
      </el-card>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="sessions.length === 0"
      description="暂无活跃会话"
      :image-size="120"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Monitor,
  Delete,
  SwitchButton
} from '@element-plus/icons-vue';
import { ISession } from '@shared/types/security.types';

// 会话列表
const sessions = ref<ISession[]>([]);

/**
 * 加载会话列表
 */
onMounted(async () => {
  await loadSessions();
});

/**
 * 加载会话
 */
async function loadSessions(): Promise<void> {
  try {
    // TODO: 从 API 获取会话列表
    // const response = await window.electronAPI.security.getSessions();
    // sessions.value = response.sessions;

    // 模拟数据
    sessions.value = [];
  } catch (error) {
    console.error('Failed to load sessions:', error);
    ElMessage.error('加载会话列表失败');
  }
}

/**
 * 撤销会话
 */
async function handleRevoke(session: ISession): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要登出 ${session.deviceInfo.deviceName} 吗？`,
      '确认远程登出',
      {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }
    );

    // TODO: 调用 API 撤销会话
    // await window.electronAPI.security.revokeSession(session.sessionId);

    ElMessage.success('已远程登出该设备');
    await loadSessions();
  } catch {
    // 用户取消
  }
}

/**
 * 撤销所有其他会话
 */
async function handleRevokeAll(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要登出所有其他设备吗？此操作不可撤销。',
      '确认远程登出',
      {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }
    );

    // TODO: 调用 API 撤销所有其他会话
    // await window.electronAPI.security.revokeOtherSessions();

    ElMessage.success('已登出所有其他设备');
    await loadSessions();
  } catch {
    // 用户取消
  }
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
 * 格式化时间
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 小于 1 分钟
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // 小于 1 小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} 分钟前`;
  }

  // 小于 1 天
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} 小时前`;
  }

  // 小于 7 天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days} 天前`;
  }

  // 显示完整日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
</script>

<style scoped>
.sessions-list {
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

.toolbar-left h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.session-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.session-card {
  transition: all 0.3s;
}

.session-card.current-session {
  border: 2px solid #67c23a;
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.device-icon {
  color: #409eff;
}

.device-details {
  display: flex;
  flex-direction: column;
}

.device-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.device-specs {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item .label {
  font-size: 13px;
  color: #909399;
}

.info-item .value {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}

.session-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .session-cards {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
}
</style>
