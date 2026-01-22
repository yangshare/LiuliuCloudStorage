<script setup lang="ts">
import { ElDrawer, ElDescriptions, ElDescriptionsItem } from 'element-plus'
import { useFileStore } from '../../stores/fileStore'
import { formatFileSize, formatDate } from '../../utils/formatters'

const fileStore = useFileStore()

function getFileType(name: string, isDir: boolean): string {
  if (isDir) return '文件夹'
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const types: Record<string, string> = {
    pdf: 'PDF 文档', doc: 'Word 文档', docx: 'Word 文档',
    xls: 'Excel 表格', xlsx: 'Excel 表格',
    ppt: 'PPT 演示', pptx: 'PPT 演示',
    jpg: '图片', jpeg: '图片', png: '图片', gif: '图片', webp: '图片',
    mp4: '视频', avi: '视频', mkv: '视频', mov: '视频',
    mp3: '音频', wav: '音频', flac: '音频',
    zip: '压缩包', rar: '压缩包', '7z': '压缩包',
    txt: '文本文件', md: 'Markdown'
  }
  return types[ext] || '文件'
}
</script>

<template>
  <el-drawer
    :model-value="!!fileStore.selectedFile"
    :width="320"
    direction="rtl"
    @update:model-value="(v) => !v && fileStore.selectFile(null)"
    title="文件详情"
    class="file-detail-drawer"
  >
    <el-descriptions v-if="fileStore.selectedFile" :column="1" label-placement="left" border class="netease-descriptions">
      <el-descriptions-item label="名称">{{ fileStore.selectedFile.name }}</el-descriptions-item>
      <el-descriptions-item label="类型">{{ getFileType(fileStore.selectedFile.name, fileStore.selectedFile.isDir) }}</el-descriptions-item>
      <el-descriptions-item label="大小">{{ fileStore.selectedFile.isDir ? '-' : formatFileSize(fileStore.selectedFile.size) }}</el-descriptions-item>
      <el-descriptions-item label="修改时间">{{ formatDate(fileStore.selectedFile.modified) }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ formatDate(fileStore.selectedFile.created) }}</el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>

<style scoped>
/* 抽屉样式 - 网易云风格 */
:deep(.el-drawer) {
  border-radius: var(--radius-xl) 0 0 var(--radius-xl) !important;
  box-shadow: var(--shadow-xl) !important;
}

:deep(.el-drawer__header) {
  background: linear-gradient(135deg, var(--netease-red) 0%, var(--netease-red-light) 100%) !important;
  padding: 20px 24px !important;
  margin-bottom: 0;
}

:deep(.el-drawer__title) {
  color: #fff !important;
  font-weight: 600;
  font-size: 18px;
}

:deep(.el-drawer__body) {
  padding: 20px 24px;
}

:deep(.el-drawer__headerbtn) {
  top: 22px;
}

:deep(.el-drawer__headerbtn .el-drawer__close) {
  color: #fff !important;
  font-size: 20px;
}

:deep(.el-drawer__headerbtn:hover .el-drawer__close) {
  color: rgba(255, 255, 255, 0.8) !important;
}

/* 描述列表样式 - 网易云风格 */
.netease-descriptions {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--radius-md);
  overflow: hidden;
}

:deep(.el-descriptions__label) {
  font-weight: 500;
  color: var(--netease-gray-6);
  background: rgba(245, 245, 245, 0.5) !important;
}

:deep(.el-descriptions__content) {
  color: var(--netease-gray-7);
  font-weight: 500;
}

:deep(.el-descriptions__cell) {
  border-color: rgba(0, 0, 0, 0.06) !important;
  padding: 12px 16px !important;
}

:deep(.el-descriptions__label.el-descriptions__cell.is-bordered-label) {
  background: rgba(245, 245, 245, 0.5) !important;
}
</style>