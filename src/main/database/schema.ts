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
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
  index('idx_sessions_user_id').on(table.userId),
  index('idx_sessions_token').on(table.tokenEncrypted)
])

// 类型导出
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
