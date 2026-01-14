<template>
  <n-space vertical size="large">
    <!-- 筛选和排序控制 -->
    <n-card>
      <n-space align="center">
        <n-checkbox v-model:checked="showHighUsageOnly">
          仅显示接近配额上限的用户 (> 80%)
        </n-checkbox>
        <n-select
          v-model:value="sortBy"
          :options="sortOptions"
          style="width: 200px"
          @update:value="handleSortChange"
        />
        <n-text depth="3">共 {{ filteredUsers.length }} 个用户</n-text>
      </n-space>
    </n-card>

    <!-- 用户配额列表 -->
    <n-card>
      <n-data-table
        :columns="columns"
        :data="filteredUsers"
        :loading="loading"
        :pagination="paginationConfig"
        :row-key="(row: any) => row.id"
      />
    </n-card>
  </n-space>

  <!-- 配额调整对话框 -->
  <quota-adjust-dialog
    v-model:show="showAdjustDialog"
    :user="selectedUser"
    @success="handleQuotaAdjusted"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { NCard, NSpace, NCheckbox, NSelect, NText, NDataTable, NButton, NProgress, NTag, type DataTableColumns, type SelectOption } from 'naive-ui'
import { adminService, type UserListItem } from '../../services/AdminService'
import QuotaAdjustDialog from '../../components/admin/QuotaAdjustDialog.vue'

const loading = ref(false)
const userList = ref<UserListItem[]>([])
const showHighUsageOnly = ref(false)
const sortBy = ref<'usageRate' | 'quotaTotal' | 'quotaUsed'>('usageRate')
const showAdjustDialog = ref(false)
const selectedUser = ref<UserListItem | null>(null)

// 排序选项
const sortOptions: SelectOption[] = [
  { label: '按使用率排序', value: 'usageRate' },
  { label: '按配额总量排序', value: 'quotaTotal' },
  { label: '按已用量排序', value: 'quotaUsed' }
]

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

// 表格列配置
const columns = computed(() => {
  const cols: DataTableColumns<UserListItem> = [
    {
      title: '用户名',
      key: 'username',
      render: (row: UserListItem) => {
        return h('div', { class: 'flex items-center gap-2' }, [
          h('span', { class: 'font-medium' }, row.username),
          row.isAdmin ? h(NTag, { type: 'warning', size: 'small' }, { default: () => '管理员' }) : null
        ])
      }
    },
    {
      title: '配额总量',
      key: 'quotaTotal',
      render: (row: UserListItem) => formatBytes(row.quotaTotal)
    },
    {
      title: '已使用',
      key: 'quotaUsed',
      render: (row: UserListItem) => formatBytes(row.quotaUsed)
    },
    {
      title: '剩余',
      key: 'remaining',
      render: (row: UserListItem) => formatBytes(row.quotaTotal - row.quotaUsed)
    },
    {
      title: '使用率',
      key: 'usageRate',
      render: (row: UserListItem) => {
        return h(NProgress, {
          type: 'line',
          percentage: row.usageRate,
          indicatorPlacement: 'inside',
          processing: row.usageRate > 90,
          color: row.usageRate > 90 ? '#f56c6c' : row.usageRate > 80 ? '#e6a23c' : row.usageRate > 50 ? '#f0a020' : '#67c23a'
        })
      }
    },
    {
      title: '操作',
      key: 'actions',
      render: (row: UserListItem) => {
        return h(NButton, {
          type: 'primary',
          size: 'small',
          onClick: () => openAdjustDialog(row)
        }, {
          default: () => '调整配额'
        })
      }
    }
  ]
  return cols
})

// 分页配置
const paginationConfig = computed(() => ({
  pageSize: 20
}))

onMounted(() => {
  loadUsers()
})
</script>
