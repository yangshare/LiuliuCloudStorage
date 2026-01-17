<template>
  <el-space direction="vertical" :size="16" style="width: 100%">
    <!-- 总体存储统计 -->
    <el-card title="存储概览">
      <el-space direction="vertical" :size="16" style="width: 100%" v-if="!loading">
        <!-- 总使用率进度条 -->
        <el-space :size="16">
          <el-statistic title="总存储配额" :value="stats.totalQuota" :precision="0">
            <template #suffix>
              <span class="text-sm">B ({{ formatBytes(stats.totalQuota) }})</span>
            </template>
          </el-statistic>
          <el-statistic title="已使用" :value="stats.totalUsed" :precision="0">
            <template #suffix>
              <span class="text-sm">B ({{ formatBytes(stats.totalUsed) }})</span>
            </template>
          </el-statistic>
          <el-statistic title="剩余空间" :value="stats.remaining" :precision="0">
            <template #suffix>
              <span class="text-sm">B ({{ formatBytes(stats.remaining) }})</span>
            </template>
          </el-statistic>
          <el-statistic title="用户数" :value="stats.userCount" />
        </el-space>

        <el-divider />

        <!-- 使用率可视化 -->
        <div>
          <el-space justify="space-between" align="center" style="margin-bottom: 12px; width: 100%">
            <el-text tag="b">总使用率</el-text>
            <el-text :type="stats.usageRate > 90 ? 'danger' : stats.usageRate > 70 ? 'warning' : 'success'">
              {{ stats.usageRate.toFixed(2) }}%
            </el-text>
          </el-space>
          <el-progress
            type="line"
            :percentage="stats.usageRate"
            :status="stats.usageRate > 90 ? 'exception' : stats.usageRate > 70 ? 'warning' : 'success'"
            :color="stats.usageRate > 90 ? '#f56c6c' : stats.usageRate > 70 ? '#e6a23c' : '#67c23a'"
          />
        </div>
      </el-space>

      <el-skeleton v-if="loading" :rows="5" animated />
    </el-card>

    <!-- 用户配额排行榜 Top 10 -->
    <el-card title="用户配额使用排行 Top 10">
      <el-table
        :data="stats.topUsers"
        :loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="rank" label="排名" width="80">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="quotaTotal" label="配额总量">
          <template #default="{ row }">{{ formatBytes(row.quotaTotal) }}</template>
        </el-table-column>
        <el-table-column prop="quotaUsed" label="已使用">
          <template #default="{ row }">{{ formatBytes(row.quotaUsed) }}</template>
        </el-table-column>
        <el-table-column prop="usageRate" label="使用率" width="200">
          <template #default="{ row }">
            <el-progress
              :percentage="row.usageRate"
              :color="row.usageRate > 90 ? '#f56c6c' : row.usageRate > 70 ? '#e6a23c' : '#67c23a'"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 自动刷新提示 -->
    <el-alert type="info" :closable="false">
      <template #title>
        <el-space align="center">
          <el-icon><Refresh /></el-icon>
          <span>数据每 5 分钟自动刷新一次</span>
        </el-space>
      </template>
    </el-alert>
  </el-space>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElCard, ElStatistic, ElText, ElDivider, ElProgress, ElAlert, ElIcon, ElSpace, ElTable, ElTableColumn, ElSkeleton } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { adminService, type StorageStats } from '../../services/AdminService'

const loading = ref(false)
const stats = ref<StorageStats>({
  totalQuota: 0,
  totalUsed: 0,
  remaining: 0,
  usageRate: 0,
  userCount: 0,
  topUsers: []
})

let refreshTimer: NodeJS.Timeout | null = null

// 加载存储统计
const loadStorageStats = async () => {
  loading.value = true
  try {
    const data = await adminService.getStorageStats()
    stats.value = data
  } catch (error: any) {
    window.$message?.error(error.message || '加载存储统计失败')
  } finally {
    loading.value = false
  }
}

// 格式化字节数
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 组件挂载时加载数据并启动定时刷新
onMounted(() => {
  loadStorageStats()
  // 每5分钟自动刷新一次
  refreshTimer = setInterval(() => {
    loadStorageStats()
  }, 5 * 60 * 1000)
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped>
.text-sm {
  font-size: 0.875em;
  opacity: 0.8;
}
</style>
