<template>
  <div class="user-management">
    <n-card title="用户管理" :bordered="false">
      <n-space vertical size="large">
        <n-space justify="space-between">
          <n-text>管理所有用户的配额</n-text>
          <n-button type="primary" @click="loadUsers" :loading="isLoading">
            刷新
          </n-button>
        </n-space>

        <n-data-table
          :columns="columns"
          :data="users"
          :loading="isLoading"
          :pagination="pagination"
          :bordered="false"
        />

        <!-- 配额调整对话框 -->
        <quota-adjust-dialog
          v-model:show="showQuotaDialog"
          :user-id="selectedUser?.id || 0"
          :current-quota-bytes="selectedUser?.quotaTotal || 0"
          :username="selectedUser?.username || ''"
          @success="handleQuotaUpdated"
        />
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted } from 'vue'
import { NCard, NSpace, NText, NButton, NDataTable, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import QuotaAdjustDialog from '../quota/QuotaAdjustDialog.vue'

interface User {
  id: number
  username: string
  quotaTotal: number
  quotaUsed: number
  isAdmin: number
  createdAt: number
}

const message = useMessage()
const isLoading = ref(false)
const users = ref<User[]>([])
const showQuotaDialog = ref(false)
const selectedUser = ref<User | null>(null)

const pagination = {
  pageSize: 10
}

const columns: DataTableColumns<User> = [
  {
    title: 'ID',
    key: 'id',
    width: 80
  },
  {
    title: '用户名',
    key: 'username',
    width: 150
  },
  {
    title: '角色',
    key: 'isAdmin',
    width: 100,
    render: (row) => {
      return row.isAdmin === 1
        ? h(NTag, { type: 'warning' }, { default: () => '管理员' })
        : h(NTag, { type: 'default' }, { default: () => '普通用户' })
    }
  },
  {
    title: '总配额',
    key: 'quotaTotal',
    width: 120,
    render: (row) => {
      const gb = (row.quotaTotal / (1024 * 1024 * 1024)).toFixed(2)
      return `${gb} GB`
    }
  },
  {
    title: '已使用',
    key: 'quotaUsed',
    width: 120,
    render: (row) => {
      const gb = (row.quotaUsed / (1024 * 1024 * 1024)).toFixed(2)
      return `${gb} GB`
    }
  },
  {
    title: '使用率',
    key: 'usage',
    width: 120,
    render: (row) => {
      const percentage = row.quotaTotal > 0
        ? ((row.quotaUsed / row.quotaTotal) * 100).toFixed(1)
        : '0.0'
      return `${percentage}%`
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render: (row) => {
      return h(NButton, {
        size: 'small',
        type: 'primary',
        onClick: () => openQuotaDialog(row)
      }, { default: () => '调整配额' })
    }
  }
]

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
