<template>
  <div class="audit-view">
    <n-card title="操作审计" :bordered="false">
      <template #header-extra>
        <n-space>
          <n-button type="primary" @click="exportLogs">导出日志</n-button>
        </n-space>
      </template>

      <!-- 筛选器 -->
      <n-space vertical size="large">
        <n-space>
          <n-select
            v-model:value="filters.userId"
            label="用户"
            :options="userOptions"
            placeholder="全部用户"
            clearable
            style="width: 200px"
            @update:value="loadLogs"
          />
          <n-select
            v-model:value="filters.actionType"
            label="操作类型"
            :options="actionTypeOptions"
            placeholder="全部类型"
            clearable
            style="width: 150px"
            @update:value="loadLogs"
          />
          <n-date-picker
            v-model:value="dateRange"
            type="daterange"
            clearable
            @update:value="handleDateChange"
          />
          <n-button @click="resetFilters">重置</n-button>
        </n-space>

        <!-- 统计信息 -->
        <n-space size="large">
          <n-statistic label="总记录数" :value="totalLogs" />
          <n-statistic label="今日活跃用户" :value="dau" />
        </n-space>

        <!-- 日志表格 -->
        <n-data-table
          :columns="columns"
          :data="logs"
          :loading="loading"
          :pagination="pagination"
          :row-key="(row: any) => row.id"
        />
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import {
  NCard,
  NSpace,
  NButton,
  NSelect,
  NDatePicker,
  NDataTable,
  NStatistic,
  NTag,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { useAuthStore } from '@/stores/authStore'
import { formatFileSize } from '@/utils/formatters'

const message = useMessage()
const authStore = useAuthStore()

// 状态
const loading = ref(false)
const logs = ref<any[]>([])
const totalLogs = ref(0)
const dau = ref(0)
const userOptions = ref<Array<{ label: string; value: number }>>([])
const dateRange = ref<[number, number] | null>(null)

// 筛选器
const filters = ref({
  userId: null as number | null,
  actionType: null as string | null,
  startDate: undefined as string | undefined,
  endDate: undefined as string | undefined
})

// 操作类型选项
const actionTypeOptions = [
  { label: '上传', value: 'upload' },
  { label: '下载', value: 'download' },
  { label: '删除', value: 'delete' },
  { label: '创建文件夹', value: 'folder_create' },
  { label: '登录', value: 'login' },
  { label: '登出', value: 'logout' }
]

// 分页
const pagination = ref({
  page: 1,
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    pagination.value.page = page
    loadLogs()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.value.pageSize = pageSize
    pagination.value.page = 1
    loadLogs()
  }
})

// 表格列
const columns: DataTableColumns<any> = [
  {
    title: 'ID',
    key: 'id',
    width: 80
  },
  {
    title: '用户ID',
    key: 'userId',
    width: 100
  },
  {
    title: '操作类型',
    key: 'actionType',
    width: 120,
    render: (row) => {
      const typeMap: Record<string, { text: string; type: 'success' | 'info' | 'warning' | 'error' | 'default' }> = {
        upload: { text: '上传', type: 'success' },
        download: { text: '下载', type: 'info' },
        delete: { text: '删除', type: 'error' },
        folder_create: { text: '创建文件夹', type: 'warning' },
        login: { text: '登录', type: 'default' },
        logout: { text: '登出', type: 'default' }
      }
      const config = typeMap[row.actionType] || { text: row.actionType, type: 'default' }
      return h(NTag, { type: config.type }, { default: () => config.text })
    }
  },
  {
    title: '文件数量',
    key: 'fileCount',
    width: 100
  },
  {
    title: '文件大小',
    key: 'fileSize',
    width: 120,
    render: (row) => formatFileSize(row.fileSize)
  },
  {
    title: '时间',
    key: 'createdAt',
    width: 180,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN')
  },
  {
    title: '详情',
    key: 'details',
    ellipsis: {
      tooltip: true
    },
    render: (row) => {
      try {
        const details = row.details ? JSON.parse(row.details) : null
        return details ? JSON.stringify(details, null, 2) : '-'
      } catch {
        return row.details || '-'
      }
    }
  }
]

/**
 * 加载用户列表
 */
async function loadUsers(): Promise<void> {
  try {
    const result = await window.electronAPI.auth.getUsers()
    if (result.users) {
      userOptions.value = result.users.map((user: any) => ({
        label: `${user.username} (ID: ${user.id})`,
        value: user.id
      }))
    }
  } catch (error) {
    console.error('加载用户列表失败:', error)
  }
}

/**
 * 加载日志数据
 */
async function loadLogs(): Promise<void> {
  if (!authStore.user) return

  loading.value = true
  try {
    const result = await window.electronAPI.activity.getAllLogs({
      limit: pagination.value.pageSize,
      offset: (pagination.value.page - 1) * pagination.value.pageSize,
      userId: filters.value.userId || undefined,
      actionType: filters.value.actionType || undefined,
      startDate: filters.value.startDate,
      endDate: filters.value.endDate
    })

    logs.value = result.logs || []
    totalLogs.value = result.total || 0
  } catch (error: any) {
    message.error('加载日志失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

/**
 * 加载DAU
 */
async function loadDAU(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const result = await window.electronAPI.activity.getDAU(today)
    if (result.success) {
      dau.value = result.dau || 0
    }
  } catch (error) {
    console.error('加载DAU失败:', error)
  }
}

/**
 * 处理日期范围变化
 */
function handleDateChange(value: [number, number] | null): void {
  if (value) {
    filters.value.startDate = new Date(value[0]).toISOString().split('T')[0]
    filters.value.endDate = new Date(value[1]).toISOString().split('T')[0]
  } else {
    filters.value.startDate = undefined
    filters.value.endDate = undefined
  }
  loadLogs()
}

/**
 * 重置筛选器
 */
function resetFilters(): void {
  filters.value = {
    userId: null,
    actionType: null,
    startDate: undefined,
    endDate: undefined
  }
  dateRange.value = null
  pagination.value.page = 1
  loadLogs()
}

/**
 * 导出日志
 */
function exportLogs(): void {
  try {
    // 生成CSV
    const headers = ['ID', '用户ID', '操作类型', '文件数量', '文件大小', '时间']
    const rows = logs.value.map(log => [
      log.id,
      log.userId,
      log.actionType,
      log.fileCount,
      log.fileSize,
      new Date(log.createdAt).toLocaleString('zh-CN')
    ])

    let csv = headers.join(',') + '\n'
    csv += rows.map(row => row.join(',')).join('\n')

    // 创建下载链接
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    message.success('日志导出成功')
  } catch (error: any) {
    message.error('导出失败: ' + error.message)
  }
}

// 组件挂载时加载数据
onMounted(async () => {
  await loadUsers()
  await loadLogs()
  await loadDAU()
})
</script>

<style scoped>
.audit-view {
  padding: 20px;
}
</style>
