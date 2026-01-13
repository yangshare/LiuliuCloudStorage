<template>
  <div class="settings-container">
    <n-card title="设置" :bordered="false">
      <template #header-extra>
        <n-button text @click="router.push('/')">
          <template #icon>
            <n-icon><ArrowBackOutline /></n-icon>
          </template>
          返回主页
        </n-button>
      </template>
      <n-space vertical size="large">
        <!-- 开机自启动 -->
        <n-form-item label="开机自启动">
          <n-switch
            v-model:value="autoStartEnabled"
            :loading="loading"
            @update:value="handleAutoStartChange"
          >
            <template #checked>已开启</template>
            <template #unchecked>已关闭</template>
          </n-switch>
        </n-form-item>

        <n-text depth="3">
          开启后，应用将在系统启动时自动运行
        </n-text>

        <n-divider />

        <!-- 应用信息 -->
        <n-form-item label="应用版本">
          <n-text>{{ appVersion }}</n-text>
        </n-form-item>

        <n-form-item label="平台">
          <n-text>{{ platformName }}</n-text>
        </n-form-item>

        <!-- 通知设置 -->
        <n-divider />
        <n-form-item label="系统通知">
          <n-switch v-model:value="notificationsEnabled">
            <template #checked>已开启</template>
            <template #unchecked>已关闭</template>
          </n-switch>
        </n-form-item>

        <n-text depth="3">
          开启后,将在上传/下载完成时显示系统通知
        </n-text>

        <!-- 下载目录设置 -->
        <n-divider />
        <n-form-item label="默认下载目录">
          <n-space vertical style="width: 100%">
            <n-input-group>
              <n-input
                v-model:value="downloadPath"
                readonly
                placeholder="选择下载目录"
              />
              <n-button type="primary" @click="handleSelectDirectory">
                选择目录
              </n-button>
              <n-button @click="handleOpenDirectory">
                打开下载目录
              </n-button>
            </n-input-group>
            <n-button secondary size="small" @click="handleResetConfig">
              重置为默认
            </n-button>
          </n-space>
        </n-form-item>

        <n-text depth="3">
          设置文件的默认下载位置
        </n-text>

        <!-- 按日期自动分类 -->
        <n-divider />
        <n-form-item label="按日期自动分类">
          <n-space vertical style="width: 100%">
            <n-checkbox
              v-model:checked="autoCreateDateFolder"
              data-testid="auto-create-date-folder-checkbox"
              @update:checked="handleAutoCreateDateFolderChange"
            >
              按日期自动分类
            </n-checkbox>
            <n-text depth="3" style="font-size: 12px;" data-testid="auto-create-date-folder-help">
              开启后,下载的文件将自动保存到按月份分类的子目录中(例如:2026-01)
            </n-text>
          </n-space>
        </n-form-item>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NSpace, NFormItem, NSwitch, NText, NDivider, NInput, NInputGroup, NButton, NCheckbox, NIcon, useMessage, useDialog } from 'naive-ui'
import { ArrowBackOutline } from '@vicons/ionicons5'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

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
      message.success(value ? '开机自启动已开启' : '开机自启动已关闭')
    } else {
      message.error('操作失败: ' + (result?.error || '未知错误'))
      // 恢复原状态
      autoStartEnabled.value = !value
    }
  } catch (error: any) {
    message.error('操作失败: ' + error.message)
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
      message.success('下载目录已更新')
    } else if (result?.needsCreation) {
      // 目录不存在，询问是否创建
      dialog.warning({
        title: '目录不存在',
        content: `目录 "${result.path}" 不存在，是否创建？`,
        positiveText: '创建',
        negativeText: '取消',
        onPositiveClick: async () => {
          try {
            const createResult = await window.electronAPI?.downloadConfig.createDirectory(result.path)
            if (createResult?.success) {
              downloadPath.value = createResult.path
              message.success('目录已创建并设置为下载目录')
            } else {
              message.error('创建目录失败: ' + (createResult?.error || '未知错误'))
            }
          } catch (error: any) {
            message.error('创建目录失败: ' + error.message)
          }
        }
      })
    } else {
      message.error(result?.error || '选择目录失败')
    }
  } catch (error: any) {
    message.error('选择目录失败: ' + error.message)
  }
}

/**
 * 处理按日期自动分类开关变化
 */
async function handleAutoCreateDateFolderChange(value: boolean): Promise<void> {
  try {
    await window.electronAPI?.downloadConfig.update({ autoCreateDateFolder: value })
    message.success('设置已保存')
  } catch (error: any) {
    message.error('保存设置失败: ' + error.message)
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
      message.error(result?.error || '无法打开目录')
    }
  } catch (error: any) {
    message.error('打开目录失败: ' + error.message)
  }
}

/**
 * 重置下载配置
 */
async function handleResetConfig(): Promise<void> {
  dialog.warning({
    title: '重置下载目录配置',
    content: '确定要将下载目录重置为默认设置吗？这将恢复到系统下载文件夹下的"溜溜网盘"目录。',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await window.electronAPI?.downloadConfig.reset()
        if (result?.success) {
          await getDownloadConfig()
          message.success('已重置为默认配置')
        } else {
          message.error('重置失败: ' + (result?.error || '未知错误'))
        }
      } catch (error: any) {
        message.error('重置失败: ' + error.message)
      }
    }
  })
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
</style>
