/**
 * 数据库客户端（优化版）
 * 使用单例模式确保只有一个 Prisma 客户端实例
 *
 * 优化点：
 * 1. 连接池配置
 * 2. 日志优化
 * 3. 连接复用
 */

import { PrismaClient } from '@prisma/client';

// 全局 Prisma 客户端类型定义
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * 数据库连接参数配置
 * 通过环境变量 DATABASE_URL 配置连接池
 *
 * 推荐的 DATABASE_URL 格式：
 * postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20&connect_timeout=5
 *
 * 参数说明：
 * - connection_limit: 连接池最大连接数（默认 10，推荐 5-20）
 * - pool_timeout: 获取连接超时时间（秒，默认 20）
 * - connect_timeout: 连接建立超时时间（秒，默认 5）
 * - pgbouncer: 使用 PgBouncer 时设置为 true
 */

// 日志配置
const logConfig = process.env.NODE_ENV === 'development'
  ? [
      { emit: 'event' as const, level: 'query' as const },
      { emit: 'stdout' as const, level: 'error' as const },
      { emit: 'stdout' as const, level: 'warn' as const },
    ]
  : [
      { emit: 'stdout' as const, level: 'error' as const },
    ];

// 创建 Prisma 客户端
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: logConfig,
    // 错误格式化（开发环境）
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  });
}

// 导出数据库客户端（单例模式）
export const db = globalForPrisma.prisma ?? createPrismaClient();

// 开发环境下保存到全局变量，避免热重载时创建多个连接
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// 优雅关闭连接
if (process.env.NODE_ENV === 'production') {
  // 监听进程退出事件
  process.on('beforeExit', async () => {
    await db.$disconnect();
  });

  process.on('SIGINT', async () => {
    await db.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await db.$disconnect();
    process.exit(0);
  });
}

export default db;

// ========== 工具函数 ==========

/**
 * 健康检查
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * 获取连接池状态（仅用于监控）
 */
export async function getPoolStatus(): Promise<{
  active: number;
  idle: number;
  waiting: number;
}> {
  try {
    const result = await db.$queryRaw<Array<{
      state: string;
      count: bigint;
    }>>`
      SELECT state, COUNT(*) as count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
      GROUP BY state
    `;

    const status = { active: 0, idle: 0, waiting: 0 };
    for (const row of result) {
      if (row.state === 'active') status.active = Number(row.count);
      if (row.state === 'idle') status.idle = Number(row.count);
      if (row.state === 'idle in transaction') status.waiting = Number(row.count);
    }

    return status;
  } catch {
    return { active: 0, idle: 0, waiting: 0 };
  }
}
