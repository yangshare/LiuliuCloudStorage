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
            >
              <template #append>
                <el-button type="primary" @click="handleSelectDirectory">
                  选择目录
                </el-button>
                <el-button @click="handleOpenDirectory">
                  打开下载目录
                </el-button>
              </template>
            </el-input>
            <el-button plain size="small" @click="handleResetConfig" style="margin-top: 8px">
              重置为默认
            </el-button>
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
              开启后,下载的文件将自动保存到按月份分类的子目录中(例如:2026-01)
            </el-text>
          </div>
        </el-form-item>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'

const router = useRouter()

// 状态
const autoStartEnabled = ref(false)
const notificationsEnabled = ref(true)
const appVersion = ref('')
const platformName = ref('')
const loading = ref(false)
const downloadPath = ref('')
const autoCreateDateFolder = ref(false)

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

// 组件挂载时初始化
onMounted(async () => {
  platformName.value = getPlatformName()
  await getAutoStartStatus()
  await getAppVersion()
  await getDownloadConfig()
})
</script>

<style scoped>
.settings-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.directory-group,
.checkbox-group {
  display: flex;
  flex-direction: column;
  width: 100%;
}
</style>
