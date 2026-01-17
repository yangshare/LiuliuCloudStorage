<script setup lang="ts">
import { ElButton } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import { useUpdateStore } from '@/stores/updateStore'
import { watch } from 'vue'

const updateStore = useUpdateStore()
const dialog = ElMessageBox

watch(() => updateStore.errorMessage, (message) => {
  if (message) {
    dialog.error({
      title: '更新失败',
      content: message,
      positiveText: '确定',
      onPositiveClick: () => updateStore.clearError()
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
    type="primary"
    size="small"
    @click="handleClick"
  >
    重启并更新
  </el-button>
</template>
