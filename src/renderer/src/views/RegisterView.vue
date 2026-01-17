<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

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
    <el-card title="注册溜溜网盘" style="width: 400px">
      <el-form>
        <el-form-item label="用户名">
          <el-input v-model="formData.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="formData.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="formData.confirmPassword" type="password" placeholder="请再次输入密码" />
        </el-form-item>
        <div class="button-group">
          <el-button type="primary" style="width: 100%" :loading="loading" @click="handleRegister">注册</el-button>
          <el-button link @click="router.push('/login')">已有账号？去登录</el-button>
        </div>
      </el-form>
    </el-card>
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

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
