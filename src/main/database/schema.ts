import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// 用户表
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  quotaTotal: integer('quota_total').default(10737418240), // 10GB
  quotaUsed: integer('quota_used').default(0),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
  onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).default(false),
  alistToken: text('alist_token'),
  tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
  index('idx_users_username').on(table.username)
])

// 会话表
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  tokenEncrypted: text('token_encrypted').notNull(),
  basePath: text('base_path').default('/'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
  index('idx_sessions_user_id').on(table.userId),
  index('idx_sessions_token').on(table.tokenEncrypted)
])

// 文件缓存表
export const fileCache = sqliteTable('file_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  path: text('path').notNull(),
  content: text('content').notNull(), // JSON string of file list
  cachedAt: integer('cached_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
  index('idx_file_cache_user_path').on(table.userId, table.path)
])

// 传输队列表
export const transferQueue = sqliteTable('transfer_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  taskType: text('task_type', { enum: ['upload', 'download'] }).notNull(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  remotePath: text('remote_path').notNull(),
  fileSize: integer('file_size').notNull(),
  transferredSize: integer('transferred_size').notNull().default(0),
  status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'] }).notNull().default('pending'),
  taskId: text('task_id'),
  errorMessage: text('error_message'),
  resumable: integer('resumable', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
  index('idx_transfer_queue_user_id').on(table.userId),
  index('idx_transfer_queue_status').on(table.status),
  index('idx_transfer_queue_task_type').on(table.taskType),
  index('idx_transfer_queue_user_status').on(table.userId, table.status)
])

// 操作日志表
export const activityLogs = sqliteTable('activity_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  actionType: text('action_type', { enum: ['upload', 'download', 'delete', 'folder_create', 'login', 'logout'] }).notNull(),
  fileCount: integer('file_count').notNull().default(0),
  fileSize: integer('file_size').notNull().default(0),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  details: text('details'), // JSON string for additional details
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
  index('idx_activity_logs_user_id').on(table.userId),
  index('idx_activity_logs_created_at').on(table.createdAt),
  index('idx_activity_logs_action_type').on(table.actionType),
  index('idx_activity_logs_user_created').on(table.userId, table.createdAt)
])

// 每日统计表
export const dailyStats = sqliteTable('daily_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(), // YYYY-MM-DD format
  uploadCount: integer('upload_count').notNull().default(0),
  downloadCount: integer('download_count').notNull().default(0),
  deleteCount: integer('delete_count').notNull().default(0),
  folderCreateCount: integer('folder_create_count').notNull().default(0),
  totalFiles: integer('total_files').notNull().default(0),
  totalSize: integer('total_size').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
  index('idx_daily_stats_user_id').on(table.userId),
  index('idx_daily_stats_date').on(table.date),
  uniqueIndex('idx_daily_stats_user_date').on(table.userId, table.date)
])

// 下载配置表
export const downloadConfig = sqliteTable('download_config', {
  id: integer('id').primaryKey(),
  defaultPath: text('default_path').notNull(),
  autoCreateDateFolder: integer('auto_create_date_folder', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// 分享转存记录表
export const shareTransferRecords = sqliteTable('share_transfer_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  shareUrl: text('share_url').notNull(),
  shareCode: text('share_code'),
  receiver: text('receiver'),
  alistPath: text('alist_path'),
  status: text('status', { enum: ['pending', 'transferring', 'completed', 'failed'] }).notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, (table) => [
  index('idx_share_transfer_user_id').on(table.userId),
  index('idx_share_transfer_status').on(table.status),
  index('idx_share_transfer_created_at').on(table.createdAt)
])

// 类型导出
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type FileCache = typeof fileCache.$inferSelect
export type NewFileCache = typeof fileCache.$inferInsert
export type TransferQueue = typeof transferQueue.$inferSelect
export type NewTransferQueue = typeof transferQueue.$inferInsert
export type ActivityLogs = typeof activityLogs.$inferSelect
export type NewActivityLogs = typeof activityLogs.$inferInsert
export type DailyStats = typeof dailyStats.$inferSelect
export type NewDailyStats = typeof dailyStats.$inferInsert
export type DownloadConfig = typeof downloadConfig.$inferSelect
export type NewDownloadConfig = typeof downloadConfig.$inferInsert
export type ShareTransferRecord = typeof shareTransferRecords.$inferSelect
export type NewShareTransferRecord = typeof shareTransferRecords.$inferInsert
