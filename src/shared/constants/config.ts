/**
 * 应用配置文件
 * 根据环境变量加载不同配置
 */

interface IAlistConfig {
  baseUrl: string;
  timeout: number;
}

interface IN8nConfig {
  baseUrl: string;
  webhookPath: {
    register: string;
    resetPassword: string;
  };
}

interface IAppConfig {
  uploadChunkSize: number;
  uploadConcurrency: number;
  virtualScrollThreshold: number;
}

export interface IConfig {
  alist: IAlistConfig;
  n8n: IN8nConfig;
  app: IAppConfig;
}

/**
 * 开发环境配置
 */
const developmentConfig: IConfig = {
  alist: {
    baseUrl: process.env.ALIST_BASE_URL || 'http://localhost:5244',
    timeout: 30000
  },
  n8n: {
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
    webhookPath: {
      register: '/webhook/register',
      resetPassword: '/webhook/reset-password'
    }
  },
  app: {
    uploadChunkSize: 5 * 1024 * 1024, // 5MB
    uploadConcurrency: 3,
    virtualScrollThreshold: 500
  }
};

/**
 * 生产环境配置
 */
const productionConfig: IConfig = {
  alist: {
    baseUrl: process.env.ALIST_BASE_URL || 'https://alist.example.com',
    timeout: 30000
  },
  n8n: {
    baseUrl: process.env.N8N_BASE_URL || 'https://n8n.example.com',
    webhookPath: {
      register: '/webhook/register',
      resetPassword: '/webhook/reset-password'
    }
  },
  app: {
    uploadChunkSize: 5 * 1024 * 1024, // 5MB
    uploadConcurrency: 3,
    virtualScrollThreshold: 500
  }
};

/**
 * 获取当前环境配置
 */
export function getConfig(): IConfig {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production' ? productionConfig : developmentConfig;
}

/**
 * 导出配置实例
 */
export const config = getConfig();
