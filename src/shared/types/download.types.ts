/**
 * 文件下载相关类型定义
 */

/**
 * 下载任务状态
 */
export enum DownloadStatus {
  PENDING = 'pending',           // 等待下载
  DOWNLOADING = 'downloading',   // 下载中
  COMPLETED = 'completed',       // 下载完成
  FAILED = 'failed',             // 下载失败
  PAUSED = 'paused',             // 已暂停
  CANCELLED = 'cancelled'        // 已取消
}

/**
 * 下载进度信息
 */
export interface IDownloadProgress {
  downloaded: number;            // 已下载字节数
  total: number;                 // 总字节数
  percentage: number;            // 进度百分比 (0-100)
}

/**
 * 下载任务
 */
export interface IDownloadTask {
  id: string;                    // 任务 ID
  remotePath: string;            // 远程文件路径
  fileName: string;              // 文件名
  savePath: string;              // 本地保存路径
  fileSize: number;              // 文件大小
  status: DownloadStatus;        // 任务状态
  progress: IDownloadProgress;   // 下载进度
  speed: number;                 // 下载速度 (字节/秒)
  remainingTime: number;         // 剩余时间 (秒)
  error?: string;                // 错误信息
  retryCount: number;            // 已重试次数
  maxRetries: number;            // 最大重试次数
  createdAt: string;             // 创建时间
  updatedAt: string;             // 更新时间
  completedAt?: string;          // 完成时间
}

/**
 * 下载选项
 */
export interface IDownloadOptions {
  savePath?: string;             // 保存路径
  concurrency?: number;          // 并发下载数量
  maxRetries?: number;           // 最大重试次数
  retryDelay?: number;           // 重试延迟 (毫秒)
  timeout?: number;              // 超时时间 (毫秒)
  overwrite?: boolean;           // 是否覆盖已存在文件
}

/**
 * 下载请求
 */
export interface IDownloadRequest {
  remotePath: string;            // 远程文件路径
  fileName: string;              // 文件名
  savePath?: string;             // 保存路径
}

/**
 * 下载响应
 */
export interface IDownloadResponse {
  taskId: string;                // 任务 ID
  file: {
    name: string;                // 文件名
    size: number;                // 文件大小
    path: string;                // 本地路径
  };
}

/**
 * 批量下载响应
 */
export interface IBatchDownloadResponse {
  success: boolean;
  message?: string;
  taskIds: string[];             // 任务 ID 列表
}

/**
 * 下载统计信息
 */
export interface IDownloadStats {
  total: number;                 // 总任务数
  downloading: number;           // 下载中
  completed: number;             // 已完成
  failed: number;                // 失败
  paused: number;                // 已暂停
  totalSpeed: number;            // 总速度 (字节/秒)
  totalProgress: number;         // 总进度百分比
}
