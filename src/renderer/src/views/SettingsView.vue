<template>
  <div class="settings-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>设置</span>
          <el-button link @click="router.push('/')">
            <el-icon class="el-icon--left"><ArrowLeft /></el-icon>
            返回主页
          </el-button>
        </div>
      </template>
      <div class="settings-content">
        <!-- 服务器配置 -->
        <div class="section-title">服务器配置</div>
        <el-form-item>
          <label class="form-label">
            <span class="required">*</span> Alist 服务地址
          </label>
          <el-input
            v-model="serverConfig.alistBaseUrl"
            placeholder="例如: http://10.2.3.7:5244"
            :prefix-icon="Link"
          />
          <span class="form-hint">用于文件存储和访问</span>
        </el-form-item>

        <el-form-item>
          <label class="form-label">
            <span class="required">*</span> AMB API 地址
          </label>
          <el-input
            v-model="serverConfig.ambApiBaseUrl"
            placeholder="例如: https://amb.example.com/prod-api"
            :prefix-icon="Platform"
          />
          <span class="form-hint">用于用户登录和分享转存</span>
        </el-form-item>

        <el-form-item>
          <label class="form-label">转存 Token (可选)</label>
          <el-input
            v-model="serverConfig.ambTransferToken"
            placeholder="请输入转存 Token"
            :prefix-icon="Key"
            show-password
          />
          <span class="form-hint">用于百度网盘分享转存功能</span>
        </el-form-item>

        <el-button
          type="primary"
          :loading="serverConfigLoading"
          @click="handleSaveServerConfig"
        >
          保存服务器配置
        </el-button>

        <el-divider />

        <!-- 开机自启动 -->
        <el-form-item label="开机自启动">
          <el-switch
            v-model="autoStartEnabled"
            :loading="loading"
            active-text="已开启"
            inactive-text="已关闭"
            @change="handleAutoStartChange"
          />
        </el-form-item>

        <el-text type="info" size="small">
          开启后，应用将在系统启动时自动运行
        </el-text>

        <el-divider />

        <!-- 应用信息 -->
        <el-form-item label="应用版本">
          <span>{{ appVersion }}</span>
        </el-form-item>

        <el-form-item label="平台">
          <span>{{ platformName }}</span>
        </el-form-item>

        <!-- 通知设置 -->
        <el-divider />
        <el-form-item label="系统通知">
          <el-switch
            v-model="notificationsEnabled"
            active-text="已开启"
            inactive-text="已关闭"
          />
        </el-form-item>

        <el-text type="info" size="small">
          开启后,将在上传/下载完成时显示系统通知
        </el-text>

        <!-- 下载目录设置 -->
        <el-divider />
        <el-form-item label="默认下载目录">
          <div class="directory-group">
            <el-input
              v-model="downloadPath"
              readonly
              placeholder="选择下载目录"
            />
            <div class="button-row">
              <el-button type="primary" @click="handleSelectDirectory">
                选择目录
              </el-button>
              <el-button @click="handleOpenDirectory">
                打开下载目录
              </el-button>
              <el-button plain @click="handleResetConfig">
                重置为默认
              </el-button>
            </div>
          </div>
        </el-form-item>

        <el-text type="info" size="small">
          设置文件的默认下载位置
        </el-text>

        <!-- 日志目录 -->
        <el-divider />
        <el-form-item label="日志目录">
          <el-button @click="handleOpenLogsDirectory">
            打开日志目录
          </el-button>
        </el-form-item>

        <el-text type="info" size="small">
          查看应用日志以排查问题
        </el-text>

        <!-- 按日期自动分类 -->
        <el-divider />
        <el-form-item label="按日期自动分类">
          <div class="checkbox-group">
            <el-checkbox
              v-model="autoCreateDateFolder"
              data-testid="auto-create-date-folder-checkbox"
              @change="handleAutoCreateDateFolderChange"
            >
              按日期自动分类
            </el-checkbox>
            <el-text type="info" size="small" style="font-size: 12px;" data-testid="auto-create-date-folder-help">
              开启后,下载的文件将自动保存到按日期分类的子目录中(例如:2026-01-18)
            </el-text>
          </div>
        </el-form-item>

        <!-- 缓存管理 -->
        <el-divider />
        <el-form-item label="缓存管理">
          <div class="cache-management">
            <div class="cache-info">
              <div class="cache-stat">
                <span class="label">当前缓存：</span>
                <span class="value">{{ cacheSize }}</span>
              </div>
              <div class="cache-stat">
                <span class="label">缓存目录：</span>
                <span class="value cache-path">{{ cacheDirectory }}</span>
              </div>
              <div class="cache-stat" v-if="lastCleanupTime">
                <span class="label">上次清理：</span>
                <span class="value">{{ lastCleanupTime }}</span>
              </div>
            </div>
            <div class="cache-actions">
              <el-button
                type="danger"
                :loading="cleaningCache"
                @click="handleClearCache"
              >
                清理缓存
              </el-button>
              <el-button @click="handleRefreshCacheInfo">
                刷新信息
              </el-button>
            </div>
          </div>
        </el-form-item>

        <el-text type="info" size="small">
          清理缓存不会影响登录状态和应用设置
        </el-text>

        <!-- 账号管理 -->
        <el-divider />
        <el-form-item label="账号管理">
          <div class="account-actions">
            <el-button type="danger" plain @click="handleLogout">
              退出登录
            </el-button>
          </div>
        </el-form-item>

        <el-text type="info" size="small">
          退出当前账号，返回登录界面
        </el-text>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Link, Platform, Key } from '@element-plus/icons-vue'

