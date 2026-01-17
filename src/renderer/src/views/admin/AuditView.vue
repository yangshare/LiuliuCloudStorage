<template>
  <div class="audit-view">
    <el-card title="操作审计">
      <template #extra>
        <el-button type="primary" @click="exportLogs">导出日志</el-button>
      </template>

      <!-- 筛选器 -->
      <el-space direction="vertical" :size="16" style="width: 100%">
        <el-space wrap>
          <el-select
            v-model="filters.userId"
            placeholder="全部用户"
            clearable
            style="width: 200px"
            @change="loadLogs"
          >
            <el-option
              v-for="option in userOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-select
            v-model="filters.actionType"
            placeholder="全部类型"
            clearable
            style="width: 150px"
            @change="loadLogs"
          >
            <el-option
              v-for="option in actionTypeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            clearable
            @change="handleDateChange"
          />
          <el-button @click="resetFilters">重置</el-button>
        </el-space>

        <!-- 统计信息 -->
        <el-space :size="16">
          <el-statistic title="总记录数" :value="totalLogs" />
          <el-statistic title="今日活跃用户" :value="dau" />
        </el-space>

        <!-- 日志表格 -->
        <el-table
          :data="logs"
          :loading="loading"
          style="width: 100%"
        >
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="actionType" label="操作类型" width="120">
            <template #default="{ row }">
              <el-tag
                :type="getActionTypeConfig(row.actionType).type"
                size="small"
              >
                {{ getActionTypeConfig(row.actionType).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="fileCount" label="文件数量" width="100" />
          <el-table-column prop="fileSize" label="文件大小" width="120">
            <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column prop="createdAt" label="时间" width="180">
            <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
          </el-table-column>
          <el-table-column prop="details" label="详情" show-overflow-tooltip>
            <template #default="{ row }">{{ formatDetails(row.details) }}</template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalLogs"
          layout="total, sizes, prev, pager, next"
          @current-change="pagination.onChange"
          @size-change="pagination.onUpdatePageSize"
        />
      </el-space>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElCard, ElButton, ElSelect, ElOption, ElDatePicker, ElStatistic, ElTag, ElSpace, ElTable, ElTableColumn, ElPagination, ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/authStore'
import { formatFileSize } from '@/utils/formatters'

const message = ElMessage
const authStore = useAuthStore()

// 状态
const loading = ref(false)
const logs = ref<any[]>([])
const totalLogs = ref(0)
const dau = ref(0)
const userOptions = ref<Array<{ label: string; value: number }>>([])
const dateRange = ref<[Date, Date] | null>(null)

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

// 获取操作类型配置
const getActionTypeConfig = (actionType: string) => {
  const typeMap: Record<string, { text: string; type: 'success' | 'info' | 'warning' | 'danger' | 'default' }> = {
    upload: { text: '上传', type: 'success' },
    download: { text: '下载', type: 'info' },
    delete: { text: '删除', type: 'danger' },
    folder_create: { text: '创建文件夹', type: 'warning' },
    login: { text: '登录', type: 'default' },
    logout: { text: '登出', type: 'default' }
  }
  return typeMap[actionType] || { text: actionType, type: 'default' }
}

// 格式化详情
const formatDetails = (details: string) => {
  try {
    const parsed = details ? JSON.parse(details) : null
    return parsed ? JSON.stringify(parsed, null, 2) : '-'
  } catch {
    return details || '-'
  }
}

// 分页
const pagination = ref({
  page: 1,
  pageSize: 20,
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
function handleDateChange(value: [Date, Date] | null): void {
  if (value) {
    filters.value.startDate = value[0].toISOString().split('T')[0]
    filters.value.endDate = value[1].toISOString().split('T')[0]
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
