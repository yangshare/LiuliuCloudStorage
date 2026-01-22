<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()

const formData = ref({ username: '', password: '', confirmPassword: '' })
const loading = ref(false)

async function handleRegister() {
  if (!formData.value.username || !formData.value.password) {
    ElMessage.error('请填写用户名和密码')
    return
  }
  if (formData.value.password !== formData.value.confirmPassword) {
    ElMessage.error('两次密码输入不一致')
    return
  }

  loading.value = true
  try {
    const result = await window.electronAPI.auth.register(
      formData.value.username,
      formData.value.password
    )
    if (result.success) {
      ElMessage.success('注册成功，请登录')
      router.push('/login')
    } else {
      ElMessage.error(result.message || '注册失败')
    }
  } catch (err) {
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-container">
    <div class="register-card netease-card netease-fade-in">
      <div class="register-header">
        <h1 class="netease-text-gradient">注册溜溜网盘</h1>
        <p class="register-subtitle">创建您的账户</p>
      </div>
      <el-form class="register-form">
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
        <el-form-item>
          <el-input
            v-model="formData.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            size="large"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleRegister"
          />
        </el-form-item>
        <div class="button-group">
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            @click="handleRegister"
            class="register-btn"
          >
            注册
          </el-button>
          <el-button
            link
            @click="router.push('/login')"
            class="login-link"
          >
            已有账号？去登录
          </el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.register-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%);
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.register-container::before {
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

.register-container::after {
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

.register-card {
  width: 420px;
  padding: 40px;
  position: relative;
  z-index: 1;
}

.register-header {
  text-align: center;
  margin-bottom: 32px;
}

.register-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
  letter-spacing: 2px;
}

.register-subtitle {
  color: var(--netease-gray-5);
  font-size: 14px;
  margin: 0;
}

.register-form {
  margin-top: 24px;
}

.register-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.register-btn {
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

.login-link {
  color: var(--netease-gray-5);
  font-size: 14px;
  transition: color 0.2s ease;
}

.login-link:hover {
  color: var(--netease-red);
}
</style>
