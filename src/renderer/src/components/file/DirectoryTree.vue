<script setup lang="ts">
import { NTree } from 'naive-ui'
import { useFileStore, type TreeNode } from '../../stores/fileStore'

const fileStore = useFileStore()

async function handleLoad(node: TreeNode) {
  const children = await fileStore.loadTreeChildren(node.key)
  if (children.length === 0) {
    node.isLeaf = true
  } else {
    node.children = children
  }
}

function handleSelect(keys: string[]) {
  if (keys.length > 0) {
    fileStore.navigateTo(keys[0])
  }
}
</script>

<template>
  <div class="directory-tree">
    <n-tree
      :data="fileStore.treeData"
      :selected-keys="[fileStore.currentPath]"
      :on-load="handleLoad"
      @update:selected-keys="handleSelect"
      selectable
      block-line
      expand-on-click
    />
  </div>
</template>

<style scoped>
.directory-tree {
  height: 100%;
  padding: 8px;
}
</style>
