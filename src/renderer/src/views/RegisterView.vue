<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage } from 'naive-ui'

const router = useRouter()
const message = useMessage()

const formData = ref({ username: '', password: '', confirmPassword: '' })
const loading = ref(false)

async function handleRegister() {
  if (!formData.value.username || !formData.value.password) {
    message.error('请填写用户名和密码')
    return
  }
  if (formData.value.password !== formData.value.confirmPassword) {
    message.error('两次密码输入不一致')
    return
  }

  loading.value = true
  try {
    const result = await window.electronAPI.auth.register(
      formData.value.username,
      formData.value.password
    )
    if (result.success) {
      message.success('注册成功，请登录')
      router.push('/login')
    } else {
      message.error(result.message || '注册失败')
    }
  } catch (err) {
    message.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-container">
    <n-card title="注册溜溜网盘" style="width: 400px">
      <n-form>
        <n-form-item label="用户名">
          <n-input v-model:value="formData.username" placeholder="请输入用户名" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="formData.password" type="password" placeholder="请输入密码" />
        </n-form-item>
        <n-form-item label="确认密码">
          <n-input v-model:value="formData.confirmPassword" type="password" placeholder="请再次输入密码" />
        </n-form-item>
        <n-space vertical>
          <n-button type="primary" block :loading="loading" @click="handleRegister">注册</n-button>
          <n-button text @click="router.push('/login')">已有账号？去登录</n-button>
        </n-space>
      </n-form>
    </n-card>
  </div>
</template>

<style scoped>
.register-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f5f5;
}
</style>
