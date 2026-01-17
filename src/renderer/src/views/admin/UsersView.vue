<template>
  <el-space direction="vertical" :size="16" style="width: 100%">
    <!-- 搜索栏 -->
    <el-card>
      <el-space align="center">
        <el-input
          v-model="searchText"
          placeholder="搜索用户名"
          clearable
          style="width: 300px"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-text type="info">共 {{ total }} 个用户</el-text>
        <el-text v-if="searchText" type="info">
          搜索结果: {{ total }} 条
        </el-text>
      </el-space>
    </el-card>

    <!-- 用户列表表格 -->
    <el-card>
      <el-table
        :data="userList"
        :loading="loading"
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="username" label="用户名" width="180">
          <template #default="{ row }">
            <el-space align="center" :size="8">
              <span class="font-medium">{{ row.username }}</span>
              <el-tag v-if="row.isAdmin" type="warning" size="small">管理员</el-tag>
            </el-space>
          </template>
        </el-table-column>
        <el-table-column prop="quotaTotal" label="配额总量" width="150">
          <template #default="{ row }">{{ formatBytes(row.quotaTotal) }}</template>
        </el-table-column>
        <el-table-column prop="quotaUsed" label="配额使用量" width="150">
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
        <el-table-column prop="createdAt" label="注册时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isAdmin ? 'warning' : 'success'" size="small">
              {{ row.isAdmin ? '管理员' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
        style="margin-top: 16px; justify-content: center"
      />
    </el-card>
  </el-space>

  <!-- 用户详情对话框 -->
  <user-detail-dialog
    v-model:show="showDetailDialog"
    :user="selectedUser"
    @adjust-quota="handleAdjustQuotaFromDetail"
  />

  <!-- 配额调整对话框 (Story 7.1 CRITICAL FIX: 从用户详情打开) -->
  <quota-adjust-dialog
    v-model:show="showQuotaAdjustDialog"
    :user="selectedUser"
    @success="handleQuotaAdjusted"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElCard, ElInput, ElText, ElIcon, ElProgress, ElTag, ElSpace, ElTable, ElTableColumn, ElPagination } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { adminService, type UserListItem } from '../../services/AdminService'
import UserDetailDialog from '../../components/admin/UserDetailDialog.vue'
import QuotaAdjustDialog from '../../components/admin/QuotaAdjustDialog.vue'

const loading = ref(false)
const userList = ref<UserListItem[]>([])
const total = ref(0)
const searchText = ref('')
const currentPage = ref(1)
const pageSize = 20
const showDetailDialog = ref(false)
const selectedUser = ref<UserListItem | null>(null)
const showQuotaAdjustDialog = ref(false)  // Story 7.1 CRITICAL FIX: 添加配额调整对话框状态

// 搜索防抖
let searchTimer: NodeJS.Timeout | null = null
const handleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    loadUsers()
  }, 500)
}

// 加载用户列表
const loadUsers = async () => {
  loading.value = true
  try {
    const response = await adminService.getUsers({
      page: currentPage.value,
      pageSize,
      search: searchText.value
    })

    userList.value = response.list
    total.value = response.total
  } catch (error: any) {
    window.$message?.error(error.message || '加载用户列表失败')
  } finally {
    loading.value = false
  }
}

// 分页处理
const handlePageChange = (page: number) => {
  currentPage.value = page
  loadUsers()
}

// 点击行查看详情
const handleRowClick = (row: UserListItem) => {
  selectedUser.value = row
  showDetailDialog.value = true
}

// Story 7.1 CRITICAL FIX: 从用户详情对话框打开配额调整
const handleAdjustQuotaFromDetail = (user: UserListItem) => {
  selectedUser.value = user
  showDetailDialog.value = false  // 关闭详情对话框
  showQuotaAdjustDialog.value = true  // 打开配额调整对话框
}

// 配额调整成功后重新加载
const handleQuotaAdjusted = () => {
  loadUsers()
}

// 格式化字节数
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 格式化日期
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadUsers()
})
</script>
