import { eq, desc, and, or, inArray, count } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getDatabase } from '../../database'
import { transferQueue, type NewTransferQueue, type TransferQueue } from '../../database/schema'
import { handleIPC } from '../../core/ipc/error-handler'
import type { TransferTask, TransferStatus, TransferListResult } from '../../../shared/types/transfer'

export class TransferService {
  private get db() { return drizzle(getDatabase()) }

  // ========== 基础查询 ==========

  async getTasksByUser(userId: number): Promise<TransferListResult> {
    return handleIPC(async () => {
      const rows = await this.db.select().from(transferQueue).where(eq(transferQueue.userId, userId)).orderBy(desc(transferQueue.createdAt)).all()
      return rows.map(r => this.toTransferTask(r))
    })
  }

  async getTask(taskId: number): Promise<TransferQueue | undefined> {
    return this.db.select().from(transferQueue).where(eq(transferQueue.id, taskId)).get()
  }

  async getTaskById(taskId: number): Promise<TransferQueue | undefined> {
    return this.getTask(taskId)
  }

  // ========== 创建 ==========

  async create(task: NewTransferQueue): Promise<TransferQueue> {
    const result = this.db.insert(transferQueue).values(task).returning().get()
    return result
  }

  async createBatch(tasks: NewTransferQueue[]): Promise<TransferQueue[]> {
    return this.db.insert(transferQueue).values(tasks).returning().all()
  }

  // ========== 更新 ==========

  async updateStatus(taskId: number, status: TransferQueue['status']): Promise<void> {
    this.db.update(transferQueue)
      .set({ status, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateProgress(taskId: number, transferredSize: number): Promise<void> {
    this.db.update(transferQueue)
      .set({ transferredSize, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateFileSize(taskId: number, fileSize: number): Promise<void> {
    this.db.update(transferQueue)
      .set({ fileSize, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateFilePath(taskId: number, filePath: string): Promise<void> {
    this.db.update(transferQueue)
      .set({ filePath, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async markAsFailed(taskId: number, errorMessage: string, transferredSize: number): Promise<void> {
    this.db.update(transferQueue)
      .set({
        status: 'failed',
        errorMessage,
        transferredSize,
        resumable: true,
        updatedAt: new Date()
      })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async resumeTask(taskId: number): Promise<void> {
    this.db.update(transferQueue)
      .set({
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  // ========== 取消 ==========

  async cancelTask(taskId: number): Promise<void> {
    this.db.update(transferQueue)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async cancelTasks(taskIds: number[]): Promise<void> {
    if (taskIds.length === 0) return
    this.db.update(transferQueue)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(inArray(transferQueue.id, taskIds))
      .run()
  }

  async cancelAllUserTasks(userId: number, taskType: 'upload' | 'download'): Promise<void> {
    this.db.update(transferQueue)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, taskType),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .run()
  }

  async cancelAllIncompleteDownloads(): Promise<void> {
    this.db.update(transferQueue)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(transferQueue.taskType, 'download'),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .run()
  }

  // ========== 删除 ==========

  async deleteTask(taskId: number): Promise<void> {
    this.db.delete(transferQueue)
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async deleteCompletedDownloads(): Promise<void> {
    this.db.delete(transferQueue)
      .where(and(
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'completed')
      ))
      .run()
  }

  async deleteFailedDownloads(): Promise<void> {
    this.db.delete(transferQueue)
      .where(and(
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'failed')
      ))
      .run()
  }

  // ========== 恢复相关 ==========

  async getRecoverableTasks(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, 'upload'),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .all()
  }

  async getResumableTasks(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.status, 'failed'),
        eq(transferQueue.resumable, true)
      ))
      .all()
  }

  // ========== 下载队列查询 ==========

  async getPendingDownloads(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'pending')
      ))
      .all()
  }

  async getActiveDownloads(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'in_progress')
      ))
      .all()
  }

  async getIncompleteDownloads(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, 'download'),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .all()
  }

  // ========== 路径查询 ==========

  async getTaskByRemotePath(remotePath: string, taskType: 'upload' | 'download'): Promise<TransferQueue | undefined> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.remotePath, remotePath),
        eq(transferQueue.taskType, taskType),
        or(
          eq(transferQueue.status, 'pending'),
          eq(transferQueue.status, 'in_progress')
        )
      ))
      .get()
  }

  async getTasksByRemotePaths(remotePaths: string[], taskType: 'upload' | 'download'): Promise<Map<string, TransferQueue>> {
    if (remotePaths.length === 0) {
      return new Map()
    }

    const tasks = this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.taskType, taskType),
        inArray(transferQueue.remotePath, remotePaths)
      ))
      .all()

    const taskMap = new Map<string, TransferQueue>()
    for (const task of tasks) {
      taskMap.set(task.remotePath, task)
    }

    return taskMap
  }

  // ========== 统计 ==========

  async getTaskCount(userId: number, taskType: 'download' | 'upload', status: TransferQueue['status']): Promise<number> {
    const result = this.db.select({ value: count() })
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, taskType),
        eq(transferQueue.status, status)
      ))
      .get()

    return result?.value ?? 0
  }

  async getDownloadCount(userId: number, status?: TransferQueue['status']): Promise<number> {
    const conditions: ReturnType<typeof eq>[] = [
      eq(transferQueue.userId, userId),
      eq(transferQueue.taskType, 'download')
    ]

    if (status) {
      conditions.push(eq(transferQueue.status, status))
    }

    const result = this.db.select({ count: transferQueue.id })
      .from(transferQueue)
      .where(and(...conditions))
      .all()

    return result.length
  }

  // ========== 最近任务 ==========

  async getRecentCompletedTasks(userId: number, taskType: 'download' | 'upload', limit?: number): Promise<TransferQueue[]> {
    let query = this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, taskType),
        eq(transferQueue.status, 'completed')
      ))
      .orderBy(desc(transferQueue.updatedAt))
    if (limit !== undefined) {
      query = query.limit(limit)
    }
    return query.all()
  }

  async getRecentFailedTasks(userId: number, taskType: 'download' | 'upload', limit?: number): Promise<TransferQueue[]> {
    let query = this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.taskType, taskType),
        eq(transferQueue.status, 'failed')
      ))
      .orderBy(desc(transferQueue.updatedAt))
    if (limit !== undefined) {
      query = query.limit(limit)
    }
    return query.all()
  }

  // ========== 工具方法 ==========

  private toTransferTask(r: TransferQueue): TransferTask {
    return {
      id: r.id,
      filePath: r.filePath,
      remotePath: r.remotePath,
      fileName: r.fileName,
      fileSize: r.fileSize || 0,
      transferredSize: r.transferredSize || 0,
      status: r.status as TransferStatus,
      userId: r.userId,
      taskType: r.taskType,
      createdAt: r.createdAt?.toISOString() || new Date().toISOString()
    }
  }
}

export const transferService = new TransferService()
