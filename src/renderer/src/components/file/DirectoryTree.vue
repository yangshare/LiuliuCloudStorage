<script setup lang="ts">
import { ref, watch } from 'vue'
import { NTree } from 'naive-ui'
import { useFileStore, type TreeNode } from '../../stores/fileStore'

const fileStore = useFileStore()
const expandedKeys = ref<string[]>(['/'])

// 监听 currentPath 变化，自动展开路径上的所有节点
watch(() => fileStore.currentPath, async (newPath) => {
  const pathParts = newPath.split('/').filter(Boolean)
  const keysToExpand: string[] = []

  // 逐级展开路径
  for (let i = 0; i < pathParts.length; i++) {
    const subPath = '/' + pathParts.slice(0, i + 1).join('/')
    keysToExpand.push(subPath)
  }

  // 添加到展开列表
  expandedKeys.value = [...new Set([...expandedKeys.value, ...keysToExpand])]

  // 预加载路径上的所有节点
  for (const path of keysToExpand) {
    const children = await fileStore.loadTreeChildren(path)
    // 更新 treeData 中的节点（如果有）
    updateTreeNode(fileStore.treeData, path, children)
  }
}, { immediate: true })

// 递归更新树节点
function updateTreeNode(nodes: TreeNode[], path: string, children: TreeNode[]) {
  for (const node of nodes) {
    if (node.key === path) {
      node.children = children
      return true
    }
    if (node.children && updateTreeNode(node.children, path, children)) {
      return true
    }
  }
  return false
}

async function handleLoad(node: TreeNode) {
  const children = await fileStore.loadTreeChildren(node.key)

  if (children.length === 0) {
    node.isLeaf = true
    // 同步更新 treeData 中的节点
    setTreeNodeLeaf(fileStore.treeData, node.key, true)
  } else {
    node.children = children
    // 同步更新 treeData 中的节点
    updateTreeNode(fileStore.treeData, node.key, children)

    // 手动将节点添加到展开列表（修复下载后无法展开的问题）
    if (!expandedKeys.value.includes(node.key)) {
      expandedKeys.value = [...expandedKeys.value, node.key]
    }
  }
}

// 递归设置树节点为叶子节点
function setTreeNodeLeaf(nodes: TreeNode[], path: string, isLeaf: boolean): boolean {
  for (const n of nodes) {
    if (n.key === path) {
      n.isLeaf = isLeaf
      return true
    }
    if (n.children && setTreeNodeLeaf(n.children, path, isLeaf)) {
      return true
    }
  }
  return false
}

function handleSelect(keys: string[]) {
  if (keys.length > 0) {
    fileStore.navigateTo(keys[0])
  }
}

function handleExpandedKeysUpdate(keys: string[]) {
  expandedKeys.value = keys
}
</script>

<template>
  <div class="directory-tree">
    <n-tree
      :data="fileStore.treeData"
      :selected-keys="[fileStore.currentPath]"
      :expanded-keys="expandedKeys"
      :on-load="handleLoad"
      @update:selected-keys="handleSelect"
      @update:expanded-keys="handleExpandedKeysUpdate"
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