import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

// 状态
const autoStartEnabled = ref(false)
const notificationsEnabled = ref(true)
const appVersion = ref('')
const platformName = ref('')
const loading = ref(false)
const downloadPath = ref('')
const autoCreateDateFolder = ref(false)

// 服务器配置状态
const serverConfig = ref({
  alistBaseUrl: '',
  n8nBaseUrl: '',
  ambApiBaseUrl: '',
  ambTransferToken: ''
})
const serverConfigLoading = ref(false)

// 缓存管理状态
const cacheSize = ref('计算中...')
const cacheDirectory = ref('加载中...')
const lastCleanupTime = ref('')
const cleaningCache = ref(false)

/**
 * 退出登录
 */
async function handleLogout() {
  try {
    await ElMessageBox.confirm(
      '确定要退出登录吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await authStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Logout error:', error)
      // 即便是失败，通常也应该清除本地状态并跳转
      // 但这里我们保留在当前页面以便用户重试，除非是网络错误等
    }
  }
}

/**
 * 获取平台名称
 */
function getPlatformName(): string {
  const platform = window.electronAPI?.platform || 'unknown'
  switch (platform) {
    case 'win32':
      return 'Windows'
    case 'darwin':
      return 'macOS'
    case 'linux':
      return 'Linux'
    default:
      return 'Unknown'
  }
}

/**
 * 获取开机自启动状态
 */
async function getAutoStartStatus(): Promise<void> {
  try {
    const result = await window.electronAPI?.app.getLoginItemSettings()
    if (result?.success) {
      autoStartEnabled.value = result.openAtLogin
    }
  } catch (error) {
    console.error('获取开机自启动状态失败:', error)
  }
}

/**
 * 处理开机自启动开关变化
 */
async function handleAutoStartChange(value: boolean): Promise<void> {
  loading.value = true
  try {
    const result = await window.electronAPI?.app.setLoginItemSettings({ openAtLogin: value })
    if (result?.success) {
      ElMessage.success(value ? '开机自启动已开启' : '开机自启动已关闭')
    } else {
      ElMessage.error('操作失败: ' + (result?.error || '未知错误'))
      // 恢复原状态
      autoStartEnabled.value = !value
    }
  } catch (error: any) {
    ElMessage.error('操作失败: ' + error.message)
    // 恢复原状态
    autoStartEnabled.value = !value
  } finally {
    loading.value = false
  }
}

/**
 * 获取应用版本
 */
async function getAppVersion(): Promise<void> {
  try {
    const version = await window.electronAPI?.app.getVersion()
    appVersion.value = version || '未知'
  } catch (error) {
    console.error('获取应用版本失败:', error)
  }
}

/**
 * 获取下载配置
 */
async function getDownloadConfig(): Promise<void> {
  try {
    const config = await window.electronAPI?.downloadConfig.get()
    if (config) {
      downloadPath.value = config.defaultPath
      autoCreateDateFolder.value = config.autoCreateDateFolder
    }
  } catch (error) {
    console.error('获取下载配置失败:', error)
  }
}

/**
 * 选择下载目录
 */
async function handleSelectDirectory(): Promise<void> {
  try {
    const result = await window.electronAPI?.downloadConfig.selectDirectory()
    if (result?.success) {
      downloadPath.value = result.path
      ElMessage.success('下载目录已更新')
    } else if (result?.needsCreation) {
      // 目录不存在，询问是否创建
      try {
        await ElMessageBox.confirm(
          `目录 "${result.path}" 不存在，是否创建？`,
          '目录不存在',
          {
            confirmButtonText: '创建',
            cancelButtonText: '取消',
            type: 'warning',
          }
        )
        const createResult = await window.electronAPI?.downloadConfig.createDirectory(result.path)
        if (createResult?.success) {
          downloadPath.value = createResult.path
          ElMessage.success('目录已创建并设置为下载目录')
        } else {
          ElMessage.error('创建目录失败: ' + (createResult?.error || '未知错误'))
        }
      } catch (error: any) {
        if (error !== 'cancel') {
          ElMessage.error('创建目录失败: ' + error.message)
        }
      }
    } else {
      ElMessage.error(result?.error || '选择目录失败')
    }
  } catch (error: any) {
    ElMessage.error('选择目录失败: ' + error.message)
  }
}

