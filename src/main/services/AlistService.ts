import { createHttpClient, AppError } from './httpClient'
import { AxiosInstance } from 'axios'

export interface FileItem {
  name: string
  size: number
  isDir: boolean
  modified: string
  sign?: string
  thumb?: string
  type?: number
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
      headers['Authorization'] = this.token
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
}

export const alistService = new AlistService()
