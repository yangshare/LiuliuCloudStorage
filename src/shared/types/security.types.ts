/**
 * 安全相关类型定义
 * 包含会话、登录历史、审计日志、二步验证等
 */

import { IFileItem } from './filesystem.types';

/**
 * 会话信息
 */
export interface ISession {
  id: string;
  userId: number;
  username: string;
  sessionId: string; // 唯一会话 ID
  deviceInfo: IDeviceInfo;
  ipAddress?: string;
  loginTime: string;
  lastActiveTime: string;
  expiresAt: string;
  isCurrent: boolean; // 是否为当前会话
}

/**
 * 设备信息
 */
export interface IDeviceInfo {
  deviceName: string; // 设备名称
  platform: string; // 操作系统 (win32, darwin, linux)
  arch: string; // 架构 (x64, arm64)
  osVersion: string; // OS 版本
  appVersion: string; // 应用版本
  browser?: string; // 浏览器信息（Web 端）
}

/**
 * 登录历史记录
 */
export interface ILoginHistory {
  id: string;
  userId: number;
  username: string;
  deviceInfo: IDeviceInfo;
  ipAddress?: string;
  timestamp: string;
  status: LoginStatus;
  failureReason?: string;
  isSuspicious: boolean; // 是否为可疑登录
}

/**
 * 登录状态
 */
export enum LoginStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  LOCKED = 'locked',
  BLOCKED = 'blocked'
}

/**
 * 审计日志
 */
export interface IAuditLog {
  id: string;
  userId: number;
  username: string;
  eventType: AuditEventType;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  timestamp: string;
  severity: AuditSeverity;
}

/**
 * 审计事件类型
 */
export enum AuditEventType {
  // 认证事件
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  TWO_FACTOR_ENABLED = '2fa_enabled',
  TWO_FACTOR_DISABLED = '2fa_disabled',

  // 会话事件
  SESSION_CREATED = 'session_created',
  SESSION_REVOKED = 'session_revoked',
  SESSION_EXPIRED = 'session_expired',

  // 文件操作事件
  FILE_UPLOADED = 'file_uploaded',
  FILE_DOWNLOADED = 'file_downloaded',
  FILE_DELETED = 'file_deleted',
  FILE_RENAMED = 'file_renamed',
  FILE_MOVED = 'file_moved',
  FOLDER_CREATED = 'folder_created',

  // 安全事件
  PATH_TRAVERSAL_ATTEMPT = 'path_traversal_attempt',
  PERMISSION_DENIED = 'permission_denied',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'unauthorized_access_attempt',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  ABNORMAL_ACCESS_PATTERN = 'abnormal_access_pattern',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',

  // 配置事件
  SETTINGS_CHANGED = 'settings_changed',
  API_KEY_CONFIGURED = 'api_key_configured'
}

/**
 * 审计日志严重程度
 */
export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 二步验证密钥
 */
export interface ITwoFactorSecret {
  userId: number;
  secret: string; // TOTP 密钥（加密存储）
  backupCodes: string[]; // 恢复码（加密存储）
  enabled: boolean;
  createdAt: string;
}

/**
 * 二步验证设置请求
 */
export interface ITwoFactorSetupRequest {
  verificationCode: string; // 用户输入的验证码
}

/**
 * 二步验证验证请求
 */
export interface ITwoFactorVerifyRequest {
  username: string;
  password: string;
  totpCode?: string; // TOTP 验证码
  backupCode?: string; // 恢复码
}

/**
 * 二步验证设置响应
 */
export interface ITwoFactorSetupResponse {
  secret: string; // 未加密的密钥（仅用于生成 QR 码）
  qrCodeUrl: string; // QR 码 URL
  backupCodes: string[]; // 恢复码列表
}

/**
 * 安全事件
 */
export interface ISecurityEvent {
  id: string;
  eventType: SecurityEventType;
  userId?: number;
  username?: string;
  description: string;
  details?: Record<string, any>;
  severity: AuditSeverity;
  timestamp: string;
  resolved: boolean;
}

/**
 * 安全事件类型
 */
export enum SecurityEventType {
  MULTIPLE_LOGIN_FAILURES = 'multiple_login_failures',
  NEW_DEVICE_LOGIN = 'new_device_login',
  SUSPICIOUS_LOGIN = 'suspicious_login',
  PATH_TRAVERSAL_ATTACK = 'path_traversal_attack',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  ABNORMAL_FILE_ACCESS = 'abnormal_file_access',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  MALICIOUS_FILE_UPLOAD = 'malicious_file_upload'
}

/**
 * 账号锁定信息
 */
export interface IAccountLock {
  userId: number;
  username: string;
  lockedAt: string;
  unlockAt: string; // 自动解锁时间
  reason: string;
  failedAttempts: number;
}

/**
 * 密码策略配置
 */
export interface IPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventReuse: number; // 防止重复使用最近 N 次的密码
  maxAgeDays: number; // 密码最大有效期（天）
  minChangeIntervalHours: number; // 密码修改最小间隔（小时）
}

/**
 * 密码强度
 */
export enum PasswordStrength {
  WEAK = 'weak',
  FAIR = 'fair',
  GOOD = 'good',
  STRONG = 'strong'
}

/**
 * 密码验证结果
 */
export interface IPasswordValidationResult {
  valid: boolean;
  strength: PasswordStrength;
  errors: string[];
  warnings: string[];
}

/**
 * Token 加密存储
 */
export interface IEncryptedToken {
  userId: number;
  username: string;
  encryptedToken: string; // 使用 safeStorage 加密的 token
  iv?: string; // 初始化向量（如果需要）
  createdAt: string;
  expiresAt: string;
}

/**
 * 安全设置
 */
export interface ISecuritySettings {
  twoFactorEnabled: boolean;
  passwordPolicy: IPasswordPolicy;
  sessionTimeout: number; // 会话超时时间（分钟）
  maxConcurrentSessions: number; // 最大并发会话数
  enableAuditLog: boolean;
  enableLoginNotifications: boolean;
}

/**
 * 会话统计
 */
export interface ISessionStats {
  totalSessions: number;
  activeSessions: number;
  currentSession: ISession | null;
  oldestSession: ISession | null;
  recentSessions: ISession[];
}

/**
 * 登录历史统计
 */
export interface ILoginHistoryStats {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  suspiciousLogins: number;
  uniqueDevices: number;
  uniqueLocations: number;
  lastLoginTime: string;
  lastFailedLoginTime?: string;
}
