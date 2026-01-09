<script setup lang="ts">
import { NBreadcrumb, NBreadcrumbItem } from 'naive-ui'
import { useFileStore } from '../../stores/fileStore'

const fileStore = useFileStore()
</script>

<template>
  <n-breadcrumb>
    <n-breadcrumb-item
      v-for="item in fileStore.breadcrumbs"
      :key="item.path"
      @click="fileStore.navigateTo(item.path)"
    >
      {{ item.label }}
    </n-breadcrumb-item>
  </n-breadcrumb>
</template>
