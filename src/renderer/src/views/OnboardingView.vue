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
    <el-card title="欢迎使用溜溜网盘" style="width: 500px">
      <el-steps :active="currentStep - 1" style="margin-bottom: 24px">
        <el-step v-for="(s, i) in steps" :key="i" :title="s.title" />
      </el-steps>

      <div class="step-content">
        <h3>{{ steps[currentStep - 1].title }}</h3>
        <p>{{ steps[currentStep - 1].desc }}</p>
      </div>

      <div class="button-group" style="margin-top: 24px">
        <el-button link @click="skip">跳过引导</el-button>
        <el-button type="primary" @click="next">
          {{ currentStep < 3 ? '下一步' : '开始使用' }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.onboarding-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f5f5;
}
.step-content {
  text-align: center;
  padding: 20px;
  min-height: 100px;
}
.step-content h3 { margin-bottom: 12px; }
.step-content p { color: #666; }
.button-group {
  display: flex;
  justify-content: space-between;
}
</style>
