/**
 * 用户认证相关类型定义
 */

/**
 * 登录请求接口
 */
export interface IAuthRequest {
  username: string;
  password: string;
}

/**
 * 登录响应接口
 */
export interface IAuthResponse {
  code: number;
  message: string;
  data: {
    token: string;
  };
}

/**
 * 注册请求接口
 */
export interface IRegisterRequest {
  username: string;
  password: string;
  email?: string;
}

/**
 * 注册响应接口
 */
export interface IRegisterResponse {
  success: boolean;
  message: string;
  data?: {
    username: string;
    basePath: string;
  };
}

/**
 * 密码重置请求接口
 */
export interface IResetPasswordRequest {
  username: string;
  email: string;
}

/**
 * 密码重置响应接口
 */
export interface IResetPasswordResponse {
  success: boolean;
  message: string;
}

/**
 * 用户会话数据模型
 */
export interface IUserSession {
  id: string;
  username: string;
  token: string;
  createdAt: string;
  lastActiveAt: string;
  deviceId: string;
}

/**
 * 用户信息接口
 */
export interface IUserInfo {
  username: string;
  email?: string;
  basePath?: string;
}
