import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TransferService } from '../../../src/main/services/TransferService'
import { initDatabase, closeDatabase } from '../../../src/main/database'
import type { NewTransferQueue } from '../../../src/main/database/schema'

describe('TransferService', () => {
  let service: TransferService

  beforeEach(() => {
    initDatabase()
    service = new TransferService()
  })

  afterEach(() => {
    closeDatabase()
  })

  it('should create a new transfer task', async () => {
    const task: NewTransferQueue = {
      userId: 1,
      taskType: 'upload',
      fileName: 'test.txt',
      filePath: '/local/test.txt',
      remotePath: '/remote/test.txt',
      fileSize: 1024,
      transferredSize: 0,
      status: 'pending'
    }

    const created = await service.create(task)
    expect(created.id).toBeDefined()
    expect(created.fileName).toBe('test.txt')
    expect(created.status).toBe('pending')
  })

  it('should update task status', async () => {
    const task: NewTransferQueue = {
      userId: 1,
      taskType: 'upload',
      fileName: 'test.txt',
      filePath: '/local/test.txt',
      remotePath: '/remote/test.txt',
      fileSize: 1024
    }

    const created = await service.create(task)
    await service.updateStatus(created.id, 'in_progress')

    const updated = await service.getTask(created.id)
    expect(updated?.status).toBe('in_progress')
  })

  it('should get pending tasks for user', async () => {
    await service.create({
      userId: 1,
      taskType: 'upload',
      fileName: 'test1.txt',
      filePath: '/local/test1.txt',
      remotePath: '/remote/test1.txt',
      fileSize: 1024,
      status: 'pending'
    })

    await service.create({
      userId: 1,
      taskType: 'upload',
      fileName: 'test2.txt',
      filePath: '/local/test2.txt',
      remotePath: '/remote/test2.txt',
      fileSize: 2048,
      status: 'completed'
    })

    const pending = await service.getPendingTasks(1)
    expect(pending).toHaveLength(1)
    expect(pending[0].fileName).toBe('test1.txt')
  })

  it('should mark task as failed with resumable flag', async () => {
    const task = await service.create({
      userId: 1,
      taskType: 'upload',
      fileName: 'test.txt',
      filePath: '/local/test.txt',
      remotePath: '/remote/test.txt',
      fileSize: 1024
    })

    await service.markAsFailed(task.id, 'Network error', 512)

    const failed = await service.getTask(task.id)
    expect(failed?.status).toBe('failed')
    expect(failed?.errorMessage).toBe('Network error')
    expect(failed?.transferredSize).toBe(512)
    expect(failed?.resumable).toBe(true)
  })

  it('should get resumable tasks', async () => {
    const task = await service.create({
      userId: 1,
      taskType: 'upload',
      fileName: 'test.txt',
      filePath: '/local/test.txt',
      remotePath: '/remote/test.txt',
      fileSize: 1024
    })

    await service.markAsFailed(task.id, 'Network error', 512)

    const resumable = await service.getResumableTasks(1)
    expect(resumable).toHaveLength(1)
    expect(resumable[0].resumable).toBe(true)
  })
})
