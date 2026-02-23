<template>
  <div class="share-transfer-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>分享转存</span>
          <el-button link @click="router.push('/')">
            <el-icon class="el-icon--left"><ArrowLeft /></el-icon>
            返回主页
          </el-button>
        </div>
      </template>
      <div class="share-transfer-content">
        <!-- 转存表单 -->
        <el-form :model="transferForm" :rules="rules" ref="formRef" label-width="80px">
          <el-form-item label="分享链接" prop="url">
            <el-input
              v-model="transferForm.url"
              type="textarea"
              :rows="3"
              placeholder="支持直接粘贴分享文本，例如：&#10;链接:https://pan.baidu.com/s/1xxxxx?pwd=xxxx&#10;或&#10;链接：https://pan.baidu.com/s/1xxxxx 提取码：xxxx"
              @blur="parseAndFormatUrl"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="transferring"
              @click="handleTransfer"
            >
              开始转存
            </el-button>
            <el-text type="info" size="small" style="margin-left: 12px;">
              转存成功后可在 Alist 中访问
            </el-text>
          </el-form-item>
        </el-form>

        <el-divider />

        <!-- 转存记录列表 -->
        <div class="records-section">
          <div class="records-header">
            <span class="records-title">转存记录</span>
            <el-space>
              <!-- 批量删除功能暂不开放
              <el-button
                type="danger"
                plain
                :disabled="selectedIds.length === 0"
                @click="handleBatchDelete"
              >
                批量删除 ({{ selectedIds.length }})
              </el-button>
              -->
              <el-button @click="loadRecords" :loading="loading">
                刷新
              </el-button>
            </el-space>
          </div>

          <el-table
            :data="records"
            :loading="loading"
            @selection-change="handleSelectionChange"
            style="width: 100%"
          >
            <el-table-column type="selection" width="55" />
            <el-table-column prop="shareUrl" label="分享链接" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="share-url">{{ row.shareUrl }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusConfig(row.status).type" size="small">
                  {{ getStatusConfig(row.status).text }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="alistPath" label="Alist路径" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.alistPath" class="alist-path">{{ row.alistPath }}</span>
                <span v-else class="empty-text">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button
                  v-if="row.alistPath"
                  link
                  type="primary"
                  @click="handleCopyPath(row.alistPath)"
                >
                  复制路径
                </el-button>
                <el-button
                  link
                  type="danger"
                  @click="handleDelete(row.id)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <el-pagination
            v-model:current-page="pagination.pageNum"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50]"
            :total="totalRecords"
            layout="total, sizes, prev, pager, next"
            @current-change="loadRecords"
            @size-change="handlePageSizeChange"
            style="margin-top: 16px; justify-content: flex-end;"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

// 表单引用
const formRef = ref<FormInstance>()

// 转存表单
const transferForm = reactive({
  url: ''
})

// 表单验证规则
const rules: FormRules = {
  url: [
    { required: true, message: '请输入分享链接', trigger: 'blur' },
    {
      pattern: /^https?:\/\/(pan\.baidu\.com\/s\/|dwz\.cn\/)[a-zA-Z0-9_-]+/,
      message: '请输入有效的百度网盘分享链接（例如：https://pan.baidu.com/s/xxxxx）',
      trigger: 'blur'
    }
  ]
}

// 状态
const transferring = ref(false)
const loading = ref(false)
const records = ref<any[]>([])
const totalRecords = ref(0)
const selectedIds = ref<number[]>([])

// 分页
const pagination = reactive({
  pageNum: 1,
  pageSize: 20
})

// 状态配置
const getStatusConfig = (status: string) => {
  const statusMap: Record<string, { text: string; type: 'success' | 'info' | 'warning' | 'danger' }> = {
    pending: { text: '待处理', type: 'info' },
    transferring: { text: '转存中', type: 'warning' },
    completed: { text: '已完成', type: 'success' },
    failed: { text: '失败', type: 'danger' }
  }
  return statusMap[status] || { text: status, type: 'info' }
}

// 格式化日期
const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleString('zh-CN')
}

