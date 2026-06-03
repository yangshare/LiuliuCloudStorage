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
