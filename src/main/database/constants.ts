/**
 * SQLite 批量操作的安全参数预算。
 *
 * 当前运行环境 MAX_VARIABLE_NUMBER 为 999，保守取 900 作为动态列表
 * 的参数预算，并为固定条件参数、时间戳等额外绑定值留出余量。
 *
 * 注意：多列 INSERT 需要按「每行参数数」折算行数，不能直接把该值
 * 当作插入行数使用。
 */
export const SQLITE_BATCH_SIZE = 900

/**
 * 多列 INSERT 的单批最大行数。
 *
 * SQLITE_BATCH_SIZE (900) 是按单列动态列表（如 inArray）设计的参数预算，
 * 不能直接当作插入行数使用。批量 INSERT 必须按「每行参数数」折算：
 * 运行环境 MAX_VARIABLE_NUMBER 为 999，transferQueue 单行约 9 列，
 * ⌊999 / 9⌋ = 111，保守取 100 行/批（900 参数，为固定绑定值留余量）。
 *
 * 超过此值单批插入会触发 "too many SQL variables"；
 * 一次性插入超大数组还会导致 Drizzle mergeQueries 递归爆栈。
 */
export const SQLITE_INSERT_BATCH_ROWS = 100
