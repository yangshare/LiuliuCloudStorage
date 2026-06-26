import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TransferService } from '../../../src/main/features/transfer/transfer.service'
import type { NewTransferQueue, TransferQueue } from '../../../src/main/database/schema'

const { tasks, fakeDb } = vi.hoisted(() => {
  let nextId = 1
  const tasks: TransferQueue[] = []

  function columnToProperty(field: string): string {
    return field.replace(/_([a-z])/g, (_, char) => char.toUpperCase())
  }

  function matches(task: any, condition: any): boolean {
    if (!condition) return true
    if (condition.type === 'eq') {
      return task[columnToProperty(condition.field)] === condition.value
    }
    if (condition.type === 'and') {
      return condition.conditions.every((item: any) => matches(task, item))
    }
    if (condition.type === 'or') {
      return condition.conditions.some((item: any) => matches(task, item))
    }
    if (condition.type === 'inArray') {
      return condition.values.includes(task[columnToProperty(condition.field)])
    }
    return true
  }

  function query(condition?: any) {
    const api: any = {
      where(nextCondition: any) {
        return query(nextCondition)
      },
      orderBy() {
        return api
      },
      limit(count: number) {
        return {
          all: () => tasks.filter((task) => matches(task, condition)).slice(0, count)
        }
      },
      get: () => tasks.find((task) => matches(task, condition)),
      all: () => tasks.filter((task) => matches(task, condition))
    }
    return api
  }

  const fakeDb = {
    insert: vi.fn(() => ({
      values(value: NewTransferQueue | NewTransferQueue[]) {
        const values = Array.isArray(value) ? value : [value]
        const inserted = values.map((item) => {
          const row = {
            status: 'pending',
            transferredSize: 0,
            resumable: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...item,
            id: nextId++
          } as TransferQueue
          tasks.push(row)
          return row
        })
        return {
          returning: () => ({
            get: () => inserted[0],
            all: () => inserted
          })
        }
      }
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => query())
    })),
    update: vi.fn(() => ({
      set(data: Partial<TransferQueue>) {
        return {
          where(condition: any) {
            return {
              run() {
                for (const task of tasks) {
                  if (matches(task, condition)) {
                    Object.assign(task, data)
                  }
                }
              }
            }
          }
        }
      }
    })),
    delete: vi.fn(() => ({
      where(condition: any) {
        return {
          run() {
            for (let index = tasks.length - 1; index >= 0; index--) {
              if (matches(tasks[index], condition)) {
                tasks.splice(index, 1)
              }
            }
          }
        }
      }
    })),
    transaction: vi.fn((fn: () => void) => () => fn())
  }

  return {
    tasks,
    fakeDb
  }
})

vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: vi.fn(() => fakeDb)
}))

vi.mock('../../../src/main/core/logger/logger.service', () => ({
  loggerService: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ type: 'eq', field: field?.name || field?.config?.name, value })),
  desc: vi.fn((field) => field),
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  or: vi.fn((...conditions) => ({ type: 'or', conditions })),
  inArray: vi.fn((field, values) => ({ type: 'inArray', field: field?.name || field?.config?.name, values })),
  count: vi.fn(() => ({ type: 'count' }))
}))

vi.mock('../../../src/main/database', () => ({
  getDatabase: vi.fn(() => fakeDb)
}))

describe('TransferService', () => {
  let service: TransferService

  beforeEach(() => {
    tasks.splice(0, tasks.length)
    vi.clearAllMocks()
    service = new TransferService()
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

  it('should get pending downloads for user', async () => {
    await service.create({
      userId: 1,
      taskType: 'download',
      fileName: 'test1.txt',
      filePath: '/local/test1.txt',
      remotePath: '/remote/test1.txt',
      fileSize: 1024,
      status: 'pending'
    })

    await service.create({
      userId: 1,
      taskType: 'download',
      fileName: 'test2.txt',
      filePath: '/local/test2.txt',
      remotePath: '/remote/test2.txt',
      fileSize: 2048,
      status: 'completed'
    })

    const pending = await service.getPendingDownloads(1)
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

  it('should cancel large task id lists in batches', async () => {
    const createdTasks: TransferQueue[] = []
    // 使用 1801 条数据确保 SQLITE_BATCH_SIZE=900 时产生 3 个批次
    for (let index = 0; index < 1801; index++) {
      const task = await service.create({
        userId: 1,
        taskType: 'download',
        fileName: `file-${index}.txt`,
        filePath: `/local/file-${index}.txt`,
        remotePath: `/remote/file-${index}.txt`,
        fileSize: 1024,
        status: 'pending'
      })
      createdTasks.push(task)
    }

    fakeDb.update.mockClear()
    await service.cancelTasks(createdTasks.map(task => task.id))

    expect(fakeDb.update).toHaveBeenCalledTimes(3)
    expect(createdTasks.every(task => task.status === 'cancelled')).toBe(true)
  })

  it('should query large remote path lists in batches', async () => {
    const remotePaths: string[] = []
    // 使用 1801 条数据确保 SQLITE_BATCH_SIZE=900 时产生 3 个批次
    for (let index = 0; index < 1801; index++) {
      const remotePath = `/remote/file-${index}.txt`
      remotePaths.push(remotePath)
      await service.create({
        userId: 1,
        taskType: 'download',
        fileName: `file-${index}.txt`,
        filePath: `/local/file-${index}.txt`,
        remotePath,
        fileSize: 1024,
        status: 'pending'
      })
    }
    await service.create({
      userId: 1,
      taskType: 'upload',
      fileName: 'upload-only.txt',
      filePath: '/local/upload-only.txt',
      remotePath: remotePaths[0],
      fileSize: 1024,
      status: 'pending'
    })

    fakeDb.select.mockClear()
    const taskMap = await service.getTasksByRemotePaths(remotePaths, 'download')

    expect(fakeDb.select).toHaveBeenCalledTimes(3)
    expect(taskMap).toHaveLength(1801)
    expect([...taskMap.values()].every(task => task.taskType === 'download')).toBe(true)
  })

  it('should batch large inserts to avoid SQLite variable limit', async () => {
    const records: NewTransferQueue[] = []
    // 使用 250 条数据确保 SQLITE_INSERT_BATCH_ROWS=100 时产生 3 个批次 (100 + 100 + 50)
    for (let index = 0; index < 250; index++) {
      records.push({
        userId: 1,
        taskType: 'download',
        fileName: `file-${index}.txt`,
        filePath: `/local/file-${index}.txt`,
        remotePath: `/remote/file-${index}.txt`,
        fileSize: 1024,
        status: 'pending'
      })
    }

    fakeDb.insert.mockClear()
    const inserted = await service.createBatch(records)

    // 修复核心：分 3 批插入，而非一次性传入超大数组（否则触发
    // Drizzle mergeQueries 递归爆栈 / "too many SQL variables"）
    expect(fakeDb.insert).toHaveBeenCalledTimes(3)
    expect(inserted).toHaveLength(250)
    // 返回顺序需与输入一致（addBatchToQueue 依赖 dbTasks[i] 对应 uniqueTasks[i]）
    expect(inserted[0].fileName).toBe('file-0.txt')
    expect(inserted[249].fileName).toBe('file-249.txt')
    // 事务包裹保证原子性
    expect(fakeDb.transaction).toHaveBeenCalled()
  })

  it('should skip insert entirely for empty createBatch input', async () => {
    const inserted = await service.createBatch([])
    expect(inserted).toHaveLength(0)
    expect(fakeDb.insert).not.toHaveBeenCalled()
  })
})
