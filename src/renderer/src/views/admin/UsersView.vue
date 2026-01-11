<template>
  <n-space vertical size="large">
    <!-- 搜索栏 -->
    <n-card>
      <n-space align="center">
        <n-input
          v-model:value="searchText"
          placeholder="搜索用户名"
          clearable
          style="width: 300px"
          @input="handleSearch"
        >
          <template #prefix>
            <n-icon><search-icon /></n-icon>
          </template>
        </n-input>
        <n-text depth="3">共 {{ total }} 个用户</n-text>
        <n-text v-if="searchText" depth="3">
          搜索结果: {{ total }} 条
        </n-text>
      </n-space>
    </n-card>

    <!-- 用户列表表格 -->
    <n-card>
      <n-data-table
        :columns="columns"
        :data="userList"
        :loading="loading"
        :pagination="paginationConfig"
        :row-key="(row: UserListItem) => row.id"
        @update:page="handlePageChange"
        @row-click="handleRowClick"
      />
    </n-card>
  </n-space>

  <!-- 用户详情对话框 -->
  <user-detail-dialog
    v-model:show="showDetailDialog"
    :user="selectedUser"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { NDataTable, NCard, NSpace, NInput, NText, NIcon, NProgress, NTag, type DataTableColumns } from 'naive-ui'
import { SearchOutline as SearchIcon } from '@vicons/ionicons5'
import { adminService, type UserListItem } from '../../services/AdminService'
import UserDetailDialog from '../../components/admin/UserDetailDialog.vue'

const loading = ref(false)
const userList = ref<UserListItem[]>([])
const total = ref(0)
const searchText = ref('')
const currentPage = ref(1)
const pageSize = 20
const showDetailDialog = ref(false)
const selectedUser = ref<UserListItem | null>(null)

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
      title: '配额使用量',
      key: 'quotaUsed',
      render: (row: UserListItem) => formatBytes(row.quotaUsed)
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
          color: row.usageRate > 90 ? '#f56c6c' : row.usageRate > 70 ? '#e6a23c' : '#67c23a'
        })
      }
    },
    {
      title: '注册时间',
      key: 'createdAt',
      render: (row: UserListItem) => formatDate(row.createdAt)
    },
    {
      title: '状态',
      key: 'status',
      render: (row: UserListItem) => {
        return h(NTag, {
          type: row.isAdmin ? 'warning' : 'success',
          size: 'small'
        }, {
          default: () => row.isAdmin ? '管理员' : '正常'
        })
      }
    }
  ]
  return cols
})

// 分页配置
const paginationConfig = computed(() => ({
  page: currentPage.value,
  pageSize: pageSize,
  pageCount: Math.ceil(total.value / pageSize),
  showSizePicker: false,
  prefix: ({ itemCount }: { itemCount: number }) => `共 ${itemCount} 条`
}))

onMounted(() => {
  loadUsers()
})
</script>
