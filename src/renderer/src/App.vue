<script setup lang="ts">
import { onMounted, defineComponent, h } from 'vue'
import { useUpdateStore } from '@/stores/updateStore'
import { NNotificationProvider, NMessageProvider, useNotification, useMessage } from 'naive-ui'
import AutoSyncGlobalProgress from '@/components/auto-sync/AutoSyncGlobalProgress.vue'

// 挂载全局实例的组件
const GlobalMount = defineComponent({
  setup() {
    window.$notification = useNotification()
    window.$naiveMessage = useMessage()
    return () => null
  }
})

const updateStore = useUpdateStore()

onMounted(() => {
  updateStore.init()
})
</script>

<template>
  <n-notification-provider>
    <n-message-provider>
      <GlobalMount />
      <router-view />
      <AutoSyncGlobalProgress />
    </n-message-provider>
  </n-notification-provider>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
}

#app {
  height: 100vh;
  overflow: hidden;
}
</style>
