/**
 * 文件上传相关类型定义
 */

/**
 * 上传任务状态
 */
export enum UploadStatus {
  PENDING = 'pending',           // 等待上传
  UPLOADING = 'uploading',       // 上传中
  COMPLETED = 'completed',       // 上传完成
  FAILED = 'failed',             // 上传失败
  PAUSED = 'paused',             // 已暂停
  CANCELLED = 'cancelled'        // 已取消
}

/**
 * 上传进度信息
 */
export interface IUploadProgress {
  uploaded: number;              // 已上传字节数
  total: number;                 // 总字节数
  percentage: number;            // 进度百分比 (0-100)
}

/**
 * 上传任务
 */
export interface IUploadTask {
  id: string;                    // 任务 ID
  file: IUploadFile;             // 文件信息
  targetPath: string;            // 目标路径
  status: UploadStatus;          // 任务状态
  progress: IUploadProgress;     // 上传进度
  speed: number;                 // 上传速度 (字节/秒)
  remainingTime: number;         // 剩余时间 (秒)
  error?: string;                // 错误信息
  retryCount: number;            // 已重试次数
  maxRetries: number;            // 最大重试次数
  createdAt: string;             // 创建时间
  updatedAt: string;             // 更新时间
  completedAt?: string;          // 完成时间
}

/**
 * 上传文件信息
 */
export interface IUploadFile {
  name: string;                  // 文件名
  path: string;                  // 本地文件路径
  size: number;                  // 文件大小
  type: string;                  // MIME 类型
  lastModified: string;          // 最后修改时间
}

/**
 * 上传选项
 */
export interface IUploadOptions {
  concurrency?: number;          // 并发上传数量
  maxRetries?: number;           // 最大重试次数
  retryDelay?: number;           // 重试延迟 (毫秒)
  timeout?: number;              // 超时时间 (毫秒)
  chunkSize?: number;            // 分片上传大小 (字节)
}

/**
 * 上传统计信息
 */
export interface IUploadStats {
  total: number;                 // 总任务数
  uploading: number;             // 上传中
  completed: number;             // 已完成
  failed: number;                // 失败
  paused: number;                // 已暂停
  totalSpeed: number;            // 总速度 (字节/秒)
  totalProgress: number;         // 总进度百分比
}

/**
 * 上传请求
 */
export interface IUploadRequest {
  filePath: string;              // 文件路径
  targetPath: string;            // 目标路径
  fileName?: string;             // 自定义文件名
}

/**
 * 上传响应
 */
export interface IUploadResponse {
  taskId: string;                // 任务 ID
  file: {
    name: string;                // 文件名
    size: number;                // 文件大小
    path: string;                // 服务器路径
  };
}

/**
 * 批量上传响应
 */
export interface IBatchUploadResponse {
  success: boolean;
  message?: string;
  taskIds: string[];             // 任务 ID 列表
}
