# LiuliuCloudStorage
溜溜网盘，一个不限速的小众网盘工具

 | 优先级 | 提案 ID              | 功能           | 依赖             |
  |--------|----------------------|----------------|------------------|
  | 1      | add-user-auth        | 用户认证模块   | 无               |
  | 2      | add-multi-tenant     | 多租户隔离模块 | user-auth        |
  | 3      | add-file-system      | 文件系统模块   | multi-tenant     |
  | 4      | add-file-upload      | 文件上传模块   | file-system      |
  | 5      | add-file-download    | 文件下载模块   | file-system      |
  | 6      | add-transfer-manager | 传输管理模块   | upload, download |
  | 7      | add-ui-components    | UI 组件模块    | 所有核心功能     |
