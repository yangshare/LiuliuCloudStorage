<template>
  <el-space direction="vertical" :size="16" style="width: 100%">
    <!-- 筛选和排序控制 -->
    <el-card>
      <el-space align="center">
        <el-checkbox v-model="showHighUsageOnly" @change="handleSortChange">
          仅显示接近配额上限的用户 (> 80%)
        </el-checkbox>
        <el-select
          v-model="sortBy"
          style="width: 200px"
          @change="handleSortChange"
        >
          <el-option label="按使用率排序" value="usageRate" />
          <el-option label="按配额总量排序" value="quotaTotal" />
          <el-option label="按已用量排序" value="quotaUsed" />
        </el-select>
        <el-text type="info">共 {{ filteredUsers.length }} 个用户</el-text>
      </el-space>
    </el-card>

    <!-- 用户配额列表 -->
    <el-card>
      <el-table
        :data="filteredUsers"
        :loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="username" label="用户名" width="150">
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
        <el-table-column prop="quotaUsed" label="已使用" width="150">
          <template #default="{ row }">{{ formatBytes(row.quotaUsed) }}</template>
        </el-table-column>
        <el-table-column label="剩余" width="150">
          <template #default="{ row }">{{ formatBytes(row.quotaTotal - row.quotaUsed) }}</template>
        </el-table-column>
        <el-table-column prop="usageRate" label="使用率" width="200">
          <template #default="{ row }">
            <el-progress
              :percentage="row.usageRate"
              :color="row.usageRate > 90 ? '#f56c6c' : row.usageRate > 80 ? '#e6a23c' : row.usageRate > 50 ? '#f0a020' : '#67c23a'"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              @click="openAdjustDialog(row)"
            >
              调整配额
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </el-space>

  <!-- 配额调整对话框 -->
  <quota-adjust-dialog
    v-model:show="showAdjustDialog"
    :user="selectedUser"
    @success="handleQuotaAdjusted"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElCard, ElCheckbox, ElSelect, ElOption, ElText, ElButton, ElProgress, ElTag, ElSpace, ElTable, ElTableColumn } from 'element-plus'
import { adminService, type UserListItem } from '../../services/AdminService'
import QuotaAdjustDialog from '../../components/admin/QuotaAdjustDialog.vue'

const loading = ref(false)
const userList = ref<UserListItem[]>([])
const showHighUsageOnly = ref(false)
const sortBy = ref<'usageRate' | 'quotaTotal' | 'quotaUsed'>('usageRate')
const showAdjustDialog = ref(false)
const selectedUser = ref<UserListItem | null>(null)

// 加载用户列表
const loadUsers = async () => {
  loading.value = true
  try {
    const response = await adminService.getUsers()
    userList.value = response.list
  } catch (error: any) {
    window.$message?.error(error.message || '加载用户列表失败')
  } finally {
    loading.value = false
  }
}

// 过滤和排序用户
const filteredUsers = computed(() => {
  let users = [...userList.value]

  // 筛选高使用率用户
  if (showHighUsageOnly.value) {
    users = users.filter(user => user.usageRate > 80)
  }

  // 排序
  users.sort((a, b) => {
    if (sortBy.value === 'usageRate') return b.usageRate - a.usageRate
    if (sortBy.value === 'quotaTotal') return b.quotaTotal - a.quotaTotal
    if (sortBy.value === 'quotaUsed') return b.quotaUsed - a.quotaUsed
    return 0
  })

  return users
})

// 格式化字节数
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 处理排序变化
const handleSortChange = () => {
  // 排序变化时computed会自动更新
}

// 打开配额调整对话框
const openAdjustDialog = (user: UserListItem) => {
  selectedUser.value = user
  showAdjustDialog.value = true
}

// 配额调整成功后重新加载
const handleQuotaAdjusted = () => {
  loadUsers()
}

onMounted(() => {
  loadUsers()
})
</script>
