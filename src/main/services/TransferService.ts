import { getDatabase, isDatabaseOpen } from '../database'
import { transferQueue, type TransferQueue, type NewTransferQueue } from '../database/schema'
import { eq, and, or, inArray, desc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

export class TransferService {
  private get db() {
    return drizzle(getDatabase())
  }

  async create(task: NewTransferQueue): Promise<TransferQueue> {
    const result = this.db.insert(transferQueue).values(task).returning().get()
    return result
  }

  async createBatch(tasks: NewTransferQueue[]): Promise<TransferQueue[]> {
    return this.db.insert(transferQueue).values(tasks).returning().all()
  }

  async updateStatus(taskId: number, status: string): Promise<void> {
    this.db.update(transferQueue)
      .set({ status, updatedAt: new Date() })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  async updateProgress(taskId: number, transferredSize: number): Promise<void> {
    if (!isDatabaseOpen()) return
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

  async getTask(taskId: number): Promise<TransferQueue | undefined> {
    return this.db.select().from(transferQueue).where(eq(transferQueue.id, taskId)).get()
  }

  async getPendingTasks(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.userId, userId),
        eq(transferQueue.status, 'pending')
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

  async getAllTasks(userId: number): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(eq(transferQueue.userId, userId))
      .all()
  }

  // 恢复任务（将 failed 状态改为 in_progress）
  async resumeTask(taskId: number): Promise<void> {
    this.db.update(transferQueue)
      .set({
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  // ========== 下载队列查询方法 ==========

  /**
   * 获取等待中的下载任务
   */
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

  /**
   * 获取进行中的下载任务
   */
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

  /**
   * 统计下载数量
   */
  async getDownloadCount(userId: number, status?: string): Promise<number> {
    const conditions = [
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

  /**
   * 根据远程路径获取未完成的任务（pending 或 in_progress）
   */
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

  /**
   * 获取所有未完成的下载任务（用于应用重启恢复）
   */
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

  /**
   * 根据任务 ID 获取任务
   */
  async getTaskById(taskId: number): Promise<TransferQueue | undefined> {
    return this.db.select()
      .from(transferQueue)
      .where(eq(transferQueue.id, taskId))
      .get()
  }

  /**
   * 取消任务（标记为已取消）
   */
  async cancelTask(taskId: number): Promise<void> {
    this.db.update(transferQueue)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
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

  /**
   * 删除任务（从数据库移除）
   */
  async deleteTask(taskId: number): Promise<void> {
    this.db.delete(transferQueue)
      .where(eq(transferQueue.id, taskId))
      .run()
  }

  /**
   * 批量获取任务状态（用于队列管理优化）
   * @param remotePaths 远程路径数组
   * @param taskType 任务类型
   * @returns Map<remotePath, TransferQueue>
   */
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

    // 转换为 Map 以便快速查找
    const taskMap = new Map<string, TransferQueue>()
    for (const task of tasks) {
      taskMap.set(task.remotePath, task)
    }

    return taskMap
  }

  /**
   * 取消所有未完成的下载任务（包括数据库中残留的）
   */
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

  /**
   * 批量取消用户的所有任务
   */
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

  /**
   * 删除已完成的下载任务记录
   */
  async deleteCompletedDownloads(): Promise<void> {
    this.db.delete(transferQueue)
      .where(and(
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'completed')
      ))
      .run()
  }

  /**
   * 删除已失败的下载任务记录
   */
  async deleteFailedDownloads(): Promise<void> {
    this.db.delete(transferQueue)
      .where(and(
        eq(transferQueue.taskType, 'download'),
        eq(transferQueue.status, 'failed')
      ))
      .run()
  }

  /**
   * 获取最近完成的下载/上传任务
   */
  async getRecentCompletedTasks(taskType: 'download' | 'upload', limit: number = 100): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.taskType, taskType),
        eq(transferQueue.status, 'completed')
      ))
      .orderBy(desc(transferQueue.updatedAt))
      .limit(limit)
      .all()
  }

  /**
   * 获取最近失败的下载/上传任务
   */
  async getRecentFailedTasks(taskType: 'download' | 'upload', limit: number = 100): Promise<TransferQueue[]> {
    return this.db.select()
      .from(transferQueue)
      .where(and(
        eq(transferQueue.taskType, taskType),
        eq(transferQueue.status, 'failed')
      ))
      .orderBy(desc(transferQueue.updatedAt))
      .limit(limit)
      .all()
  }
}
