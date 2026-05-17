// 兼容层：旧路径重新导出新的 feature-based transfer store
export {
  useTransferStore,
  type UploadTask,
  type DownloadTask,
  type QueueStatus
} from '@/features/transfer/stores/transferStore'
