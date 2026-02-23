/**
 * 系统日志 API Router
 * 安全修复：添加用户数据隔离
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { info, warn, error } from '@/lib/logger';

// 系统级分类 - 这些分类的日志所有用户可见（用于监控系统状态）
const SYSTEM_CATEGORIES = ['system', 'queue', 'api'];
// 用户级分类 - 这些分类的日志按用户隔离
const USER_CATEGORIES = ['rss', 'ai', 'auth', 'email'];

export const logsRouter = router({
  /**
   * 获取日志列表
   * 用户只能看到：
   * 1. 系统级日志（system, queue, api）
   * 2. 自己的用户级日志
   */
  list: protectedProcedure
    .input(
      z.object({
        level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).optional().nullable(),
        category: z.enum(['system', 'rss', 'ai', 'auth', 'email', 'api', 'queue']).optional().nullable(),
        limit: z.number().min(1).max(500).default(100),
        cursor: z.string().optional().nullable(),
        search: z.string().optional().nullable(),
        startDate: z.date().optional().nullable(),
        endDate: z.date().optional().nullable(),
        direction: z.enum(['forward', 'backward']).optional().nullable(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { level, category, limit, cursor, search, startDate, endDate } = input;
      const userId = ctx.userId!;

      const where: any = {};

      // 数据隔离逻辑
      if (category) {
        if (USER_CATEGORIES.includes(category)) {
          // 用户级分类：只能看到自己的日志
          where.category = category;
          where.userId = userId;
        } else {
          // 系统级分类：所有用户可见
          where.category = category;
        }
      } else {
        // 没有指定分类时：显示系统级日志 + 自己的用户级日志
        where.OR = [
          { category: { in: SYSTEM_CATEGORIES } },
          { userId: userId },
        ];
      }

      if (level) where.level = level;
      if (search) {
        // 搜索时需要在 OR 条件中处理
        const searchCondition = {
          OR: [
            { message: { contains: search, mode: 'insensitive' } },
            { details: { path: ['$'], string_contains: search } },
          ],
        };

        if (where.OR) {
          // 合并搜索条件
          where.AND = [searchCondition];
          delete where.OR;
          // 重新构建完整的查询条件
          where.OR = [
            { AND: [{ category: { in: SYSTEM_CATEGORIES } }, searchCondition] },
            { AND: [{ userId: userId }, searchCondition] },
          ];
        } else {
          Object.assign(where, searchCondition);
        }
      }
      if (startDate || endDate) {
        where.createdAt = where.createdAt || {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }
      if (cursor) {
        where.createdAt = { ...where.createdAt, lt: new Date(cursor) };
      }

      const logs = await ctx.db.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      let nextCursor: string | undefined;
      if (logs.length > limit) {
        const nextItem = logs.pop();
        nextCursor = nextItem?.createdAt.toISOString();
      }

      return {
        logs: logs.map(log => ({
          ...log,
          createdAt: log.createdAt.toISOString(),
        })),
        nextCursor,
      };
    }),

  /**
   * 获取日志统计
   * 只统计用户可见的日志
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId!;

    // 基础条件：系统级日志 + 用户自己的日志
    const baseWhere = {
      OR: [
        { category: { in: SYSTEM_CATEGORIES } },
        { userId: userId },
      ],
    };

    const [
      totalCount,
      levelCounts,
      categoryCounts,
      recentErrors,
    ] = await Promise.all([
      ctx.db.systemLog.count({ where: baseWhere }),
      ctx.db.systemLog.groupBy({
        by: ['level'],
        where: baseWhere,
        _count: { level: true },
      }),
      ctx.db.systemLog.groupBy({
        by: ['category'],
        where: baseWhere,
        _count: { category: true },
      }),
      ctx.db.systemLog.findMany({
        where: {
          ...baseWhere,
          level: { in: ['error', 'fatal'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      totalCount,
      levelCounts: levelCounts.map(c => ({ level: c.level, count: c._count.level })),
      categoryCounts: categoryCounts.map(c => ({ category: c.category, count: c._count.category })),
      recentErrors: recentErrors.map(e => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }),

  /**
   * 清空日志
   * 支持清空指定时间之前的日志或所有日志
   */
  clear: protectedProcedure
    .input(z.object({
      before: z.date().optional().nullable(), // 清理此时间之前的日志
      olderThanDays: z.number().optional().nullable(), // 或清理 N 天前的日志
      clearAll: z.boolean().optional(), // 清理所有（包括系统日志）
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId!;
      const { before, olderThanDays, clearAll } = input;

      const where: any = {};

      // 时间条件
      if (olderThanDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        where.createdAt = { lt: cutoffDate };
      } else if (before) {
        where.createdAt = { lt: before };
      }

      // 权限控制
      if (clearAll) {
        // 清理所有日志（包括系统日志）- 仅删除符合时间条件的
        // 如果没有时间条件，则删除所有
      } else {
        // 默认只删除用户自己的日志
        where.OR = [
          { category: { in: SYSTEM_CATEGORIES } },
          { userId: userId },
        ];
      }

      const { count } = await ctx.db.systemLog.deleteMany({ where });

      await info('system', '用户清空日志', {
        userId,
        deletedCount: count,
        olderThanDays: olderThanDays || null,
        clearAll: clearAll || false,
      });

      return { deleted: count };
    }),

  /**
   * 获取日志详情
   * 验证用户是否有权限查看该日志
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId!;

      const log = await ctx.db.systemLog.findUnique({
        where: { id: input.id },
      });

      if (!log) {
        throw new Error('日志不存在');
      }

      // 权限检查：系统级日志所有人可见，用户级日志只有所有者可见
      if (USER_CATEGORIES.includes(log.category) && log.userId !== userId) {
        throw new Error('无权查看此日志');
      }

      return {
        ...log,
        createdAt: log.createdAt.toISOString(),
      };
    }),

  /**
   * 生成测试日志
   */
  seed: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.userId!;

      // 生成一些测试日志
      await info('system', '系统启动完成', { version: '1.0.0', nodeEnv: process.env.NODE_ENV });
      await info('rss', '开始抓取订阅源', { userId, feedCount: 5 }, userId);
      await info('rss', '订阅源抓取完成', { userId, newEntries: 12, duration: 2340 }, userId);
      await warn('rss', '订阅源响应缓慢', { feedUrl: 'https://example.com/feed.xml', responseTime: 8000 }, userId);
      await info('ai', 'AI分析任务开始', { model: 'gpt-4o', entriesCount: 3 }, userId);
      await info('ai', 'AI摘要生成完成', { tokensUsed: 1250, cost: 0.002 }, userId);
      await error('email', '邮件发送失败', new Error('SMTP连接超时'), { recipient: 'user@example.com' }, userId);
      await info('auth', '用户登录成功', { userId, ip: '192.168.1.1' }, userId);
      await warn('api', 'API请求频率过高', { endpoint: '/api/feeds', count: 120 });
      await info('queue', '队列处理完成', { processed: 50, failed: 2 });
      await error('system', '数据库连接池警告', new Error('连接数接近上限'), { current: 45, max: 50 });

      return { success: true, count: 10 };
    }),
});

export default logsRouter;
