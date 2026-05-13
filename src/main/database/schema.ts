import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// 用户表
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  quotaTotal: integer('quota_total').default(10737418240), // 10GB
  quotaUsed: integer('quota_used').default(0),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
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
  actionType: text('action_type', { enum: ['upload', 'download', 'delete', 'rename', 'folder_create', 'login', 'logout'] }).notNull(),
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

// 分享转存自动同步计划表
export const autoSyncPlans = sqliteTable('auto_sync_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  shareUrl: text('share_url').notNull(),
  shareCode: text('share_code'),
  localSyncDir: text('local_sync_dir').notNull(),
  lastAlistPath: text('last_alist_path'),
  status: text('status', { enum: ['enabled', 'paused', 'syncing', 'expired', 'failed', 'deleted'] }).notNull().default('enabled'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  autoRunOnStartup: integer('auto_run_on_startup', { mode: 'boolean' }).notNull().default(true),
  conflictPolicy: text('conflict_policy', { enum: ['skip_existing', 'rename_remote', 'overwrite'] }).notNull().default('skip_existing'),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastSuccessAt: integer('last_success_at', { mode: 'timestamp' }),
  lastErrorMessage: text('last_error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, (table) => [
  index('idx_auto_sync_plans_user_id').on(table.userId),
  index('idx_auto_sync_plans_status').on(table.status),
  index('idx_auto_sync_plans_expires_at').on(table.expiresAt),
  index('idx_auto_sync_plans_user_status').on(table.userId, table.status)
])

// 分享转存自动同步执行记录表
export const autoSyncRuns = sqliteTable('auto_sync_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  planId: integer('plan_id').notNull().references(() => autoSyncPlans.id),
  userId: integer('user_id').notNull().references(() => users.id),
  triggerType: text('trigger_type', { enum: ['startup', 'manual', 'created'] }).notNull(),
  status: text('status', { enum: ['running', 'completed', 'partial_failed', 'failed', 'skipped'] }).notNull().default('running'),
  alistPath: text('alist_path'),
  remoteFileCount: integer('remote_file_count').notNull().default(0),
  localFileCount: integer('local_file_count').notNull().default(0),
  missingFileCount: integer('missing_file_count').notNull().default(0),
  queuedDownloadCount: integer('queued_download_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  finishedAt: integer('finished_at', { mode: 'timestamp' })
}, (table) => [
  index('idx_auto_sync_runs_plan_id').on(table.planId),
  index('idx_auto_sync_runs_user_id').on(table.userId),
  index('idx_auto_sync_runs_status').on(table.status),
  index('idx_auto_sync_runs_started_at').on(table.startedAt)
])

// 自动同步远程文件快照表：记录"我们什么时候第一次看到这个文件"
export const autoSyncRemoteSnapshots = sqliteTable('auto_sync_remote_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  planId: integer('plan_id').notNull().references(() => autoSyncPlans.id),
  relativePath: text('relative_path').notNull(),
  fileSize: integer('file_size').notNull(),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull(),
  lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp' }).notNull()
}, (table) => [
  index('idx_auto_sync_snap_plan').on(table.planId),
  uniqueIndex('idx_auto_sync_snap_plan_path').on(table.planId, table.relativePath)
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
export type AutoSyncPlan = typeof autoSyncPlans.$inferSelect
export type NewAutoSyncPlan = typeof autoSyncPlans.$inferInsert
export type AutoSyncRun = typeof autoSyncRuns.$inferSelect
export type NewAutoSyncRun = typeof autoSyncRuns.$inferInsert
export type AutoSyncRemoteSnapshot = typeof autoSyncRemoteSnapshots.$inferSelect
export type NewAutoSyncRemoteSnapshot = typeof autoSyncRemoteSnapshots.$inferInsert
