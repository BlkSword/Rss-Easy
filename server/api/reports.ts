/**
 * Reports API Router
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { getReportGenerator } from '@/lib/reports/generator';
import { asyncReportGenerator } from '@/lib/reports/async-generator';
import { checkAIConfig, getUserAIConfig } from '@/lib/ai/health-check';
import { info, warn, error } from '@/lib/logger';

export const reportsRouter = router({
  /**
   * 检查AI配置
   */
  checkAIConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const aiConfig = await getUserAIConfig(ctx.userId, ctx.db);
      const result = await checkAIConfig(aiConfig);
      return result;
    }),

  /**
   * 启动异步生成日报
   */
  startGenerateDaily: protectedProcedure
    .input(
      z.object({
        reportDate: z.date().default(() => new Date()),
        aiGenerated: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await info('system', '用户请求生成日报', {
        userId: ctx.userId,
        reportDate: input.reportDate.toISOString(),
        aiGenerated: input.aiGenerated
      });

      const result = await asyncReportGenerator.startGeneration(
        ctx.userId,
        'daily',
        input.reportDate,
        input.aiGenerated
      );

      if (!result.success) {
        await error('system', '日报生成启动失败', undefined, {
          userId: ctx.userId,
          error: result.error
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || '启动生成失败',
        });
      }

      await info('system', '日报生成启动成功', {
        userId: ctx.userId,
        reportId: result.report?.id
      });

      return result.report;
    }),

  /**
   * 启动异步生成周报
   */
  startGenerateWeekly: protectedProcedure
    .input(
      z.object({
        reportDate: z.date().default(() => new Date()),
        aiGenerated: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await info('system', '用户请求生成周报', {
        userId: ctx.userId,
        reportDate: input.reportDate.toISOString(),
        aiGenerated: input.aiGenerated
      });

      const result = await asyncReportGenerator.startGeneration(
        ctx.userId,
        'weekly',
        input.reportDate,
        input.aiGenerated
      );

      if (!result.success) {
        await error('system', '周报生成启动失败', undefined, {
          userId: ctx.userId,
          error: result.error
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || '启动生成失败',
        });
      }

      await info('system', '周报生成启动成功', {
        userId: ctx.userId,
        reportId: result.report?.id
      });

      return result.report;
    }),

  /**
   * 获取报告生成进度
   */
  getProgress: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const progress = await asyncReportGenerator.getProgress(input.id, ctx.userId);

      if (!progress) {
        await warn('system', '查询报告进度失败，报告不存在', {
          userId: ctx.userId,
          reportId: input.id
        });
        throw new TRPCError({ code: 'NOT_FOUND', message: '报告不存在' });
      }

      return progress;
    }),

  /**
   * 取消报告生成
   */
  cancelGeneration: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await info('system', '用户取消报告生成', {
        userId: ctx.userId,
        reportId: input.id
      });

      await asyncReportGenerator.cancelGeneration(input.id, ctx.userId);

      await info('system', '报告生成已取消', {
        userId: ctx.userId,
        reportId: input.id
      });

      return { success: true };
    }),

  /**
   * 生成日报（同步，兼容旧版）
   */
  generateDaily: protectedProcedure
    .input(
      z.object({
        reportDate: z.date().default(() => new Date()),
        aiGenerated: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const generator = getReportGenerator();
      const report = await generator.generateDailyReport(
        ctx.userId,
        input.reportDate,
        input.aiGenerated
      );
      return report;
    }),

  /**
   * 生成周报（同步，兼容旧版）
   */
  generateWeekly: protectedProcedure
    .input(
      z.object({
        reportDate: z.date().default(() => new Date()),
        aiGenerated: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const generator = getReportGenerator();
      const report = await generator.generateWeeklyReport(
        ctx.userId,
        input.reportDate,
        input.aiGenerated
      );
      return report;
    }),

  /**
   * 获取报告列表
   */
  list: protectedProcedure
    .input(
      z.object({
        reportType: z.enum(['daily', 'weekly']).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const { reportType, limit, offset } = input;

      const [reports, total] = await Promise.all([
        ctx.db.report.findMany({
          where: {
            userId: ctx.userId,
            ...(reportType && { reportType }),
          },
          include: {
            entries: {
              include: {
                entry: {
                  include: {
                    feed: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                rank: 'asc',
              },
              take: 10,
            },
          },
          orderBy: {
            reportDate: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        ctx.db.report.count({
          where: {
            userId: ctx.userId,
            ...(reportType && { reportType }),
          },
        }),
      ]);

      return {
        items: reports,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    }),

  /**
   * 获取单个报告
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const report = await ctx.db.report.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        include: {
          entries: {
            include: {
              entry: {
                include: {
                  feed: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              rank: 'asc',
            },
          },
        },
      });

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '报告不存在' });
      }

      return report;
    }),

  /**
   * 转换报告格式
   */
  convertFormat: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        format: z.enum(['markdown', 'html', 'json']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const report = await ctx.db.report.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '报告不存在' });
      }

      const generator = getReportGenerator();
      const content = await generator.convertReportFormat(input.id, input.format);

      // 更新报告格式
      await ctx.db.report.update({
        where: { id: input.id },
        data: { format: input.format },
      });

      return { content, format: input.format };
    }),

  /**
   * 删除报告
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.report.delete({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      return { success: true };
    }),

  /**
   * 生成分享链接
   */
  generateShareToken: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // 生成随机token
      const shareToken = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

      await ctx.db.report.update({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        data: {
          isPublic: true,
          shareToken,
        },
      });

      return { shareToken };
    }),

  /**
   * 取消分享
   */
  revokeShare: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.report.update({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        data: {
          isPublic: false,
          shareToken: null,
        },
      });

      return { success: true };
    }),
});
