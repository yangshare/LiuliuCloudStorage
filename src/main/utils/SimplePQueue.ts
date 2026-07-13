/**
 * 极简并发队列：支持指定并发数、动态追加任务、等待全部完成。
 * 单个任务失败不影响队列继续执行，适用于目录树递归扫描等场景。
 */
export class SimplePQueue {
  private concurrency: number
  private tasks: Array<() => Promise<void>> = []
  private runningCount = 0
  private idleResolvers: Array<() => void> = []

  constructor(options: { concurrency: number }) {
    this.concurrency = options.concurrency
  }

  add(fn: () => Promise<void>): void {
    this.tasks.push(fn)
    this.runNext()
  }

  private runNext(): void {
    while (this.runningCount < this.concurrency && this.tasks.length > 0) {
      this.runningCount++
      const task = this.tasks.shift()!
      task().catch(() => {
        // 单个任务失败不影响队列继续执行
      }).finally(() => {
        this.runningCount--
        this.runNext()
        this.checkIdle()
      })
    }
  }

  private checkIdle(): void {
    if (this.runningCount === 0 && this.tasks.length === 0) {
      const resolvers = this.idleResolvers.splice(0)
      for (const resolve of resolvers) {
        resolve()
      }
    }
  }

  onIdle(): Promise<void> {
    return new Promise(resolve => {
      if (this.runningCount === 0 && this.tasks.length === 0) {
        resolve()
      } else {
        this.idleResolvers.push(resolve)
      }
    })
  }
}
