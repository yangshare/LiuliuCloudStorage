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
          <el-form-item label="自动同步">
            <el-switch
              v-model="syncForm.enabled"
              active-text="创建自动同步计划"
            />
          </el-form-item>
          <template v-if="syncForm.enabled">
            <el-form-item label="计划名称">
              <el-input
                v-model="syncForm.name"
                placeholder="默认使用分享短码生成"
              />
            </el-form-item>
            <el-form-item label="有效期">
              <el-radio-group v-model="syncForm.expirePreset">
                <el-radio-button label="1">1天</el-radio-button>
                <el-radio-button label="3">3天</el-radio-button>
                <el-radio-button label="7">7天</el-radio-button>
                <el-radio-button label="30">30天</el-radio-button>
                <el-radio-button label="custom">自定义</el-radio-button>
              </el-radio-group>
              <el-date-picker
                v-if="syncForm.expirePreset === 'custom'"
                v-model="syncForm.customExpiresAt"
                type="datetime"
                placeholder="选择截止时间"
                class="expire-picker"
              />
            </el-form-item>
            <el-form-item label="本机目录">
              <div class="local-dir-row">
                <el-input
                  v-model="syncForm.localSyncDir"
                  placeholder="请选择本机同步目录"
                  readonly
                />
                <el-button @click="selectSyncDirectory">选择</el-button>
              </div>
            </el-form-item>
            <el-form-item label="启动同步">
              <el-switch
                v-model="syncForm.autoRunOnStartup"
                active-text="打开应用时自动执行一次"
              />
            </el-form-item>
          </template>
          <el-form-item>
            <el-button
              type="primary"
              :loading="transferring"
              @click="handleTransfer"
            >
              开始转存
            </el-button>
          </el-form-item>
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 16px;"
          >
            <template #title>
              <strong>重要提示：</strong>转存成功后请立即下载，为了保证网盘容量，<strong>6小时后会删除转存文件</strong>。
            </template>
          </el-alert>
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
            :max-height="recordTableMaxHeight"
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
            <el-table-column prop="createdAt" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button
                  link
                  type="warning"
                  @click="transferForm.url = row.shareUrl"
                >
                  重新转存
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
            class="records-pagination"
            v-model:current-page="pagination.pageNum"
            v-model:page-size="pagination.pageSize"
            :page-sizes="pageSizeOptions"
            :total="totalRecords"
            background
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handlePageSizeChange"
          />
        </div>

        <el-divider />

        <div class="records-section">
          <div class="records-header">
            <span class="records-title">自动同步计划</span>
            <el-button @click="loadPlans" :loading="plansLoading">
              刷新
            </el-button>
          </div>

          <el-table
            :data="plans"
            :loading="plansLoading"
            :max-height="260"
            style="width: 100%"
          >
            <el-table-column prop="name" label="计划名称" min-width="140" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="getPlanStatusConfig(row.status).type" size="small">
                  {{ getPlanStatusConfig(row.status).text }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="localSyncDir" label="本机目录" min-width="180" show-overflow-tooltip />
            <el-table-column prop="expiresAt" label="有效期至" width="170">
              <template #default="{ row }">
                {{ formatTimestamp(row.expiresAt) }}
              </template>
            </el-table-column>
            <el-table-column label="最近同步" width="190">
              <template #default="{ row }">
                <span v-if="row.latestRun">
                  {{ getRunStatusText(row.latestRun) }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="230" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  :loading="runningPlanId === row.id"
                  :disabled="row.status === 'expired' || row.status === 'syncing'"
                  @click="runPlan(row.id)"
                >
                  立即同步
                </el-button>
                <el-button
                  v-if="row.status === 'paused'"
                  link
                  type="success"
                  @click="resumePlan(row.id)"
                >
                  恢复
                </el-button>
                <el-button
                  v-else
                  link
                  type="warning"
                  :disabled="row.status === 'expired' || row.status === 'syncing'"
                  @click="pausePlan(row.id)"
                >
                  暂停
                </el-button>
                <el-button
                  link
                  type="danger"
                  @click="deletePlan(row.id)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-card>

    <!-- 同步进度弹窗 -->
    <el-dialog
      v-model="syncProgressVisible"
      :title="syncProgressTitle"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="syncProgressStatus === 'success' || syncProgressStatus === 'exception'"
      width="480px"
      align-center
    >
      <div class="sync-progress-content">
        <el-progress
          :percentage="syncProgressPercent"
          :status="syncProgressStatus"
          :stroke-width="16"
          striped
          striped-flow
          :duration="syncProgressStatus === 'success' || syncProgressStatus === 'exception' ? 0 : 2"
        />
        <div class="sync-progress-stage">{{ syncProgressStageText }}</div>
        <div class="sync-progress-message">{{ syncProgressMessage }}</div>
      </div>
      <template #footer>
        <el-button
          v-if="syncProgressStatus === 'success' || syncProgressStatus === 'exception'"
          type="primary"
          @click="syncProgressVisible = false"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/authStore'

const STAGE_TEXT_MAP: Record<string, string> = {
  transfer: '转存',
  scan: '扫描远程文件',
  diff: '快照对比',
  queue: '加入下载队列',
  complete: '完成'
}

const router = useRouter()
const authStore = useAuthStore()

// 表单引用
const formRef = ref<FormInstance>()

// 转存表单
const transferForm = reactive({
  url: ''
})

const syncForm = reactive({
  enabled: false,
  name: '',
  expirePreset: '7',
  customExpiresAt: null as Date | null,
  localSyncDir: '',
  autoRunOnStartup: true
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
const plansLoading = ref(false)
const runningPlanId = ref<number | null>(null)
const records = ref<any[]>([])
const plans = ref<any[]>([])
const totalRecords = ref(0)
const selectedIds = ref<number[]>([])
const pageSizeOptions = [8, 10, 20, 50]
const recordTableMaxHeight = 420

// 同步进度状态
const syncProgressVisible = ref(false)
const syncProgressPercent = ref(0)
const syncProgressStage = ref('')
const syncProgressStatus = ref<'success' | 'exception' | undefined>(undefined)
const syncProgressMessage = ref('')

const syncProgressTitle = computed(() => {
  const stage = STAGE_TEXT_MAP[syncProgressStage.value] || '同步'
  return `${stage}中...`
})

const syncProgressStageText = computed(() => {
  const stage = STAGE_TEXT_MAP[syncProgressStage.value] || syncProgressStage.value
  if (syncProgressStage.value === 'complete') {
    return syncProgressStatus.value === 'exception' ? '同步失败' : '同步完成'
  }
  return stage
})

// 分页
const pagination = reactive({
  pageNum: 1,
  pageSize: pageSizeOptions[0]
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

const getPlanStatusConfig = (status: string) => {
  const statusMap: Record<string, { text: string; type: 'success' | 'info' | 'warning' | 'danger' }> = {
    enabled: { text: '启用', type: 'success' },
    paused: { text: '暂停', type: 'info' },
    syncing: { text: '同步中', type: 'warning' },
    expired: { text: '已过期', type: 'info' },
    failed: { text: '失败', type: 'danger' },
    deleted: { text: '已删除', type: 'info' }
  }
  return statusMap[status] || { text: status, type: 'info' }
}

// 格式化日期
const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleString('zh-CN')
}

const formatTimestamp = (timestamp?: number | null) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

function getRunStatusText(run: any) {
  const statusMap: Record<string, string> = {
    running: '同步中',
    completed: '完成',
    partial_failed: '部分失败',
    failed: '失败',
    skipped: '跳过'
  }
  const status = statusMap[run.status] || run.status
  const count = run.missingFileCount ?? run.missing_file_count ?? 0
  return `${status} / 缺少 ${count} 个`
}

function resetSyncProgress() {
  syncProgressPercent.value = 0
  syncProgressStage.value = ''
  syncProgressStatus.value = undefined
  syncProgressMessage.value = ''
}

function openSyncProgress() {
  resetSyncProgress()
  syncProgressVisible.value = true
}

function handleSyncProgress(data: {
  planId: number
  stage: string
  status: string
  message?: string
  current?: number
  total?: number
}) {
  if (!syncProgressVisible.value) return

  syncProgressStage.value = data.stage
  syncProgressMessage.value = data.message || ''

  if (data.current !== undefined && data.total !== undefined && data.total > 0) {
    syncProgressPercent.value = Math.min(Math.round((data.current / data.total) * 100), 100)
  }

  if (data.status === 'failed') {
    syncProgressStatus.value = 'exception'
  } else if (data.stage === 'complete' && data.status === 'completed') {
    syncProgressStatus.value = 'success'
  } else {
    syncProgressStatus.value = undefined
  }
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

function getExpiresAt(): number {
  if (syncForm.expirePreset === 'custom') {
    if (!syncForm.customExpiresAt) {
      throw new Error('请选择自动同步计划有效期')
    }
    return syncForm.customExpiresAt.getTime()
  }

  const days = Number(syncForm.expirePreset)
  return Date.now() + days * 24 * 60 * 60 * 1000
}

async function selectSyncDirectory() {
  try {
    const result = await window.electronAPI.downloadConfig.selectDirectory()
    if (result?.success && result.path) {
      syncForm.localSyncDir = result.path
    } else if (result?.needsCreation && result.path) {
      const confirm = await ElMessageBox.confirm(
        '目录不存在，是否创建并作为本机同步目录？',
        '创建目录',
        {
          confirmButtonText: '创建',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).catch(() => null)

      if (confirm) {
        const created = await window.electronAPI.downloadConfig.createDirectory(result.path)
        if (created?.success && created.path) {
          syncForm.localSyncDir = created.path
        } else {
          ElMessage.error(created?.error || '创建目录失败')
        }
      }
    } else if (result?.error) {
      ElMessage.error(result.error)
    }
  } catch (error: any) {
    ElMessage.error(error.message || '选择目录失败')
  }
}

async function ensureDefaultSyncDirectory() {
  if (syncForm.localSyncDir) return
  try {
    const config = await window.electronAPI.downloadConfig.get()
    if (config?.defaultPath) {
      syncForm.localSyncDir = config.defaultPath
    }
  } catch {
    // 保持空值，由提交校验提示
  }
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

    if (syncForm.enabled) {
      if (!syncForm.localSyncDir) {
        ElMessage.error('请选择本机同步目录')
        return
      }
      try {
        const expiresAt = getExpiresAt()
        if (expiresAt <= Date.now()) {
          ElMessage.error('有效期必须晚于当前时间')
          return
        }
      } catch (error: any) {
        ElMessage.error(error.message)
        return
      }
    }

    transferring.value = true
    if (syncForm.enabled) {
      openSyncProgress()
    }
    try {
      const result = syncForm.enabled
        ? await window.electronAPI.autoSync.createPlanAndRun({
            userId: authStore.user.id,
            name: syncForm.name.trim() || undefined,
            shareUrl: transferForm.url,
            localSyncDir: syncForm.localSyncDir,
            expiresAt: getExpiresAt(),
            autoRunOnStartup: syncForm.autoRunOnStartup,
            conflictPolicy: 'skip_existing'
          })
        : await window.electronAPI.shareTransfer.exec({
            url: transferForm.url,
            userId: authStore.user.id
          })

      if (result.success) {
        ElMessage.success(result.message || (syncForm.enabled ? '自动同步计划已创建' : '转存成功'))
        // 清空表单
        transferForm.url = ''
        syncForm.name = ''
        // 刷新列表
        await loadRecords()
        await loadPlans()

        // 跳转到转存路径
        const alistPath = result.alistPath || result.plan?.lastAlistPath
        if (alistPath) {
          const targetPath = extractTargetPath(alistPath)

          if (targetPath && targetPath !== '/') {
            ElMessage.info('正在跳转到转存目录...')
            // 通过路由参数传递目标路径，让主页在加载时直接导航到该路径
            await router.push(`/?path=${encodeURIComponent(targetPath)}`)
          }
        }
      } else {
        ElMessage.error(result.message || (syncForm.enabled ? '创建自动同步计划失败' : '转存失败'))
        if (syncForm.enabled) {
          syncProgressVisible.value = false
        }
      }
    } catch (error: any) {
      ElMessage.error('转存失败: ' + error.message)
      if (syncForm.enabled) {
        syncProgressVisible.value = false
      }
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

async function loadPlans() {
  if (!authStore.user?.id) return

  plansLoading.value = true
  try {
    const result = await window.electronAPI.autoSync.listPlans({
      userId: authStore.user.id
    })

    if (result.success) {
      plans.value = result.plans || []
    } else {
      ElMessage.error(result.message || '加载自动同步计划失败')
    }
  } catch (error: any) {
    ElMessage.error('加载自动同步计划失败: ' + error.message)
  } finally {
    plansLoading.value = false
  }
}

async function runPlan(id: number) {
  if (!authStore.user?.id) return

  runningPlanId.value = id
  openSyncProgress()
  try {
    const result = await window.electronAPI.autoSync.runPlan({
      id,
      userId: authStore.user.id
    })

    if (!result.success) {
      syncProgressVisible.value = false
      ElMessage.error(result.message || '同步失败')
    }
    await loadPlans()
  } catch (error: any) {
    ElMessage.error('同步失败: ' + error.message)
    syncProgressVisible.value = false
  } finally {
    runningPlanId.value = null
  }
}

async function pausePlan(id: number) {
  if (!authStore.user?.id) return

  const result = await window.electronAPI.autoSync.pausePlan({
    id,
    userId: authStore.user.id
  })
  if (result.success) {
    ElMessage.success('已暂停')
    await loadPlans()
  } else {
    ElMessage.error(result.message || '暂停失败')
  }
}

async function resumePlan(id: number) {
  if (!authStore.user?.id) return

  const result = await window.electronAPI.autoSync.resumePlan({
    id,
    userId: authStore.user.id
  })
  if (result.success) {
    ElMessage.success('已恢复')
    await loadPlans()
  } else {
    ElMessage.error(result.message || '恢复失败')
  }
}

async function deletePlan(id: number) {
  if (!authStore.user?.id) return

  try {
    await ElMessageBox.confirm(
      '确定要删除这个自动同步计划吗？已进入下载队列的任务不会自动取消。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const result = await window.electronAPI.autoSync.deletePlan({
      id,
      userId: authStore.user.id
    })
    if (result.success) {
      ElMessage.success('删除成功')
      await loadPlans()
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
 * 处理分页大小变化
 */
function handlePageChange(pageNum: number) {
  pagination.pageNum = pageNum
  loadRecords()
}

/**
 * 处理分页大小变化
 */
function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.pageNum = 1
  loadRecords()
}

function moveToPreviousPageIfCurrentPageEmpty(deletedCount = 1) {
  const remainingTotal = Math.max(totalRecords.value - deletedCount, 0)
  const maxPage = Math.max(Math.ceil(remainingTotal / pagination.pageSize), 1)

  if (pagination.pageNum > maxPage) {
    pagination.pageNum = maxPage
  }
}

/**
 * 处理选择变化
 */
function handleSelectionChange(selection: any[]) {
  selectedIds.value = selection.map(item => item.id)
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
      moveToPreviousPageIfCurrentPageEmpty()
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
      moveToPreviousPageIfCurrentPageEmpty(selectedIds.value.length)
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
  loadPlans()
  ensureDefaultSyncDirectory()
  window.electronAPI.autoSync.onProgress(handleSyncProgress)
})

onUnmounted(() => {
  window.electronAPI.autoSync.removeProgressListener(handleSyncProgress)
})
</script>

<style scoped>
.share-transfer-container {
  padding: 20px 5%;
  background: linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%);
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
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

:deep(.el-card__body) {
  min-height: 0;
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

.local-dir-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  width: 100%;
}

.expire-picker {
  margin-left: 12px;
  width: 220px;
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
  min-height: 0;
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

:deep(.el-table__body-wrapper) {
  scrollbar-width: thin;
}

:deep(.el-table th) {
  background: rgba(245, 245, 245, 0.8) !important;
}

.share-url {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
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
.records-pagination {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px 0;
  margin-top: 4px;
}

:deep(.el-pagination button),
:deep(.el-pager li) {
  border-radius: var(--radius-sm) !important;
}

:deep(.el-pager li.is-active) {
  background: var(--netease-red) !important;
}

/* 同步进度弹窗 */
.sync-progress-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.sync-progress-stage {
  font-size: 15px;
  font-weight: 600;
  color: var(--netease-gray-7);
  text-align: center;
}

.sync-progress-message {
  font-size: 13px;
  color: var(--netease-gray-5);
  text-align: center;
  min-height: 20px;
}
</style>