/**
 * 解析并格式化百度网盘链接
 * 支持两种格式：
 * 1. 链接:https://pan.baidu.com/s/xxx?pwd=xxx
 * 2. 链接：https://pan.baidu.com/s/xxx 提取码：xxx
 */
function parseAndFormatUrl() {
  const input = transferForm.url.trim()
  if (!input) return

  // 提取链接（支持 pan.baidu.com/s/ 和 dwz.cn/ 短链）
  const urlMatch = input.match(/(https?:\/\/(?:pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+|dwz\.cn\/[a-zA-Z0-9_-]+)[^\s]*)/)
  if (!urlMatch) return

  let url = urlMatch[1]

  // 检查链接中是否已包含 pwd 参数
  const pwdInUrlMatch = url.match(/[?&]pwd=([a-zA-Z0-9]+)/i)
  if (pwdInUrlMatch) {
    // 已经有完整链接，清理多余空格
    transferForm.url = url.split(/\s/)[0]
    return
  }

  // 尝试从文本中提取提取码
  // 匹配 "提取码：xxx" 或 "提取码:xxx" 或 "密码：xxx" 或 "密码:xxx"
  const pwdMatch = input.match(/(?:提取码|密码)[：:]\s*([a-zA-Z0-9]{4})/i)

  if (pwdMatch) {
    const pwd = pwdMatch[1]
    // 移除 URL 末尾可能的多余字符，然后添加 pwd 参数
    url = url.split(/[?\s]/)[0]
    transferForm.url = `${url}?pwd=${pwd}`
  } else {
    // 没有提取码，只保留链接部分
    transferForm.url = url.split(/[?\s]/)[0]
  }
}

/**
 * 验证并清理路径
 * 防止路径遍历攻击和非法路径
 */
function sanitizePath(path: string): string {
  // 移除路径遍历字符
  let sanitized = path.replace(/\.\./g, '')
  // 移除控制字符
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '')
  // 确保路径以 / 开头
  if (!sanitized.startsWith('/')) {
    sanitized = '/' + sanitized
  }
  // 移除多余的斜杠
  sanitized = sanitized.replace(/\/+/g, '/')
  return sanitized || '/'
}

/**
 * 从 Alist URL 中提取界面路径
 * Alist URL 格式: https://alist.domain.com/storage-name/path/to/file
 * 界面路径需要去掉存储名称前缀，例如 /baidu/xxx -> /xxx
 */
function extractTargetPath(alistUrl: string): string | null {
  // 从 URL 中提取完整路径
  const pathMatch = alistUrl.match(/https?:\/\/[^/]+(\/.*)/)
  if (!pathMatch) return null

  const fullPath = pathMatch[1]

  // 智能提取存储名称（第一个路径段）
  // 例如：/baidu/xxx -> 提取 /baidu，然后得到 /xxx
  const segments = fullPath.split('/').filter(Boolean)
  if (segments.length === 0) return '/'

  // 移除第一个路径段（存储名称），得到界面路径
  const targetPath = '/' + segments.slice(1).join('/')

  return sanitizePath(targetPath)
}

/**
 * 执行转存
 */
async function handleTransfer() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    if (!authStore.user?.id) {
      ElMessage.error('请先登录')
      return
    }

    transferring.value = true
    try {
      const result = await window.electronAPI.shareTransfer.exec({
        url: transferForm.url,
        userId: authStore.user.id
      })

      if (result.success) {
        ElMessage.success(result.message || '转存成功')
        // 清空表单
        transferForm.url = ''
        // 刷新列表
        await loadRecords()

        // 跳转到转存路径
        if (result.alistPath) {
          const targetPath = extractTargetPath(result.alistPath)

          if (targetPath && targetPath !== '/') {
            ElMessage.info('正在跳转到转存目录...')
            // 通过路由参数传递目标路径，让主页在加载时直接导航到该路径
            await router.push(`/?path=${encodeURIComponent(targetPath)}`)
          }
        }
      } else {
        ElMessage.error(result.message || '转存失败')
      }
    } catch (error: any) {
      ElMessage.error('转存失败: ' + error.message)
    } finally {
      transferring.value = false
    }
  })
}

/**
 * 加载转存记录
 */
