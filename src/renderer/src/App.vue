<script setup lang="ts">
import { onMounted } from 'vue'
import { useUpdateStore } from '@/stores/updateStore'

const updateStore = useUpdateStore()

onMounted(() => {
  updateStore.init()
})
</script>

<template>
  <router-view />
</template>

<style>
body {
  margin: 0;
  padding: 0;
}
</style>
