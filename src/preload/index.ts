/**
 * Preload 脚本
 * 通过 Context Bridge 暴露安全的 API 给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IAuthRequest, IRegisterRequest, IResetPasswordRequest } from '@shared/types/auth.types';
import { IUploadRequest, IUploadOptions } from '@shared/types/upload.types';
import { IDownloadOptions } from '@shared/types/download.types';

/**
 * 认证 API
 */
const authAPI = {
  /**
   * 登录
   */
  login: (request: IAuthRequest): Promise<{ success: boolean; message?: string; data?: any }> => {
    return ipcRenderer.invoke('auth:login', request);
  },

  /**
   * 注册
   */
  register: (request: IRegisterRequest): Promise<{ success: boolean; message?: string; data?: any }> => {
    return ipcRenderer.invoke('auth:register', request);
  },

  /**
   * 登出
   */
  logout: (): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('auth:logout');
  },

  /**
   * 密码重置
   */
  resetPassword: (request: IResetPasswordRequest): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('auth:reset-password', request);
  },

  /**
   * 获取当前会话
   */
  getSession: (): Promise<{ success: boolean; data?: any; message?: string }> => {
    return ipcRenderer.invoke('auth:get-session');
  }
};

/**
 * 文件系统 API
 */
const fsAPI = {
  /**
   * 列出文件
   */
  list: (path: string = '/'): Promise<any> => {
    return ipcRenderer.invoke('fs:list', path);
  },

  /**
   * 创建目录
   */
  mkdir: (path: string): Promise<any> => {
    return ipcRenderer.invoke('fs:mkdir', path);
  },

  /**
   * 重命名
   */
  rename: (path: string, newName: string): Promise<any> => {
    return ipcRenderer.invoke('fs:rename', path, newName);
  },

  /**
   * 删除
   */
  delete: (path: string): Promise<any> => {
    return ipcRenderer.invoke('fs:delete', path);
  },

  /**
   * 上传文件
   */
  upload: (fileData: ArrayBuffer, filename: string, targetPath: string): Promise<any> => {
    return ipcRenderer.invoke('fs:upload', fileData, filename, targetPath);
  },

  /**
   * 下载文件
   */
  download: (path: string): Promise<any> => {
    return ipcRenderer.invoke('fs:download', path);
  }
};

/**
 * 用户配置 API
 */
const userAPI = {
  /**
   * 获取用户配置
   */
  getConfig: (): Promise<{ success: boolean; data?: any; message?: string }> => {
    return ipcRenderer.invoke('user:get-config');
  }
};

/**
 * 上传 API
 */
const uploadAPI = {
  /**
   * 开始上传
   */
  start: (
    requests: IUploadRequest[],
    options?: Partial<IUploadOptions>
  ): Promise<{ success: boolean; message?: string; taskIds?: string[] }> => {
    return ipcRenderer.invoke('upload:start', requests, options);
  },

  /**
   * 暂停上传
   */
  pause: (taskId: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('upload:pause', taskId);
  },

  /**
   * 恢复上传
   */
  resume: (taskId: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('upload:resume', taskId);
  },

  /**
   * 取消上传
   */
  cancel: (taskId: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('upload:cancel', taskId);
  },

  /**
   * 重试上传
   */
  retry: (taskId: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('upload:retry', taskId);
  },

  /**
   * 清除已完成任务
   */
  clearCompleted: (): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('upload:clear-completed');
  },

  /**
   * 监听上传进度
   */
  onProgress: (callback: (task: any) => void) => {
    const listener = (_event: any, task: any) => callback(task);
    ipcRenderer.on('upload:progress', listener);
    return () => ipcRenderer.removeListener('upload:progress', listener);
  },

  /**
   * 监听上传完成
   */
  onCompleted: (callback: (task: any) => void) => {
    const listener = (_event: any, task: any) => callback(task);
    ipcRenderer.on('upload:completed', listener);
    return () => ipcRenderer.removeListener('upload:completed', listener);
  },

  /**
   * 监听上传失败
   */
  onFailed: (callback: (task: any) => void) => {
    const listener = (_event: any, task: any) => callback(task);
    ipcRenderer.on('upload:failed', listener);
    return () => ipcRenderer.removeListener('upload:failed', listener);
  }
};

/**
 * 下载 API
 */
const downloadAPI = {
  /**
   * 开始下载
   */
  start: (
    requests: any[],
    options?: Partial<IDownloadOptions>
  ): Promise<{ success: boolean; message?: string; taskIds?: string[] }> => {
    return ipcRenderer.invoke('download:start', requests, options);
  },

  /**
   * 选择保存路径
   */
  selectPath: (defaultFileName?: string): Promise<{ success: boolean; savePath?: string }> => {
    return ipcRenderer.invoke('download:select-path', defaultFileName);
  },

  /**
   * 暂停下载
   */
  pause: (taskId: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('download:pause', taskId);
  },

  /**
   * 恢复下载
   */
  resume: (taskId: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('download:resume', taskId);
  },

  /**
   * 取消下载
   */
  cancel: (taskId: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('download:cancel', taskId);
  },

  /**
   * 重试下载
   */
  retry: (taskId: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('download:retry', taskId);
  },

  /**
   * 清除已完成任务
   */
  clearCompleted: (): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('download:clear-completed');
  },

  /**
   * 监听下载进度
   */
  onProgress: (callback: (task: any) => void) => {
    const listener = (_event: any, task: any) => callback(task);
    ipcRenderer.on('download:progress', listener);
    return () => ipcRenderer.removeListener('download:progress', listener);
  },

  /**
   * 监听下载完成
   */
  onCompleted: (callback: (task: any) => void) => {
    const listener = (_event: any, task: any) => callback(task);
    ipcRenderer.on('download:completed', listener);
    return () => ipcRenderer.removeListener('download:completed', listener);
  },

  /**
   * 监听下载失败
   */
  onFailed: (callback: (task: any) => void) => {
    const listener = (_event: any, task: any) => callback(task);
    ipcRenderer.on('download:failed', listener);
    return () => ipcRenderer.removeListener('download:failed', listener);
  }
};

/**
 * 暴露给渲染进程的 API
 */
export interface ElectronAPI {
  auth: typeof authAPI;
  fs: typeof fsAPI;
  user: typeof userAPI;
  upload: typeof uploadAPI;
  download: typeof downloadAPI;
}

/**
 * 通过 Context Bridge 暴露 API
 */
contextBridge.exposeInMainWorld('electronAPI', {
  auth: authAPI,
  fs: fsAPI,
  user: userAPI,
  upload: uploadAPI,
  download: downloadAPI
} as ElectronAPI);

/**
 * 类型声明
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