async function loadRecords() {
  if (!authStore.user?.id) return

  loading.value = true
  try {
    const result = await window.electronAPI.shareTransfer.list({
      userId: authStore.user.id,
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize
    })

    if (result.success) {
      records.value = result.records || []
      totalRecords.value = result.total || 0
    } else {
      ElMessage.error('加载记录失败')
    }
  } catch (error: any) {
    ElMessage.error('加载记录失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

/**
 * 处理分页大小变化
 */
function handlePageSizeChange() {
  pagination.pageNum = 1
  loadRecords()
}

/**
 * 处理选择变化
 */
function handleSelectionChange(selection: any[]) {
  selectedIds.value = selection.map(item => item.id)
}

/**
 * 复制 Alist 路径
 */
async function handleCopyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    ElMessage.success('路径已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

/**
 * 删除记录
 */
async function handleDelete(id: number) {
  if (!authStore.user?.id) return

  try {
    await ElMessageBox.confirm(
      '确定要删除这条记录吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const result = await window.electronAPI.shareTransfer.delete({
      id,
      userId: authStore.user.id
    })

    if (result.success) {
      ElMessage.success('删除成功')
      await loadRecords()
    } else {
      ElMessage.error(result.message || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

/**
 * 批量删除
 */
async function handleBatchDelete() {
  if (selectedIds.value.length === 0 || !authStore.user?.id) return

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 条记录吗？`,
      '确认批量删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const result = await window.electronAPI.shareTransfer.batchDelete({
      ids: selectedIds.value,
      userId: authStore.user.id
    })

    if (result.success) {
      ElMessage.success('批量删除成功')
      selectedIds.value = []
      await loadRecords()
    } else {
      ElMessage.error(result.message || '批量删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败: ' + error.message)
    }
  }
}

// 组件挂载时加载记录
onMounted(() => {
  loadRecords()
})
</script>

<style scoped>
.share-transfer-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  background: linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%);
  min-height: 100vh;
}

/* 卡片 - 网易云风格 */
:deep(.el-card) {
  border-radius: var(--radius-lg) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  box-shadow: var(--shadow-md) !important;
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

:deep(.el-card__header) {
  background: rgba(245, 245, 245, 0.5) !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0 !important;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header span {
  font-size: 18px;
  font-weight: 600;
  color: var(--netease-gray-7);
}

.share-transfer-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 分割线 */
:deep(.el-divider) {
  border-color: rgba(0, 0, 0, 0.06);
  margin: 16px 0;
}

/* 记录区域 */
.records-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.records-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--netease-gray-7);
}

/* 表格样式 */
:deep(.el-table) {
  border-radius: var(--radius-md);
}

:deep(.el-table th) {
  background: rgba(245, 245, 245, 0.8) !important;
}

.share-url {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}

.alist-path {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--netease-red);
}

.empty-text {
  color: var(--netease-gray-4);
}

/* 按钮样式 */
:deep(.el-button--primary) {
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
  border: none !important;
  border-radius: var(--radius-md) !important;
  box-shadow: 0 2px 8px rgba(194, 12, 12, 0.3) !important;
}

:deep(.el-button--primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(194, 12, 12, 0.4) !important;
}

:deep(.el-button--danger.is-plain) {
  border-radius: var(--radius-md) !important;
}

:deep(.el-button--default) {
  border-radius: var(--radius-md) !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

:deep(.el-button--default:hover) {
  background: rgba(255, 255, 255, 0.8) !important;
  border-color: var(--netease-red) !important;
  color: var(--netease-red) !important;
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm) !important;
}

/* 表单样式 */
:deep(.el-input__wrapper),
:deep(.el-textarea__inner) {
  border-radius: var(--radius-md) !important;
}

:deep(.el-input__wrapper:hover),
:deep(.el-textarea__inner:hover) {
  box-shadow: 0 0 0 1px var(--netease-red) inset !important;
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px var(--netease-red) inset !important;
}

/* 分页样式 */
:deep(.el-pagination) {
  display: flex;
}

:deep(.el-pagination button),
:deep(.el-pager li) {
  border-radius: var(--radius-sm) !important;
}

:deep(.el-pager li.is-active) {
  background: var(--netease-red) !important;
}
</style>
