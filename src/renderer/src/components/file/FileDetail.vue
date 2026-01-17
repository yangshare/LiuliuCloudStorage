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
  >
    <el-descriptions v-if="fileStore.selectedFile" :column="1" label-placement="left" border>
      <el-descriptions-item label="名称">{{ fileStore.selectedFile.name }}</el-descriptions-item>
      <el-descriptions-item label="类型">{{ getFileType(fileStore.selectedFile.name, fileStore.selectedFile.isDir) }}</el-descriptions-item>
      <el-descriptions-item label="大小">{{ fileStore.selectedFile.isDir ? '-' : formatFileSize(fileStore.selectedFile.size) }}</el-descriptions-item>
      <el-descriptions-item label="修改时间">{{ formatDate(fileStore.selectedFile.modified) }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ formatDate(fileStore.selectedFile.created) }}</el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>
