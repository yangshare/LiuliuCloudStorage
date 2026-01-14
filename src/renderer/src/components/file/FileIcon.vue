<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import {
  FolderOutline,
  ImageOutline,
  VideocamOutline,
  MusicalNotesOutline,
  DocumentOutline,
  ArchiveOutline,
  CodeSlashOutline
} from '@vicons/ionicons5'

const props = defineProps<{
  isDir: boolean
  name: string
}>()

const iconComponent = computed(() => {
  if (props.isDir) return FolderOutline

  const ext = props.name.split('.').pop()?.toLowerCase() || ''

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']
  const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv']
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg']
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']
  const codeExts = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'vue', 'jsx', 'tsx']

  if (imageExts.includes(ext)) return ImageOutline
  if (videoExts.includes(ext)) return VideocamOutline
  if (audioExts.includes(ext)) return MusicalNotesOutline
  if (archiveExts.includes(ext)) return ArchiveOutline
  if (codeExts.includes(ext)) return CodeSlashOutline

  return DocumentOutline
})

const iconColor = computed(() => {
  if (props.isDir) return '#f0a020'
  return '#666'
})
</script>

<template>
  <n-icon :size="20" :color="iconColor">
    <component :is="iconComponent" />
  </n-icon>
</template>
