import axios, { AxiosInstance, AxiosError } from 'axios'
import axiosRetry from 'axios-retry'

// snake_case 转 camelCase
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// 递归转换对象键名
function convertKeysToCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        toCamelCase(key),
        convertKeysToCamelCase(value)
      ])
    )
  }
  return obj
}

export interface AppError {
  code: string
  message: string
  details?: unknown
}

function normalizeError(error: AxiosError): AppError {
  console.log('[httpClient] Raw error:', error.code, error.message)
  console.log('[httpClient] Error details:', JSON.stringify({
    code: error.code,
    message: error.message,
    status: error.response?.status,
    data: error.response?.data
  }, null, 2))

  if (error.response) {
    const data = error.response.data as Record<string, unknown> | undefined
    return {
      code: `HTTP_${error.response.status}`,
      message: (data?.message as string) || error.message,
      details: data
    }
  }
  if (error.code === 'ECONNABORTED') {
    return { code: 'TIMEOUT', message: '请求超时，请检查网络连接' }
  }
  if (error.code === 'ERR_NETWORK') {
    return { code: 'NETWORK_ERROR', message: '网络连接失败，请检查网络' }
  }
  if (error.code === 'ECONNREFUSED') {
    return { code: 'CONNECTION_REFUSED', message: '无法连接到服务器，请确认 Alist 服务已启动' }
  }
  return { code: 'UNKNOWN_ERROR', message: error.message }
}

export function createHttpClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
  })

  // 配置重试：3次指数退避
  axiosRetry(client, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429
    }
  })

  // 响应拦截器：解包数据 + 转换键名
  client.interceptors.response.use(
    (response) => {
      const data = response.data
      if (data && typeof data === 'object') {
        response.data = convertKeysToCamelCase(data)
      }
      return response
    },
    (error: AxiosError) => {
      const appError = normalizeError(error)
      return Promise.reject(appError)
    }
  )

  return client
}
