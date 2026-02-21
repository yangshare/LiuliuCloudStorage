<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Link, Platform, Key, Loading } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

interface ConfigForm {
  alistBaseUrl: string
  n8nBaseUrl: string
  ambApiBaseUrl: string
  ambTransferToken: string
}

const formData = ref<ConfigForm>({
  alistBaseUrl: 'https://alist.yangshare.com',
  n8nBaseUrl: '',
  ambApiBaseUrl: 'https://pan.yangshare.com/prod-api',
  ambTransferToken: ''
})

const loading = ref(false)
const initLoading = ref(true)  // 初始化加载状态

// 根据重定向原因显示不同的提示
const redirectReason = computed(() => route.query.reason as string | undefined)
const warningMessage = computed(() => {
  if (redirectReason.value === 'incomplete') {
    return '请完成以下配置后继续使用'
  }
  if (redirectReason.value === 'timeout') {
    return '配置检查超时，请检查应用状态后重新配置'
  }
  if (redirectReason.value === 'error') {
    return '配置加载失败，请重新配置'
  }
  return null
})

// 加载已有配置
onMounted(async () => {
  // 显示重定向警告
  if (warningMessage.value) {
    ElMessage.warning(warningMessage.value)
  }

  try {
    const config = await window.electronAPI.config.get()
    // 使用默认值作为 fallback
    formData.value = {
      alistBaseUrl: config.alistBaseUrl || 'https://alist.yangshare.com',
      n8nBaseUrl: config.n8nBaseUrl || '',
      ambApiBaseUrl: config.ambApiBaseUrl || 'https://pan.yangshare.com/prod-api',
      ambTransferToken: config.ambTransferToken || ''
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    ElMessage.warning('加载配置失败，请手动填写')
  } finally {
    initLoading.value = false
  }
})

// 验证 URL 格式（与后端保持一致，只允许 http/https 协议）
function isValidUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// 规范化 URL（移除末尾斜杠）
function normalizeUrl(url: string): string {
  if (!url) return url
  return url.replace(/\/+$/, '')
}

// 保存配置
async function handleSave() {
  // 验证必填项
  if (!formData.value.alistBaseUrl) {
    ElMessage.error('请填写 Alist 服务地址')
    return
  }
  if (!formData.value.ambApiBaseUrl) {
    ElMessage.error('请填写 AMB API 地址')
    return
  }

  // 验证 URL 格式
  if (!isValidUrl(formData.value.alistBaseUrl)) {
    ElMessage.error('Alist 服务地址格式不正确')
    return
  }
  if (!isValidUrl(formData.value.ambApiBaseUrl)) {
    ElMessage.error('AMB API 地址格式不正确')
    return
  }

  loading.value = true
  try {
    // 保存配置（规范化 URL）
    const saveResult = await window.electronAPI.config.save({
      alistBaseUrl: normalizeUrl(formData.value.alistBaseUrl),
      n8nBaseUrl: normalizeUrl(formData.value.n8nBaseUrl),
      ambApiBaseUrl: normalizeUrl(formData.value.ambApiBaseUrl),
      ambTransferToken: formData.value.ambTransferToken || undefined
    })

    if (!saveResult.success) {
      ElMessage.error('保存配置失败: ' + saveResult.error)
      return
    }

    // 重新初始化服务
    const reinitResult = await window.electronAPI.config.reinit()
    if (!reinitResult.success) {
      ElMessage.warning('配置已保存，但服务初始化失败，可能需要重启应用')
    }

    ElMessage.success('配置保存成功')
    router.push('/login')
  } catch (err) {
    ElMessage.error('保存配置失败，请稍后重试')
    console.error('保存配置错误:', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="setup-container">
    <!-- 初始化加载遮罩 -->
    <div v-if="initLoading" class="init-loading">
      <el-icon class="is-loading" :size="32">
        <Loading />
      </el-icon>
      <span>正在加载配置...</span>
    </div>

    <div v-else class="setup-card netease-card netease-fade-in">
      <div class="setup-header">
        <h1 class="netease-text-gradient">欢迎使用溜溜网盘</h1>
        <p class="setup-subtitle">首次使用需要配置服务器地址</p>
      </div>

      <el-form class="setup-form" @submit.prevent="handleSave">
        <el-form-item>
          <label class="form-label">
            <span class="required">*</span> Alist 服务地址
          </label>
          <el-input
            v-model="formData.alistBaseUrl"
            placeholder="例如: http://10.2.3.7:5244"
            size="large"
            :prefix-icon="Link"
          />
          <span class="form-hint">用于文件存储和访问（默认无需修改）</span>
        </el-form-item>

        <el-form-item>
          <label class="form-label">
            <span class="required">*</span> AMB API 地址
          </label>
          <el-input
            v-model="formData.ambApiBaseUrl"
            placeholder="例如: https://amb.example.com/prod-api"
            size="large"
            :prefix-icon="Platform"
          />
          <span class="form-hint">用于用户登录和分享转存（默认无需修改）</span>
        </el-form-item>

        <el-form-item>
          <label class="form-label">转存 Token (可选)</label>
          <el-input
            v-model="formData.ambTransferToken"
            placeholder="请输入转存 Token"
            size="large"
            :prefix-icon="Key"
            show-password
          />
          <span class="form-hint">用于百度网盘分享转存功能（默认无需修改）</span>
        </el-form-item>

        <div class="tip-box">
          <span class="tip-icon">💡</span>
          <span>请填写服务器地址完成初始化配置</span>
        </div>

        <div class="button-group">
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="save-btn"
            native-type="submit"
          >
            保存并继续
          </el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.setup-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%);
  position: relative;
  overflow: hidden;
  overflow-y: auto;
  padding: 40px 0;
}

/* 背景装饰 */
.setup-container::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 600px;
  height: 600px;
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%);
  border-radius: 50%;
  opacity: 0.05;
  filter: blur(100px);
}

.setup-container::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, var(--netease-red-light) 0%, var(--netease-red) 100%);
  border-radius: 50%;
  opacity: 0.05;
  filter: blur(80px);
}

/* 初始化加载状态 */
.init-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

.init-loading .el-icon {
  color: var(--netease-red);
}

.init-loading span {
  color: var(--netease-gray-6);
  font-size: 14px;
}

.setup-card {
  width: 480px;
  padding: 40px;
  position: relative;
  z-index: 1;
  margin: auto;
}

.setup-header {
  text-align: center;
  margin-bottom: 32px;
}

.setup-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  letter-spacing: 1px;
}

.setup-subtitle {
  color: var(--netease-gray-5);
  font-size: 14px;
  margin: 0;
}

.setup-form {
  margin-top: 24px;
}

.setup-form :deep(.el-form-item) {
  margin-bottom: 24px;
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

.tip-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(194, 12, 12, 0.04);
  border-radius: 8px;
  margin-bottom: 24px;
}

.tip-icon {
  font-size: 16px;
}

.tip-box span:last-child {
  font-size: 13px;
  color: var(--netease-gray-5);
}

.save-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 1px;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
