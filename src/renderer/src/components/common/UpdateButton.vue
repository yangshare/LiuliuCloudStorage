<script setup lang="ts">
import { ElButton } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import { useUpdateStore } from '@/stores/updateStore'
import { watch } from 'vue'

const updateStore = useUpdateStore()

watch(() => updateStore.errorMessage, (message) => {
  if (message) {
    ElMessageBox.alert(message, '更新失败', {
      type: 'error',
      confirmButtonText: '确定'
    }).then(() => {
      updateStore.clearError()
    })
  }
})

function handleClick() {
  updateStore.installNow()
}
</script>

<template>
  <el-button
    v-if="updateStore.updateDownloaded"
    type="danger"
    size="small"
    @click="handleClick"
  >
    重启并更新
  </el-button>
</template>
