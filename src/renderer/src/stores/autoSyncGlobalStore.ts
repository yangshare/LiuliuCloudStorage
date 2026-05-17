// 兼容层：旧路径重新导出新的 feature-based autoSync global store
export {
  useAutoSyncGlobalStore,
  STAGE_TEXT_MAP,
  type SyncStage,
  type SyncItemStatus,
  type AutoSyncGlobalItem,
  type AutoSyncProgressData
} from '@/features/autoSync/stores/autoSyncGlobalStore'
