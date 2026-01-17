<template>
  <div class="dashboard-container">
    <el-card class="welcome-card">
      <template #header>
        <h2>欢迎使用管理员控制台</h2>
      </template>
      <div class="welcome-content">
        <p>这里是管理员控制台首页</p>
        <p class="hint-text">您可以通过左侧菜单访问各项管理功能</p>
      </div>
    </el-card>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <el-statistic title="用户总数" :value="stats.totalUsers" />
          <template #footer>
            <p class="stat-footer">注册用户数量</p>
          </template>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <el-statistic title="总存储使用" :value="stats.totalStorage" suffix="GB" />
          <template #footer>
            <p class="stat-footer">所有用户的存储占用</p>
          </template>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <el-statistic title="活跃用户" :value="stats.activeUsers" />
          <template #footer>
            <p class="stat-footer">近7天活跃用户</p>
          </template>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="nav-card">
      <template #header>
        <h2>功能导航</h2>
      </template>
      <div class="nav-list">
        <div class="nav-item">
          <el-button link @click="goToUsers">
            用户管理 →
          </el-button>
        </div>
        <div class="nav-item">
          <el-button link @click="goToStorage">
            存储监控 →
          </el-button>
        </div>
        <div class="nav-item">
          <el-button link @click="goToQuota">
            配额管理 →
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElCard, ElStatistic, ElButton, ElRow, ElCol } from 'element-plus'

const router = useRouter()

const stats = ref({
  totalUsers: 0,
  totalStorage: 0,
  activeUsers: 0
})

const goToUsers = () => router.push({ name: 'admin-users' })
const goToStorage = () => router.push({ name: 'admin-storage' })
const goToQuota = () => router.push({ name: 'admin-quota' })
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.welcome-card {
  width: 100%;
}

.welcome-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hint-text {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.stats-row {
  margin: 0;
}

.stat-card {
  height: 100%;
}

.stat-footer {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin: 0;
  text-align: center;
}

.nav-card {
  width: 100%;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nav-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.nav-item:last-child {
  border-bottom: none;
}
</style>
