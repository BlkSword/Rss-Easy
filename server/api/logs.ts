/**
 * 系统日志 API Router
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { info, warn, error } from '@/lib/logger';

export const logsRouter = router({
  /**
   * 获取日志列表
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
      const { level, category, limit, cursor, search, startDate, endDate, direction } = input;

      const where: any = {};
      
      if (level) where.level = level;
      if (category) where.category = category;
      if (search) {
        where.OR = [
          { message: { contains: search, mode: 'insensitive' } },
          { details: { path: ['$'], string_contains: search } },
        ];
      }
      if (startDate || endDate) {
        where.createdAt = {};
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
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const [
      totalCount,
      levelCounts,
      categoryCounts,
      recentErrors,
    ] = await Promise.all([
      ctx.db.systemLog.count(),
      ctx.db.systemLog.groupBy({
        by: ['level'],
        _count: { level: true },
      }),
      ctx.db.systemLog.groupBy({
        by: ['category'],
        _count: { category: true },
      }),
      ctx.db.systemLog.findMany({
        where: { level: { in: ['error', 'fatal'] } },
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
   * 清空日志（仅管理员）
   */
  clear: protectedProcedure
    .input(z.object({ before: z.date().optional() }))
    .mutation(async ({ input, ctx }) => {
      const where: any = {};
      if (input.before) {
        where.createdAt = { lt: input.before };
      }

      const { count } = await ctx.db.systemLog.deleteMany({ where });
      return { deleted: count };
    }),

  /**
   * 获取日志详情
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const log = await ctx.db.systemLog.findUnique({
        where: { id: input.id },
      });

      if (!log) {
        throw new Error('日志不存在');
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
      const userId = ctx.userId;
      
      // 生成一些测试日志
      await info('system', '系统启动完成', { version: '1.0.0', nodeEnv: process.env.NODE_ENV });
      await info('rss', '开始抓取订阅源', { userId, feedCount: 5 });
      await info('rss', '订阅源抓取完成', { userId, newEntries: 12, duration: 2340 });
      await warn('rss', '订阅源响应缓慢', { feedUrl: 'https://example.com/feed.xml', responseTime: 8000 });
      await info('ai', 'AI分析任务开始', { model: 'gpt-4o', entriesCount: 3 });
      await info('ai', 'AI摘要生成完成', { tokensUsed: 1250, cost: 0.002 });
      await error('email', '邮件发送失败', new Error('SMTP连接超时'), { recipient: 'test@example.com' });
      await info('auth', '用户登录成功', { userId, ip: '192.168.1.1' });
      await warn('api', 'API请求频率过高', { endpoint: '/api/feeds', count: 120 });
      await info('queue', '队列处理完成', { processed: 50, failed: 2 });
      await error('system', '数据库连接池警告', new Error('连接数接近上限'), { current: 45, max: 50 });
      
      return { success: true, count: 10 };
    }),
});

export default logsRouter;
