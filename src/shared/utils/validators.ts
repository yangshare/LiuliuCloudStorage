/**
 * 输入验证工具
 * 验证用户输入，防止注入攻击
 */

import {
  IPasswordValidationResult,
  PasswordStrength
} from '@shared/types/security.types';

/**
 * 用户名验证结果
 */
export interface IUsernameValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 邮箱验证结果
 */
export interface IEmailValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 路径验证结果
 */
export interface IPathValidationResult {
  valid: boolean;
  error?: string;
  isSuspicious: boolean;
}

/**
 * 常见弱密码列表
 */
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
  'baseball', '111111', 'iloveyou', 'master', ' sunshine',
  'ashley', 'bailey', 'passw0rd', 'shadow', '123123',
  '654321', 'superman', 'qazwsx', 'michael', '12341234'
];

/**
 * 验证用户名
 */
export function validateUsername(username: string): IUsernameValidationResult {
  if (!username) {
    return { valid: false, error: '用户名不能为空' };
  }

  // 长度检查
  if (username.length < 3) {
    return { valid: false, error: '用户名至少需要 3 个字符' };
  }

  if (username.length > 20) {
    return { valid: false, error: '用户名不能超过 20 个字符' };
  }

  // 字符检查：只允许字母、数字、下划线、中文
  const usernameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return { valid: false, error: '用户名只能包含字母、数字、下划线和中文' };
  }

  // 不能以下划线或数字开头
  if (/^[_0-9]/.test(username)) {
    return { valid: false, error: '用户名不能以数字或下划线开头' };
  }

  return { valid: true };
}

/**
 * 验证密码强度
 */
export function validatePassword(password: string, confirmPassword?: string): IPasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本长度检查
  if (!password) {
    return {
      valid: false,
      strength: PasswordStrength.WEAK,
      errors: ['密码不能为空'],
      warnings: []
    };
  }

  if (password.length < 8) {
    errors.push('密码至少需要 8 个字符');
  }

  if (password.length > 128) {
    errors.push('密码不能超过 128 个字符');
  }

  // 确认密码检查
  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.push('两次输入的密码不一致');
  }

  // 常见弱密码检查
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('不能使用常见弱密码');
  }

  // 字符类型检查
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const charTypeCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars]
    .filter(Boolean).length;

  // 基于强度计算
  let strength = PasswordStrength.WEAK;
  if (errors.length === 0) {
    if (charTypeCount >= 3 && password.length >= 12) {
      strength = PasswordStrength.STRONG;
    } else if (charTypeCount >= 2 && password.length >= 10) {
      strength = PasswordStrength.GOOD;
    } else if (charTypeCount >= 2 && password.length >= 8) {
      strength = PasswordStrength.FAIR;
    }
  }

  // 警告（不阻止提交但提醒用户）
  if (!hasUpperCase) {
    warnings.push('建议包含大写字母');
  }

  if (!hasLowerCase) {
    warnings.push('建议包含小写字母');
  }

  if (!hasNumbers) {
    warnings.push('建议包含数字');
  }

  if (!hasSpecialChars) {
    warnings.push('建议包含特殊字符');
  }

  if (charTypeCount < 2) {
    warnings.push('建议使用至少两种字符类型');
  }

  // 如果是纯字母或纯数字
  if (/^[a-zA-Z]+$/.test(password) || /^\d+$/.test(password)) {
    errors.push('密码不能只包含字母或只包含数字');
  }

  return {
    valid: errors.length === 0,
    strength,
    errors,
    warnings
  };
}

/**
 * 验证邮箱格式
 */
export function validateEmail(email: string): IEmailValidationResult {
  if (!email) {
    return { valid: false, error: '邮箱不能为空' };
  }

  // 基本格式检查
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: '邮箱格式不正确' };
  }

  // 长度检查
  if (email.length > 254) {
    return { valid: false, error: '邮箱地址过长' };
  }

  // 本地部分检查
  const [localPart] = email.split('@');
  if (localPart.length > 64) {
    return { valid: false, error: '邮箱本地部分过长' };
  }

  return { valid: true };
}

/**
 * 验证路径安全性（防止路径穿越攻击）
 */
export function validatePath(path: string): IPathValidationResult {
  if (!path) {
    return { valid: false, error: '路径不能为空', isSuspicious: false };
  }

  // 检查路径穿越尝试
  if (path.includes('..') || path.includes('\\..')) {
    return {
      valid: false,
      error: '检测到路径穿越尝试',
      isSuspicious: true
    };
  }

  // 检查绝对路径（Windows 和 Unix）
  if (/^[a-zA-Z]:\\/i.test(path) || /^\//.test(path)) {
    return {
      valid: false,
      error: '不允许使用绝对路径',
      isSuspicious: true
    };
  }

  // 检查 Windows UNC 路径
  if (/^\\\\/.test(path)) {
    return {
      valid: false,
      error: '不允许使用 UNC 路径',
      isSuspicious: true
    };
  }

  // 检查非法字符
  const illegalChars = /[<>:"|?*\x00-\x1f]/;
  if (illegalChars.test(path)) {
    return {
      valid: false,
      error: '路径包含非法字符',
      isSuspicious: true
    };
  }

  // 检查路径长度（Windows MAX_PATH 限制）
  if (path.length > 260) {
    return {
      valid: false,
      error: '路径过长',
      isSuspicious: false
    };
  }

  return { valid: true, isSuspicious: false };
}

/**
 * 规范化路径（移除危险字符）
 */
export function sanitizePath(path: string): string {
  // 移除开头的斜杠
  let sanitized = path.replace(/^[/\\]+/, '');

  // 移除 .. 和路径穿越
  sanitized = sanitized.replace(/\.\./g, '');

  // 替换反斜杠为正斜杠
  sanitized = sanitized.replace(/\\/g, '/');

  // 移除多余的斜杠
  sanitized = sanitized.replace(/\/+/g, '/');

  // 移除结尾的斜杠
  sanitized = sanitized.replace(/\/+$/, '');

  return sanitized;
}

/**
 * 验证 URL
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url) {
    return { valid: false, error: 'URL 不能为空' };
  }

  try {
    const parsed = new URL(url);

    // 只允许 http 和 https 协议
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: '只允许 HTTP 和 HTTPS 协议' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'URL 格式不正确' };
  }
}

/**
 * 验证端口号
 */
export function validatePort(port: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(port)) {
    return { valid: false, error: '端口号必须是整数' };
  }

  if (port < 1 || port > 65535) {
    return { valid: false, error: '端口号必须在 1-65535 之间' };
  }

  // 保留端口
  if (port < 1024) {
    return { valid: false, error: '不能使用系统保留端口（< 1024）' };
  }

  return { valid: true };
}

/**
 * 转义 HTML 特殊字符（防止 XSS）
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 验证 JSON
 */
export function validateJson(json: string): { valid: boolean; error?: string; parsed?: any } {
  if (!json) {
    return { valid: false, error: 'JSON 不能为空' };
  }

  try {
    const parsed = JSON.parse(json);
    return { valid: true, parsed };
  } catch (error) {
    return {
      valid: false,
      error: `JSON 格式错误: ${(error as Error).message}`
    };
  }
}

/**
 * 生成密码哈希（仅用于客户端验证，不用于存储）
 */
export function hashPasswordForValidation(password: string): string {
  // 简单哈希用于客户端验证，实际存储应在服务端使用 bcrypt 等
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}
