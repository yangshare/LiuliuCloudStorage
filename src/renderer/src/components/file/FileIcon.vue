<script setup lang="ts">
import { computed } from 'vue'
import { ElIcon } from 'element-plus'
import { Folder,
  Picture,
  VideoCamera,
  Microphone,
  Document,
  FolderOpened,
  Tickets
} from '@element-plus/icons-vue'

const props = defineProps<{
  isDir: boolean
  name: string
}>()

const iconComponent = computed(() => {
  if (props.isDir) return Folder

  const ext = props.name.split('.').pop()?.toLowerCase() || ''

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']
  const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv']
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg']
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']
  const codeExts = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'vue', 'jsx', 'tsx']

  if (imageExts.includes(ext)) return Picture
  if (videoExts.includes(ext)) return VideoCamera
  if (audioExts.includes(ext)) return Microphone
  if (archiveExts.includes(ext)) return FolderOpened
  if (codeExts.includes(ext)) return Tickets

  return Document
})

const iconColor = computed(() => {
  if (props.isDir) return '#f0a020'
  return '#666'
})
</script>

<template>
  <el-icon :size="20" :color="iconColor">
    <component :is="iconComponent" />
  </el-icon>
</template>
