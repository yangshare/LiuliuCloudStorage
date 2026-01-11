<template>
  <div class="settings-container">
    <n-card title="设置" :bordered="false">
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
          开启后，将在上传/下载完成时显示系统通知
        </n-text>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NCard, NSpace, NFormItem, NSwitch, NText, NDivider, useMessage } from 'naive-ui'

const message = useMessage()

// 状态
const autoStartEnabled = ref(false)
const notificationsEnabled = ref(true)
const appVersion = ref('')
const platformName = ref('')
const loading = ref(false)

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

// 组件挂载时初始化
onMounted(async () => {
  platformName.value = getPlatformName()
  await getAutoStartStatus()
  await getAppVersion()
})
</script>

<style scoped>
.settings-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
</style>
