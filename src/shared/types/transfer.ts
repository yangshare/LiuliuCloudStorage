// 传输任务类型定义
// 注意：主要类型从 database/schema.ts 导出，这里只定义辅助类型

export type TaskType = 'upload' | 'download'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

// 用于创建新任务的输入类型
export interface CreateTransferTaskInput {
  userId: number
  taskType: TaskType
  fileName: string
  filePath: string
  remotePath: string
  fileSize: number
}

// 注意：TransferTask 和 NewTransferTask 类型应该从 database/schema.ts 导入
// import type { TransferQueue, NewTransferQueue } from '@/main/database/schema'

