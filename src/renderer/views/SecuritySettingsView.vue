/**
 * 安全设置视图
 * 集成所有安全相关设置
 */

<template>
  <div class="security-settings-view">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>安全设置</h1>
      <p>管理您的账户安全和隐私设置</p>
    </div>

    <!-- 设置卡片 -->
    <el-row :gutter="20">
      <!-- 修改密码 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover" class="setting-card" @click="navigateTo('password')">
          <div class="card-content">
            <div class="card-icon">
              <el-icon :size="32"><Lock /></el-icon>
            </div>
            <div class="card-info">
              <h3>修改密码</h3>
              <p>更改您的登录密码</p>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </el-card>
      </el-col>

      <!-- 二步验证 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover" class="setting-card" @click="navigateTo('2fa')">
          <div class="card-content">
            <div class="card-icon">
              <el-icon :size="32"><Key /></el-icon>
            </div>
            <div class="card-info">
              <h3>二步验证</h3>
              <p>添加额外的安全层</p>
              <el-tag v-if="twoFactorEnabled" type="success" size="small">已启用</el-tag>
              <el-tag v-else type="info" size="small">未启用</el-tag>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </el-card>
      </el-col>

      <!-- 会话管理 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover" class="setting-card" @click="navigateTo('sessions')">
          <div class="card-content">
            <div class="card-icon">
              <el-icon :size="32"><Monitor /></el-icon>
            </div>
            <div class="card-info">
              <h3>活跃会话</h3>
              <p>管理所有已登录的设备</p>
              <el-tag type="info" size="small">{{ activeSessionsCount }} 个活跃会话</el-tag>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </el-card>
      </el-col>

      <!-- 登录历史 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover" class="setting-card" @click="navigateTo('login-history')">
          <div class="card-content">
            <div class="card-icon">
              <el-icon :size="32"><Clock /></el-icon>
            </div>
            <div class="card-info">
              <h3>登录历史</h3>
              <p>查看账户登录记录</p>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </el-card>
      </el-col>

      <!-- 安全审计 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover" class="setting-card" @click="navigateTo('audit')">
          <div class="card-content">
            <div class="card-icon">
              <el-icon :size="32"><Document /></el-icon>
            </div>
            <div class="card-info">
              <h3>安全审计</h3>
              <p>查看安全事件和操作日志</p>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </el-card>
      </el-col>

      <!-- 密码策略 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover" class="setting-card" @click="navigateTo('password-policy')">
          <div class="card-content">
            <div class="card-icon">
              <el-icon :size="32"><Shield /></el-icon>
            </div>
            <div class="card-info">
              <h3>密码策略</h3>
              <p>配置密码安全要求</p>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 路由视图（子页面） -->
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Lock,
  Key,
  Monitor,
  Clock,
  Document,
  Shield,
  ArrowRight
} from '@element-plus/icons-vue';

const router = useRouter();

// 状态
const twoFactorEnabled = ref(false);
const activeSessionsCount = ref(0);

/**
 * 导航到子页面
 */
function navigateTo(route: string): void {
  router.push(`/security/${route}`);
}

/**
 * 加载安全状态
 */
onMounted(async () => {
  // TODO: 从 API 加载安全状态
  // twoFactorEnabled.value = await getTwoFactorStatus();
  // activeSessionsCount.value = await getActiveSessionsCount();
});
</script>

<style scoped>
.security-settings-view {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.page-header p {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.setting-card {
  margin-bottom: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.setting-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.card-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-info {
  flex: 1;
}

.card-info h3 {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 4px 0;
}

.card-info p {
  font-size: 14px;
  color: #909399;
  margin: 0 0 8px 0;
}

.arrow-icon {
  color: #c0c4cc;
  font-size: 20px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .security-settings-view {
    padding: 16px;
  }

  .page-header h1 {
    font-size: 24px;
  }
}
</style>
