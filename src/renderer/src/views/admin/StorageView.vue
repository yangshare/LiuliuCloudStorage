<template>
  <n-space vertical size="large">
    <!-- 总体存储统计 -->
    <n-card title="存储概览">
      <n-space vertical size="large" v-if="!loading">
        <!-- 总使用率进度条 -->
        <n-statistic-group>
          <n-statistic label="总存储配额">
            <template #default>
              <n-number-animation :from="0" :to="stats.totalQuota" :precision="0" />
              <template #suffix>
                <span class="text-sm">B ({{ formatBytes(stats.totalQuota) }})</span>
              </template>
            </template>
          </n-statistic>
          <n-statistic label="已使用">
            <template #default>
              <n-number-animation :from="0" :to="stats.totalUsed" :precision="0" />
              <template #suffix>
                <span class="text-sm">B ({{ formatBytes(stats.totalUsed) }})</span>
              </template>
            </template>
          </n-statistic>
          <n-statistic label="剩余空间">
            <template #default>
              <n-number-animation :from="0" :to="stats.remaining" :precision="0" />
              <template #suffix>
                <span class="text-sm">B ({{ formatBytes(stats.remaining) }})</span>
              </template>
            </template>
          </n-statistic>
          <n-statistic label="用户数">
            {{ stats.userCount }}
          </n-statistic>
        </n-statistic-group>

        <n-divider />

        <!-- 使用率可视化 -->
        <div>
          <n-space justify="space-between" align="center" style="margin-bottom: 12px;">
            <n-text strong>总使用率</n-text>
            <n-text :type="stats.usageRate > 90 ? 'error' : stats.usageRate > 70 ? 'warning' : 'success'">
              {{ stats.usageRate.toFixed(2) }}%
            </n-text>
          </n-space>
          <n-progress
            type="line"
            :percentage="stats.usageRate"
            :processing="stats.usageRate > 90"
            :color="stats.usageRate > 90 ? '#f56c6c' : stats.usageRate > 70 ? '#e6a23c' : '#67c23a'"
            indicator-placement="inside"
          />
        </div>
      </n-space>

      <n-spin :show="loading" description="加载中..." />
    </n-card>

    <!-- 用户配额排行榜 Top 10 -->
    <n-card title="用户配额使用排行 Top 10">
      <n-data-table
        :columns="topUserColumns"
        :data="stats.topUsers"
        :loading="loading"
        :pagination="false"
        :row-key="(row: any) => row.id"
      />
    </n-card>

    <!-- 自动刷新提示 -->
    <n-alert type="info" :show-icon="false">
      数据每 5 分钟自动刷新一次
      <template #header>
        <n-space align="center">
          <n-icon><refresh-icon /></n-icon>
          <span>自动刷新</span>
        </n-space>
      </template>
    </n-alert>
  </n-space>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, h } from 'vue'
import {
  NCard, NSpace, NStatistic, NStatisticGroup, NNumberAnimation, NText, NDivider,
  NProgress, NDataTable, NSpin, NAlert, NIcon, type DataTableColumns
} from 'naive-ui'
import { RefreshOutline as RefreshIcon } from '@vicons/ionicons5'
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

// Top用户表格列配置
const topUserColumns = computed(() => {
  const cols: DataTableColumns<any> = [
    {
      title: '排名',
      key: 'rank',
      render: (_row: any, index: number) => index + 1,
      width: 80
    },
    {
      title: '用户名',
      key: 'username'
    },
    {
      title: '配额总量',
      key: 'quotaTotal',
      render: (row: any) => formatBytes(row.quotaTotal)
    },
    {
      title: '已使用',
      key: 'quotaUsed',
      render: (row: any) => formatBytes(row.quotaUsed)
    },
    {
      title: '使用率',
      key: 'usageRate',
      render: (row: any) => {
        return h('div', { class: 'w-full' }, [
          h(NProgress, {
            type: 'line',
            percentage: row.usageRate,
            processing: row.usageRate > 90,
            color: row.usageRate > 90 ? '#f56c6c' : row.usageRate > 70 ? '#e6a23c' : '#67c23a',
            indicatorPlacement: 'inside',
            style: { width: '100%' }
          })
        ])
      }
    }
  ]
  return cols
})

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
