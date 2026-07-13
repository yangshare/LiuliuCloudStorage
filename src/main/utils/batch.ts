import { SQLITE_BATCH_SIZE } from '../database/constants'

/**
 * 将数组分批处理，避免超出 SQLite 参数限制。
 *
 * @param items - 待处理的数组
 * @param fn - 每批次的处理函数（同步或异步均可）
 * @param batchSize - 批次大小，默认 SQLITE_BATCH_SIZE
 */
export async function processInBatches<T>(
  items: T[],
  fn: (batch: T[]) => void | Promise<void>,
  batchSize: number = SQLITE_BATCH_SIZE
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await fn(batch)
  }
}
