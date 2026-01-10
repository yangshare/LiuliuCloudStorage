import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

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

// 类型导出
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type FileCache = typeof fileCache.$inferSelect
export type NewFileCache = typeof fileCache.$inferInsert
export type TransferQueue = typeof transferQueue.$inferSelect
export type NewTransferQueue = typeof transferQueue.$inferInsert
