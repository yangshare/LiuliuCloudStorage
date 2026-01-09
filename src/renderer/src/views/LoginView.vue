<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage } from 'naive-ui'

const router = useRouter()
const message = useMessage()

const formData = ref({ username: '', password: '' })
const loading = ref(false)

async function handleLogin() {
  if (!formData.value.username || !formData.value.password) {
    message.error('请填写用户名和密码')
    return
  }

  loading.value = true
  try {
    const result = await window.electronAPI.auth.login(
      formData.value.username,
      formData.value.password
    )
    if (result.success) {
      message.success('登录成功')
      router.push('/')
    } else {
      message.error(result.message || '登录失败')
    }
  } catch (err) {
    message.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <n-card title="登录溜溜网盘" style="width: 400px">
      <n-form>
        <n-form-item label="用户名">
          <n-input v-model:value="formData.username" placeholder="请输入用户名" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="formData.password" type="password" placeholder="请输入密码" />
        </n-form-item>
        <n-space vertical>
          <n-button type="primary" block :loading="loading" @click="handleLogin">登录</n-button>
          <n-button text @click="router.push('/register')">没有账号？去注册</n-button>
        </n-space>
      </n-form>
    </n-card>
  </div>
</template>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f5f5;
}
</style>
