// 兼容层：旧路径重新导出新的 feature-based auth store
// 后续组件迁移完成后可删除此文件
export { useAuthStore, type User } from '@/features/auth/stores/authStore'
