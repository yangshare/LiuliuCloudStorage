<script setup lang="ts">
import { NButton, useDialog } from 'naive-ui'
import { useUpdateStore } from '@/stores/updateStore'
import { watch } from 'vue'

const updateStore = useUpdateStore()
const dialog = useDialog()

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
  <NButton
    v-if="updateStore.updateDownloaded"
    type="primary"
    size="small"
    @click="handleClick"
  >
    重启并更新
  </NButton>
</template>
