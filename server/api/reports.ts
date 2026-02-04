/**
 * Reports API Router
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { getReportGenerator } from '@/lib/reports/generator';

export const reportsRouter = router({
  /**
   * 生成日报
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
   * 生成周报
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
