import { createHttpClient, AppError } from './httpClient'
import { AxiosInstance } from 'axios'
import * as fs from 'fs'

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
  private deviceKey: string = ''  // Alist 要求的设备密钥
  private basePath: string = ''
  private storagePath: string = '/baidu'  // 存储名称前缀（如 /baidu, /alist）
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

  setStoragePath(path: string): void {
    this.storagePath = path
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
    // 对于 Alist API，使用存储路径前缀（如 /baidu/封面素材/...）
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    if (this.storagePath === '/') {
      return normalizedPath
    }
    // 确保不重复斜杠
    const cleanStoragePath = this.storagePath.endsWith('/') ? this.storagePath.slice(0, -1) : this.storagePath
    const fullPath = `${cleanStoragePath}${normalizedPath}`
    console.log('[AlistService.getFullPath] storagePath:', this.storagePath, 'path:', path, '→ fullPath:', fullPath)
    return fullPath
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.token) {
      // Alist 直接使用 token，不需要 Bearer 前缀
      headers['Authorization'] = this.token
    }
    if (this.deviceKey) {
      headers['device-key'] = this.deviceKey
    }
    return headers
  }

  /**
   * 调用 Alist 登录接口获取 token
   */
  async login(username: string, password: string): Promise<{ success: boolean; token?: string; message?: string }> {
    if (!this.client) {
      return { success: false, message: 'AlistService 未初始化' }
    }

    try {
      console.log('[AlistService.login] 发起登录请求, 用户名:', username)
      const response = await this.client.post<AlistApiResponse<{ token: string; device_key: string }>>(
        '/api/auth/login',
        { username, password }
      )

      console.log('[AlistService.login] 响应数据:', {
        code: response.data.code,
        message: response.data.message,
        hasData: !!response.data.data
      })

      if (response.data.code === 200 && response.data.data?.token) {
        const token = response.data.data.token
        const deviceKey = response.data.data.device_key
        this.token = token
        this.deviceKey = deviceKey
        console.log('[AlistService.login] Token 已设置, 长度:', token.length, '前30字符:', token.substring(0, 30))
        console.log('[AlistService.login] DeviceKey 已设置:', deviceKey)
        return { success: true, token }
      } else {
        console.error('[AlistService.login] 登录失败, 响应码:', response.data.code)
        return {
          success: false,
          message: response.data.message || '登录失败'
        }
      }
    } catch (error: any) {
      console.error('[AlistService.login] 异常:', error.message)
      return {
        success: false,
        message: error.response?.data?.message || error.message || '网络错误，请稍后重试'
      }
    }
  }

  async getMe(): Promise<UserInfo> {
    if (!this.client) {
      throw { code: 'NOT_INITIALIZED', message: 'AlistService 未初始化' } as AppError
    }

    const headers = this.getHeaders()
    console.log('[AlistService.getMe] 调用 /api/me')
    console.log('[AlistService.getMe] Token 存在:', !!this.token, '长度:', this.token?.length)
    console.log('[AlistService.getMe] DeviceKey 存在:', !!this.deviceKey, '值:', this.deviceKey)
    console.log('[AlistService.getMe] 请求头 Authorization:', headers['Authorization']?.substring(0, 30) + '...')
    console.log('[AlistService.getMe] 请求头 device-key:', headers['device-key'])

    const response = await this.client.get<AlistApiResponse<UserInfo>>(
      '/api/me',
      { headers }
    )

    console.log('[AlistService.getMe] 响应码:', response.data.code, '消息:', response.data.message)

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
        rawUrl: string
        name: string
        size: number
        modified: string
      }>>(
        '/api/fs/get',
        { path: fullRemotePath },
        { headers: this.getHeaders() }
      )

      console.log('[AlistService.getDownloadUrl] 响应:', {
        code: response.data.code,
        message: response.data.message,
        dataKeys: response.data.data ? Object.keys(response.data.data) : 'null',
        rawData: response.data.data
      })

      if (response.data.code === 200) {
        return {
          success: true,
          rawUrl: response.data.data.rawUrl,
          fileName: response.data.data.name,
          fileSize: response.data.data.size
        }
      } else {
        console.error('[AlistService.getDownloadUrl] Alist API 返回错误:', {
          code: response.data.code,
          message: response.data.message
        })
        return {
          success: false,
          error: `Alist错误(${response.data.code}): ${response.data.message}`
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
