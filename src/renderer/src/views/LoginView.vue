<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()

const formData = ref({ username: '', password: '' })
const autoLogin = ref(false)
const loading = ref(false)

async function handleLogin() {
  if (!formData.value.username || !formData.value.password) {
    ElMessage.error('请填写用户名和密码')
    return
  }

  loading.value = true
  try {
    const result = await window.electronAPI.auth.login(
      formData.value.username,
      formData.value.password,
      autoLogin.value
    )
    if (result.success) {
      ElMessage.success('登录成功')
      router.push('/')
    } else {
      ElMessage.error(result.message || '登录失败')
    }
  } catch (err) {
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card netease-card netease-fade-in">
      <div class="login-header">
        <h1 class="netease-text-gradient">溜溜网盘</h1>
        <p class="login-subtitle">登录您的账户</p>
      </div>
      <el-form class="login-form" @submit.prevent="handleLogin">
        <el-form-item>
          <el-input
            v-model="formData.username"
            placeholder="请输入用户名"
            size="large"
            :prefix-icon="User"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="formData.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        
        <div class="options-row">
          <el-checkbox v-model="autoLogin">自动登录</el-checkbox>
        </div>

        <div class="button-group">
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-btn"
            native-type="submit"
          >
            登录
          </el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%);
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.login-container::before {
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

.login-container::after {
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

.login-card {
  width: 420px;
  padding: 40px;
  position: relative;
  z-index: 1;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
  letter-spacing: 2px;
}

.login-subtitle {
  color: var(--netease-gray-5);
  font-size: 14px;
  margin: 0;
}

.login-form {
  margin-top: 24px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.options-row {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 1px;
  margin-top: 8px;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.register-link {
  color: var(--netease-gray-5);
  font-size: 14px;
  transition: color 0.2s ease;
}

.register-link:hover {
  color: var(--netease-red);
}
</style>
