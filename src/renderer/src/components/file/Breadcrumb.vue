<script setup lang="ts">
import { ElBreadcrumb, ElBreadcrumbItem } from 'element-plus'
import { useFileStore } from '../../stores/fileStore'

const fileStore = useFileStore()
</script>

<template>
  <el-breadcrumb>
    <el-breadcrumb-item
      v-for="item in fileStore.breadcrumbs"
      :key="item.path"
      @click="fileStore.navigateTo(item.path)"
    >
      {{ item.label }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>
