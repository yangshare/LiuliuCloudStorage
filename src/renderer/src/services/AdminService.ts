/**
 * 管理员服务
 * 处理管理员相关的API调用
 */

export interface UserListItem {
  id: number
  username: string
  quotaTotal: number
  quotaUsed: number
  usageRate: number
  createdAt: string
  isAdmin: boolean
  status: 'active' | 'admin'
}

export interface GetUsersParams {
  page?: number
  pageSize?: number
  search?: string
}

export interface GetUsersResponse {
  list: UserListItem[]
  total: number
  page: number
  pageSize: number
}

export interface StorageStats {
  totalQuota: number
  totalUsed: number
  remaining: number
  usageRate: number
  userCount: number
  topUsers: Array<{
    id: number
    username: string
    quotaTotal: number
    quotaUsed: number
    usageRate: number
  }>
}

class AdminService {
  /**
   * 获取用户列表
   */
  async getUsers(params: GetUsersParams = {}): Promise<GetUsersResponse> {
    const { page = 1, pageSize = 20, search = '' } = params

    const response = await window.electronAPI.auth.getUsers({
      page,
      pageSize,
      search
    })

    if (!response.success) {
      throw new Error(response.message || '获取用户列表失败')
    }

    // 数据格式转换和计算使用率
    const list = response.data.list.map((user: any) => {
      const usageRate = user.quotaTotal > 0
        ? (user.quotaUsed / user.quotaTotal) * 100
        : 0

      return {
        id: user.id,
        username: user.username,
        quotaTotal: user.quotaTotal,
        quotaUsed: user.quotaUsed,
        usageRate,
        createdAt: new Date(user.createdAt).toISOString(),
        isAdmin: Boolean(user.isAdmin),
        status: Boolean(user.isAdmin) ? 'admin' : 'active'
      }
    })

    return {
      list,
      total: response.data.total,
      page: response.data.page,
      pageSize: response.data.pageSize
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    const response = await window.electronAPI.auth.getStorageStats()

    if (!response.success) {
      throw new Error(response.message || '获取存储统计失败')
    }

    const topUsers = response.data.topUsers.map((user: any) => ({
      id: user.id,
      username: user.username,
      quotaTotal: user.quotaTotal,
      quotaUsed: user.quotaUsed,
      usageRate: user.quotaTotal > 0 ? (user.quotaUsed / user.quotaTotal) * 100 : 0
    }))

    return {
      totalQuota: response.data.totalQuota,
      totalUsed: response.data.totalUsed,
      remaining: response.data.remaining,
      usageRate: response.data.usageRate,
      userCount: response.data.userCount,
      topUsers
    }
  }

  /**
   * 调整用户配额
   */
  async adjustUserQuota(userId: number, quotaTotal: number): Promise<void> {
    const response = await window.electronAPI.quota.adminUpdate(userId, quotaTotal)

    if (!response.success) {
      throw new Error(response.message || '调整配额失败')
    }
  }
}

export const adminService = new AdminService()