/**
 * 处理按日期自动分类开关变化
 */
async function handleAutoCreateDateFolderChange(value: boolean): Promise<void> {
  try {
    await window.electronAPI?.downloadConfig.update({ autoCreateDateFolder: value })
    ElMessage.success('设置已保存')
  } catch (error: any) {
    ElMessage.error('保存设置失败: ' + error.message)
    // 恢复原状态
    autoCreateDateFolder.value = !value
  }
}

/**
 * 打开下载目录
 */
async function handleOpenDirectory(): Promise<void> {
  try {
    const result = await window.electronAPI?.downloadConfig.openDirectory()
    if (!result?.success) {
      ElMessage.error(result?.error || '无法打开目录')
    }
  } catch (error: any) {
    ElMessage.error('打开目录失败: ' + error.message)
  }
}

/**
 * 重置下载配置
 */
async function handleResetConfig(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要将下载目录重置为默认设置吗？这将恢复到系统下载文件夹下的"溜溜网盘"目录。',
      '重置下载目录配置',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    const result = await window.electronAPI?.downloadConfig.reset()
    if (result?.success) {
      await getDownloadConfig()
      ElMessage.success('已重置为默认配置')
    } else {
      ElMessage.error('重置失败: ' + (result?.error || '未知错误'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('重置失败: ' + error.message)
    }
  }
}

/**
 * 打开日志目录
 */
async function handleOpenLogsDirectory(): Promise<void> {
  try {
    const result = await window.electronAPI?.app.openLogsDirectory()
    if (!result?.success) {
      ElMessage.error(result?.error || '无法打开日志目录')
    }
  } catch (error: any) {
    ElMessage.error('打开日志目录失败: ' + error.message)
  }
}

/**
 * 获取缓存信息
 */
async function getCacheInfo(): Promise<void> {
  try {
    const result = await window.electronAPI?.cache.getInfo()
    if (result?.success) {
      cacheSize.value = result.size
      cacheDirectory.value = result.directory
      lastCleanupTime.value = result.lastCleanup || '从未清理'
    } else {
      cacheSize.value = '获取失败'
      cacheDirectory.value = '获取失败'
    }
  } catch (error: any) {
    console.error('获取缓存信息失败:', error)
    cacheSize.value = '获取失败'
    cacheDirectory.value = '获取失败'
  }
}

/**
 * 刷新缓存信息
 */
async function handleRefreshCacheInfo(): Promise<void> {
  cacheSize.value = '计算中...'
  await getCacheInfo()
  ElMessage.success('缓存信息已刷新')
}

/**
 * 清理缓存
 */
async function handleClearCache(): Promise<void> {
  try {
    // 先获取最新的缓存信息用于确认对话框
    const info = await window.electronAPI?.cache.getInfo()
    if (!info?.success) {
      ElMessage.error('无法获取缓存信息')
      return
    }

    // 显示详细确认对话框
    await ElMessageBox.confirm(
      `即将清理以下内容：

• 临时文件缓存
• 下载缓存
• 应用缓存数据

当前缓存大小：${info.size}

✅ 不会删除：
• 登录状态
• 应用设置
• 下载的文件

缓存目录：
${info.directory}

确定要清理缓存吗？`,
      '⚠️ 确认清理缓存',
      {
        confirmButtonText: '确认清理',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false,
      }
    )

    // 用户确认后开始清理
    cleaningCache.value = true
    const result = await window.electronAPI?.cache.clear()

    if (result?.success) {
      ElMessage.success({
        message: `缓存清理完成！已清理 ${result.clearedSize}，删除 ${result.filesDeleted} 个文件`,
        duration: 5000,
      })
      // 刷新缓存信息
      await getCacheInfo()
    } else {
      ElMessage.error('清理缓存失败: ' + (result?.error || '未知错误'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('清理缓存失败: ' + error.message)
    }
  } finally {
    cleaningCache.value = false
  }
}

/**
 * 获取服务器配置
 */
async function getServerConfig(): Promise<void> {
  try {
    const config = await window.electronAPI?.config.get()
    if (config) {
      serverConfig.value = {
        alistBaseUrl: config.alistBaseUrl || '',
        n8nBaseUrl: config.n8nBaseUrl || '',
        ambApiBaseUrl: config.ambApiBaseUrl || '',
        ambTransferToken: config.ambTransferToken || ''
      }
    }
  } catch (error) {
    console.error('获取服务器配置失败:', error)
  }
}

/**
 * 验证 URL 格式
 */
function isValidUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 规范化 URL（移除末尾斜杠）
 */
function normalizeUrl(url: string): string {
  if (!url) return url
  return url.replace(/\/+$/, '')
}

/**
 * 保存服务器配置
 */
async function handleSaveServerConfig(): Promise<void> {
  // 验证必填项
  if (!serverConfig.value.alistBaseUrl) {
    ElMessage.error('请填写 Alist 服务地址')
    return
  }
  if (!serverConfig.value.ambApiBaseUrl) {
    ElMessage.error('请填写 AMB API 地址')
    return
  }

  // 验证 URL 格式
  if (!isValidUrl(serverConfig.value.alistBaseUrl)) {
    ElMessage.error('Alist 服务地址格式不正确')
    return
  }
  if (!isValidUrl(serverConfig.value.ambApiBaseUrl)) {
    ElMessage.error('AMB API 地址格式不正确')
    return
  }

  serverConfigLoading.value = true
  try {
    const saveResult = await window.electronAPI?.config.save({
      alistBaseUrl: normalizeUrl(serverConfig.value.alistBaseUrl),
      n8nBaseUrl: normalizeUrl(serverConfig.value.n8nBaseUrl),
      ambApiBaseUrl: normalizeUrl(serverConfig.value.ambApiBaseUrl),
      ambTransferToken: serverConfig.value.ambTransferToken || undefined
    })

    if (!saveResult?.success) {
      ElMessage.error('保存配置失败: ' + (saveResult?.error || '未知错误'))
      return
    }

    // 重新初始化服务
    const reinitResult = await window.electronAPI?.config.reinit()
    if (!reinitResult?.success) {
      ElMessage.warning('配置已保存，但服务初始化失败，可能需要重启应用')
    } else {
      ElMessage.success('服务器配置已保存')
    }
  } catch (error: any) {
    ElMessage.error('保存配置失败: ' + error.message)
  } finally {
    serverConfigLoading.value = false
  }
}

// 组件挂载时初始化
onMounted(async () => {
  platformName.value = getPlatformName()
  await getAutoStartStatus()
  await getAppVersion()
  await getDownloadConfig()
  await getCacheInfo()
  await getServerConfig()
})
</script>

<style scoped>
.settings-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
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

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 0;
}

/* 表单项样式优化 */
:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--netease-gray-6);
}

