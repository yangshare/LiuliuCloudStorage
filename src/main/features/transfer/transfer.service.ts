import { eq, desc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getDatabase } from '../../database'
import { transferQueue } from '../../database/schema'
import { handleIPC } from '../../core/ipc/error-handler'
import type { TransferTask, TransferStatus, TransferListResult } from '../../../shared/types/transfer'

export class TransferService {
  private get db() { return drizzle(getDatabase()) }

  async getTasksByUser(userId: number): Promise<TransferListResult> {
    return handleIPC(async () => {
      const rows = await this.db.select().from(transferQueue).where(eq(transferQueue.userId, userId)).orderBy(desc(transferQueue.createdAt)).all()
      return rows.map(r => ({
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
      }))
    })
  }

  // TODO: 迁移更多业务逻辑（上传、下载、队列管理等）
}

export const transferService = new TransferService()
