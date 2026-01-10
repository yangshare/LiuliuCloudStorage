import { getDatabase } from '../database'
import { transferQueue, type TransferQueue, type NewTransferQueue } from '../database/schema'
import { eq, and, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

export class TransferService {
  private get db() {
    return drizzle(getDatabase())
  }

  async create(task: NewTransferQueue): Promise<TransferQueue> {
    const result = this.db.insert(transferQueue).values(task).returning().get()
    return result
  }

  async updateStatus(taskId: number, status: string): Promise<void> {
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
}