/* 开关样式 */
:deep(.el-switch) {
  --el-switch-on-color: var(--netease-red);
}

:deep(.el-switch.is-checked .el-switch__core) {
  background-color: var(--netease-red) !important;
  border-color: var(--netease-red) !important;
}

/* 分割线 */
:deep(.el-divider) {
  border-color: rgba(0, 0, 0, 0.06);
  margin: 16px 0;
}

.directory-group,
.checkbox-group {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.button-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

/* 按钮样式 - 网易云风格 */
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

:deep(.el-button--danger) {
  background: linear-gradient(135deg, #F56C6C 0%, #F78989 100%) !important;
  border: none !important;
  border-radius: var(--radius-md) !important;
}

:deep(.el-button--default),
:deep(.el-button.is-plain) {
  border-radius: var(--radius-md) !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

:deep(.el-button--default:hover),
:deep(.el-button.is-plain:hover) {
  background: rgba(255, 255, 255, 0.8) !important;
  border-color: var(--netease-red) !important;
  color: var(--netease-red) !important;
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm) !important;
}

/* 输入框样式 */
:deep(.el-input__wrapper) {
  border-radius: var(--radius-md) !important;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1) inset !important;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--netease-red) inset !important;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--netease-red) inset !important;
}

/* 缓存管理样式 */
.cache-management {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.cache-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
}

.cache-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.cache-stat .label {
  color: var(--netease-gray-5);
  min-width: 80px;
}

.cache-stat .value {
  color: var(--netease-gray-7);
  font-weight: 500;
}

.cache-stat .cache-path {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--netease-red);
  word-break: break-all;
}

.cache-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 文本样式 */
:deep(.el-text--info) {
  color: var(--netease-gray-5) !important;
}

/* 复选框样式 */
:deep(.el-checkbox) {
  font-weight: 500;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: var(--netease-red) !important;
  border-color: var(--netease-red) !important;
}

:deep(.el-checkbox__inner:hover) {
  border-color: var(--netease-red) !important;
}

/* 服务器配置区块样式 */
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--netease-gray-7);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--netease-red);
  display: inline-block;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--netease-gray-7);
  margin-bottom: 8px;
}

.form-label .required {
  color: var(--netease-red);
  margin-right: 4px;
}

.form-hint {
  display: block;
  font-size: 12px;
  color: var(--netease-gray-4);
  margin-top: 4px;
}

/* 服务器配置输入框 */
.server-config-group :deep(.el-input__wrapper) {
  border-radius: var(--radius-md) !important;
}
</style>
