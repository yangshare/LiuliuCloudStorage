<template>
  <div class="user-management">
    <el-card title="用户管理">
      <el-space direction="vertical" :size="16" style="width: 100%">
        <el-space justify="space-between" style="width: 100%">
          <el-text>管理所有用户的配额</el-text>
          <el-button type="primary" @click="loadUsers" :loading="isLoading">
            刷新
          </el-button>
        </el-space>

        <el-table
          :data="users"
          :loading="isLoading"
          style="width: 100%"
        >
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="username" label="用户名" width="150" />
          <el-table-column prop="isAdmin" label="角色" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isAdmin === 1 ? 'warning' : 'info'">
                {{ row.isAdmin === 1 ? '管理员' : '普通用户' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="quotaTotal" label="总配额" width="120">
            <template #default="{ row }">
              {{ (row.quotaTotal / (1024 * 1024 * 1024)).toFixed(2) }} GB
            </template>
          </el-table-column>
          <el-table-column prop="quotaUsed" label="已使用" width="120">
            <template #default="{ row }">
              {{ (row.quotaUsed / (1024 * 1024 * 1024)).toFixed(2) }} GB
            </template>
          </el-table-column>
          <el-table-column label="使用率" width="120">
            <template #default="{ row }">
              {{ row.quotaTotal > 0 ? ((row.quotaUsed / row.quotaTotal) * 100).toFixed(1) : '0.0' }}%
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button
                size="small"
                type="primary"
                @click="openQuotaDialog(row)"
              >
                调整配额
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 配额调整对话框 -->
        <quota-adjust-dialog
          v-model:show="showQuotaDialog"
          :user-id="selectedUser?.id || 0"
          :current-quota-bytes="selectedUser?.quotaTotal || 0"
          :username="selectedUser?.username || ''"
          @success="handleQuotaUpdated"
        />
      </el-space>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElCard, ElText, ElButton, ElTag, ElSpace, ElTable, ElTableColumn, ElMessage } from 'element-plus'
import QuotaAdjustDialog from '../quota/QuotaAdjustDialog.vue'

interface User {
  id: number
  username: string
  quotaTotal: number
  quotaUsed: number
  isAdmin: number
  createdAt: number
}

const message = ElMessage
const isLoading = ref(false)
const users = ref<User[]>([])
const showQuotaDialog = ref(false)
const selectedUser = ref<User | null>(null)

const loadUsers = async () => {
  try {
    isLoading.value = true

    // 从数据库加载用户列表
    const result = await window.electronAPI.auth.getUsers()

    if (result.success) {
      users.value = result.users
    } else {
      message.error('加载用户列表失败')
    }

  } catch (error: any) {
    console.error('加载用户列表失败:', error)
    message.error(error.message || '加载用户列表失败')
  } finally {
    isLoading.value = false
  }
}

const openQuotaDialog = (user: User) => {
  selectedUser.value = user
  showQuotaDialog.value = true
}

const handleQuotaUpdated = (userId: number) => {
  message.success(`用户 ${userId} 的配额已更新`)
  loadUsers()
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-management {
  padding: 16px;
}
</style>
