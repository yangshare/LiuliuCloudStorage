import { createHttpClient, AppError } from './httpClient'
import { AxiosInstance } from 'axios'
import * as fs from 'fs'
import * as path from 'path'

export interface FileItem {
  name: string
  size: number
  isDir: boolean
  modified: string
  sign?: string
  thumb?: string
  type?: number
}

export interface UploadResult {
  success: boolean
  taskId?: string
  error?: string
}

export interface UploadOptions {
  startByte?: number  // 断点续传起始位置
}

export interface UploadTask {
  id: string
  name: string
  state: number
  status: string
  progress: number
  error: string
}

export interface DownloadUrlResult {
  success: boolean
  rawUrl?: string
  fileName?: string
  fileSize?: number
  error?: string
}

export interface ListFilesResponse {
  content: FileItem[]
  total: number
  readme: string
  write: boolean
  provider: string
}

export interface UserInfo {
  id: number
  username: string
  basePath: string
  role: number[]
  disabled: boolean
  permission: number
}

interface AlistApiResponse<T> {
  code: number
  message: string
  data: T
}

class AlistService {
  private client: AxiosInstance | null = null
  private token: string = ''
  private basePath: string = ''
  private userId: number | null = null

  initialize(baseURL: string): void {
    this.client = createHttpClient(baseURL)
  }

  setToken(token: string): void {
    this.token = token
  }

  setBasePath(path: string): void {
    this.basePath = path
  }

  setUserId(id: number): void {
    this.userId = id
  }

  getCurrentUserId(): number | null {
    return this.userId
  }

  getBasePath(): string {
    return this.basePath
  }

  private getFullPath(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    if (this.basePath === '/') {
      return normalizedPath
    }
    return `${this.basePath}${normalizedPath}`
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  async getMe(): Promise<UserInfo> {
    if (!this.client) {
      throw { code: 'NOT_INITIALIZED', message: 'AlistService 未初始化' } as AppError
    }

    const response = await this.client.get<AlistApiResponse<UserInfo>>(
      '/api/me',
      { headers: this.getHeaders() }
    )

    if (response.data.code !== 200) {
      throw {
        code: `ALIST_${response.data.code}`,
        message: response.data.message || '获取用户信息失败'
      } as AppError
    }

    return response.data.data
  }

  async listFiles(path: string = '/'): Promise<ListFilesResponse> {
    if (!this.client) {
      throw { code: 'NOT_INITIALIZED', message: 'AlistService 未初始化' } as AppError
    }

    const fullPath = this.getFullPath(path)
    console.log('[AlistService] listFiles called with path:', path, 'fullPath:', fullPath)
    console.log('[AlistService] Headers:', this.getHeaders())

    const response = await this.client.post<AlistApiResponse<ListFilesResponse>>(
      '/api/fs/list',
      { path: fullPath, refresh: false },
      { headers: this.getHeaders() }
    )

    console.log('[AlistService] Response status:', response.status)
    console.log('[AlistService] Response data:', JSON.stringify(response.data, null, 2))

    const apiResponse = response.data
    if (apiResponse.code !== 200) {
      throw {
        code: `ALIST_${apiResponse.code}`,
        message: apiResponse.message || '获取文件列表失败'
      } as AppError
    }

    return apiResponse.data
  }

  async createFolder(path: string): Promise<void> {
    if (!this.client) {
      throw { code: 'NOT_INITIALIZED', message: 'AlistService 未初始化' } as AppError
    }

    const fullPath = this.getFullPath(path)
    const response = await this.client.post<AlistApiResponse<null>>(
      '/api/fs/mkdir',
      { path: fullPath },
      { headers: this.getHeaders() }
    )

    if (response.data.code !== 200) {
      throw {
        code: `ALIST_${response.data.code}`,
        message: response.data.message || '创建文件夹失败'
      } as AppError
    }
  }

  isInitialized(): boolean {
    return this.client !== null
  }

  async uploadFile(localPath: string, remotePath: string, options: UploadOptions = {}): Promise<UploadResult> {
    if (!this.client) {
      throw { code: 'NOT_INITIALIZED', message: 'AlistService 未初始化' } as AppError
    }

    try {
      // 检查本地文件是否存在
      if (!fs.existsSync(localPath)) {
        return {
          success: false,
          error: '本地文件不存在'
        }
      }

      // 添加 base_path 前缀
      const fullRemotePath = this.getFullPath(remotePath)

      // 获取文件信息
      const fileStats = fs.statSync(localPath)
      const startByte = options.startByte || 0

      // 从断点位置创建文件流（支持断点续传）
      const fileStream = fs.createReadStream(localPath, {
        start: startByte,
        end: fileStats.size - 1
      })

      // 构建请求头
      const headers: Record<string, string> = {
        ...this.getHeaders(),
        'Content-Type': 'application/octet-stream',
        'File-Path': fullRemotePath
      }

      // 添加断点续传 header（关键：Content-Range）
      if (startByte > 0) {
        headers['Content-Range'] = `bytes ${startByte}-${fileStats.size - 1}/${fileStats.size}`
      } else {
        headers['Content-Length'] = fileStats.size.toString()
      }

      // 流式上传
      const response = await this.client.put<AlistApiResponse<{ task: UploadTask }>>(
        '/api/fs/put',
        fileStream,
        {
          headers,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      )

      if (response.data.code === 200) {
        return {
          success: true,
          taskId: response.data.data.task.id
        }
      } else {
        return {
          success: false,
          error: response.data.message
        }
      }
    } catch (error: any) {
      console.error('[AlistService] Upload error:', error)
      return {
        success: false,
        error: error.message || '上传失败'
      }
    }
  }

  async removeFile(dir: string, names: string[]): Promise<void> {
    if (!this.client) {
      throw { code: 'NOT_INITIALIZED', message: 'AlistService 未初始化' } as AppError
    }

    const fullDir = this.getFullPath(dir)
    const response = await this.client.post<AlistApiResponse<null>>(
      '/api/fs/remove',
      { dir: fullDir, names },
      { headers: this.getHeaders() }
    )

    if (response.data.code !== 200) {
      throw {
        code: `ALIST_${response.data.code}`,
        message: response.data.message || '删除文件失败'
      } as AppError
    }
  }

  async getDownloadUrl(remotePath: string): Promise<DownloadUrlResult> {
    if (!this.client) {
      throw { code: 'NOT_INITIALIZED', message: 'AlistService 未初始化' } as AppError
    }

    try {
      // 添加 base_path 前缀
      const fullRemotePath = this.getFullPath(remotePath)

      const response = await this.client.post<AlistApiResponse<{
        raw_url: string
        file: {
          name: string
          size: number
          modified: string
        }
      }>>(
        '/api/fs/get',
        { path: fullRemotePath },
        { headers: this.getHeaders() }
      )

      if (response.data.code === 200) {
        return {
          success: true,
          rawUrl: response.data.data.raw_url,
          fileName: response.data.data.file.name,
          fileSize: response.data.data.file.size
        }
      } else {
        return {
          success: false,
          error: response.data.message
        }
      }
    } catch (error: any) {
      console.error('[AlistService] Get download URL error:', error)
      return {
        success: false,
        error: error.message || '获取下载链接失败'
      }
    }
  }
}

export const alistService = new AlistService()
