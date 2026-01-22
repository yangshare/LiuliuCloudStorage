<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const currentStep = ref(1)

const steps = [
  { title: '上传文件', desc: '拖拽文件到窗口或点击上传按钮，即可将文件上传到云端' },
  { title: '浏览文件', desc: '通过目录树和文件列表浏览您的云端文件，支持创建文件夹' },
  { title: '下载文件', desc: '点击文件即可下载到本地，支持断点续传' }
]

async function finish() {
  await window.electronAPI.auth.completeOnboarding()
  router.push('/')
}

function next() {
  if (currentStep.value < 3) currentStep.value++
  else finish()
}

function skip() {
  finish()
}
</script>

<template>
  <div class="onboarding-container">
    <div class="onboarding-card netease-card netease-fade-in">
      <h1 class="netease-text-gradient">欢迎使用溜溜网盘</h1>

      <el-steps :active="currentStep - 1" class="netease-steps" finish-status="success">
        <el-step v-for="(s, i) in steps" :key="i" :title="s.title" />
      </el-steps>

      <div class="step-content">
        <h3>{{ steps[currentStep - 1].title }}</h3>
        <p>{{ steps[currentStep - 1].desc }}</p>
      </div>

      <div class="button-group">
        <el-button link @click="skip" class="skip-link">跳过引导</el-button>
        <el-button type="primary" @click="next" class="next-btn">
          {{ currentStep < 3 ? '下一步' : '开始使用' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.onboarding-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #F5F5F5 0%, #E8E8E8 100%);
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.onboarding-container::before {
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

.onboarding-container::after {
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

.onboarding-card {
  width: 500px;
  padding: 40px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.onboarding-card h1 {
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  letter-spacing: 1px;
}

/* 步骤条样式 - 网易云风格 */
:deep(.el-steps) {
  margin: 0;
}

:deep(.el-step__head.is-process) {
  color: var(--netease-red) !important;
}

:deep(.el-step__head.is-finish) {
  color: var(--netease-green) !important;
}

:deep(.el-step__head.is-wait) {
  color: var(--netease-gray-4) !important;
}

:deep(.el-step__icon.is-process) {
  background: var(--netease-red) !important;
  border-color: var(--netease-red) !important;
}

:deep(.el-step__icon.is-finish) {
  background: var(--netease-green) !important;
  border-color: var(--netease-green) !important;
}

:deep(.el-step__icon.is-wait) {
  background: rgba(0, 0, 0, 0.06) !important;
  border-color: rgba(0, 0, 0, 0.1) !important;
}

:deep(.el-step__line) {
  background-color: rgba(0, 0, 0, 0.06) !important;
}

:deep(.el-step.is-flex .el-step__title) {
  font-weight: 500;
}

:deep(.el-step__title) {
  font-size: 14px;
}

.step-content {
  text-align: center;
  padding: 24px 20px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
}

.step-content h3 {
  margin: 0;
  color: var(--netease-gray-7);
  font-size: 20px;
  font-weight: 600;
}

.step-content p {
  margin: 0;
  color: var(--netease-gray-6);
  font-size: 15px;
  line-height: 1.6;
}

.button-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.skip-link {
  color: var(--netease-gray-5);
  font-size: 14px;
  transition: color 0.2s ease;
}

.skip-link:hover {
  color: var(--netease-gray-6);
}

.next-btn {
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
  border: none !important;
  border-radius: var(--radius-md) !important;
  padding: 10px 32px;
  font-size: 15px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(194, 12, 12, 0.3);
  transition: all 0.2s ease;
}

.next-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(194, 12, 12, 0.4) !important;
}
</style>
