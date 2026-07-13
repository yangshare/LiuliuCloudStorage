import type { IPCResult } from './ipc'

export type TransferStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface TransferTask {
  id: number
  filePath: string
  remotePath: string
  fileName: string
  fileSize: number
  transferredSize: number
  status: TransferStatus
  userId: number
  taskType: 'upload' | 'download'
  createdAt: string
}

export interface QueueStatus {
  active: number
  pending: number
  maxConcurrent: number
}

export type TransferListResult = IPCResult<TransferTask[]>
export type TransferOperationResult = IPCResult<void>
export type QueueStatusResult = IPCResult<QueueStatus>
