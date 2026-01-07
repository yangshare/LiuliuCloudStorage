/**
 * 传输管理类型定义
 * 统一管理上传和下载任务
 */

import { IUploadTask } from './upload.types';
import { IDownloadTask } from './download.types';

/**
 * 传输类型
 */
export enum TransferType {
  UPLOAD = 'upload',
  DOWNLOAD = 'download'
}

/**
 * 传输优先级
 */
export enum TransferPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high'
}

/**
 * 传输状态（联合类型）
 */
export type TransferStatus = 'pending' | 'uploading' | 'downloading' | 'completed' | 'failed' | 'paused' | 'cancelled';

/**
 * 传输统计
 */
export interface ITransferStats {
  // 上传统计
  uploadCount: number;
  uploadCompleted: number;
  uploadFailed: number;
  uploadSpeed: number;
  uploadTotalSize: number;
  uploadUploadedSize: number;

  // 下载统计
  downloadCount: number;
  downloadCompleted: number;
  downloadFailed: number;
  downloadSpeed: number;
  downloadTotalSize: number;
  downloadDownloadedSize: number;

  // 总计
  totalSpeed: number;
  totalProgress: number;
  activeCount: number;

  // 时间统计
  todayUploadCount: number;
  todayDownloadCount: number;
  todayUploadSize: number;
  todayDownloadSize: number;

  // 统计时间
  lastUpdated: string;
}

/**
 * 传输历史记录项
 */
export interface ITransferHistoryItem {
  id: string;
  type: TransferType;
  fileName: string;
  filePath: string;
  fileSize: number;
  status: TransferStatus;
  progress: {
    uploaded: number;
    downloaded: number;
    total: number;
    percentage: number;
  };
  speed: number;
  duration: number; // 持续时间（秒）
  startTime: string;
  endTime?: string;
  error?: string;
  priority: TransferPriority;
  retryCount: number;
}

/**
 * 速度限制配置
 */
export interface ISpeedLimit {
  enabled: boolean;
  uploadLimit: number; // 上传速度限制（字节/秒）
  downloadLimit: number; // 下载速度限制（字节/秒）
}

/**
 * 传输任务（联合类型）
 */
export type ITransferTask = IUploadTask | IDownloadTask;

/**
 * 批量操作类型
 */
export enum BatchOperation {
  PAUSE = 'pause',
  RESUME = 'resume',
  CANCEL = 'cancel',
  RETRY = 'retry',
  REMOVE = 'remove',
  SET_PRIORITY = 'setPriority'
}

/**
 * 批量操作请求
 */
export interface IBatchOperationRequest {
  operation: BatchOperation;
  taskIds: string[];
  priority?: TransferPriority; // 用于设置优先级
}

/**
 * 批量操作响应
 */
export interface IBatchOperationResponse {
  success: boolean;
  message: string;
  results: Array<{
    taskId: string;
    success: boolean;
    message?: string;
  }>;
  affectedCount: number;
}

/**
 * 传输配置
 */
export interface ITransferConfig {
  // 并发控制
  maxConcurrentUploads: number;
  maxConcurrentDownloads: number;
  maxConcurrentTransfers: number;

  // 重试配置
  maxRetries: number;
  retryDelay: number; // 重试延迟（毫秒）

  // 速度限制
  speedLimit: ISpeedLimit;

  // 默认优先级
  defaultPriority: TransferPriority;

  // 历史记录
  historyRetentionDays: number; // 历史记录保留天数
  maxHistoryItems: number; // 最大历史记录数

  // 自动清理
  autoClearCompleted: boolean;
  autoClearCompletedDelay: number; // 完成后自动清理延迟（毫秒）
}

/**
 * 传输事件类型
 */
export enum TransferEventType {
  TASK_ADDED = 'task_added',
  TASK_STARTED = 'task_started',
  TASK_PROGRESS = 'task_progress',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  TASK_PAUSED = 'task_paused',
  TASK_RESUMED = 'task_resumed',
  TASK_CANCELLED = 'task_cancelled',
  TASK_REMOVED = 'task_removed',
  BATCH_OPERATION = 'batch_operation',
  STATS_UPDATED = 'stats_updated',
  SPEED_LIMIT_CHANGED = 'speed_limit_changed',
  PRIORITY_CHANGED = 'priority_changed'
}

/**
 * 传输事件数据
 */
export interface ITransferEventData {
  type: TransferEventType;
  taskId?: string;
  task?: ITransferTask;
  tasks?: ITransferTask[];
  stats?: ITransferStats;
  batchOperation?: IBatchOperationRequest;
  timestamp: string;
}
