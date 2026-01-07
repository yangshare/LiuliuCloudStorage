/**
 * 多租户隔离相关类型定义
 */

/**
 * 用户配置接口
 */
export interface IUserConfig {
  username: string;
  basePath: string;
  permissions: IUserPermissions;
  createdAt: string;
  updatedAt: string;
}

/**
 * 用户权限接口
 */
export interface IUserPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
}

/**
 * 虚拟路径映射接口
 */
export interface IVirtualPath {
  virtual: string;    // 用户看到的虚拟路径 (如: /documents)
  physical: string;   // 实际的物理路径 (如: /root/users/username/documents)
}

/**
 * 路径验证结果
 */
export interface IPathValidationResult {
  valid: boolean;
  error?: string;
  physicalPath?: string;
}

/**
 * 安全审计事件类型
 */
export enum SecurityEventType {
  PATH_TRAVERSAL_ATTEMPT = 'PATH_TRAVERSAL_ATTEMPT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

/**
 * 安全审计日志
 */
export interface ISecurityAuditLog {
  id: string;
  eventType: SecurityEventType;
  username: string;
  path: string;
  timestamp: string;
  details?: string;
}
