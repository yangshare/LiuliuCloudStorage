/**
 * 文件树组件
 * 显示文件系统的层级结构
 */

<template>
  <div class="file-tree-container">
    <el-tree
      ref="treeRef"
      v-loading="loading"
      :data="treeData"
      :props="treeProps"
      node-key="id"
      :highlight-current="true"
      :expand-on-click-node="false"
      :default-expand-all="false"
      :indent="16"
      :icon="Folder"
      @node-click="handleNodeClick"
      @node-expand="handleNodeExpand"
      @node-collapse="handleNodeCollapse"
    >
      <template #default="{ node, data }">
        <div class="tree-node">
          <el-icon :size="18" :color="data.type === 'folder' ? '#409eff' : '#909399'">
            <component :is="getNodeIcon(data)" />
          </el-icon>
          <span class="tree-node-label" :title="node.label">
            {{ node.label }}
          </span>
          <span v-if="data.type === 'file'" class="tree-node-size">
            {{ formatFileSize(data.size || 0) }}
          </span>
        </div>
      </template>
    </el-tree>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Folder, FolderOpened, Document } from '@element-plus/icons-vue';
import type { ElTree } from 'element-plus';
import { IFileNode, IFileItem } from '@shared/types/filesystem.types';

interface Props {
  fileList: IFileItem[];
  loading?: boolean;
  height?: string | number;
}

interface Emits {
  (e: 'node-click', node: IFileNode): void;
  (e: 'load-children', node: IFileNode): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const treeRef = ref<InstanceType<typeof ElTree>>();

const treeProps = {
  children: 'children',
  label: 'name',
  disabled: false
};

/**
 * 将文件列表转换为树形数据
 */
const treeData = computed<IFileNode[]>(() => {
  return buildTreeData(props.fileList, '/');
});

/**
 * 构建树形数据
 */
function buildTreeData(files: IFileItem[], parentPath: string): IFileNode[] {
  const nodes: IFileNode[] = [];

  for (const file of files) {
    const nodeId = `${parentPath}/${file.name}`.replace(/\/+/g, '/');

    const node: IFileNode = {
      id: nodeId,
      name: file.name,
      type: file.is_dir ? 'folder' : 'file',
      size: file.size,
      modified: file.modified,
      path: file.path || nodeId,
      children: file.is_dir ? [] : undefined,
      isExpanded: false,
      hasChildren: file.is_dir
    };

    nodes.push(node);
  }

  // 文件夹排在前面
  return nodes.sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
}

/**
 * 获取节点图标
 */
const getNodeIcon = (node: IFileNode): typeof Folder | typeof Document => {
  return node.type === 'folder' ? Folder : Document;
};

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * 节点点击事件
 */
const handleNodeClick = (node: IFileNode): void => {
  emit('node-click', node);
};

/**
 * 节点展开事件
 */
const handleNodeExpand = (node: IFileNode): void => {
  node.isExpanded = true;
  if (node.type === 'folder' && node.children?.length === 0) {
    emit('load-children', node);
  }
};

/**
 * 节点折叠事件
 */
const handleNodeCollapse = (node: IFileNode): void => {
  node.isExpanded = false;
};

/**
 * 设置当前节点
 */
const setCurrentNode = (node: IFileNode): void => {
  treeRef.value?.setCurrentKey(node.id);
};

/**
 * 刷新树
 */
const refreshTree = (): void => {
  treeRef.value?.store.nodesMap = {};
};

defineExpose({
  setCurrentNode,
  refreshTree
});
</script>

<style scoped>
.file-tree-container {
  height: 100%;
  background: #ffffff;
  overflow-y: auto;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding-right: 8px;
}

.tree-node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: #303133;
}

.tree-node-size {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
}

:deep(.el-tree-node__content) {
  height: 36px;
  cursor: pointer;
}

:deep(.el-tree-node__content:hover) {
  background-color: #f5f7fa;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: #ecf5ff;
  color: #409eff;
}
</style>
