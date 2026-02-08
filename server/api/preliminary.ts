/**
 * 初评 API Router
 *
 * 处理文章初评相关的操作
 * 基于 BestBlogs 的分层处理设计
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import {
  addPreliminaryJob,
  addPreliminaryJobsBatch,
  addUnanalyzedEntries,
  getQueueStatus,
  getQueueStats,
  getJobState,
  retryFailedJobs,
} from '@/lib/queue/preliminary-processor';

export const preliminaryRouter = router({
  // =====================================================
  // 初评触发
  // =====================================================

  /**
   * 触发单篇文章初评
   */
  trigger: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      priority: z.number().min(1).max(10).optional(),
      forceReanalyze: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const { entryId, priority, forceReanalyze } = input;
      const userId = ctx.userId;

      // 检查文章是否存在
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: entryId,
          feed: { userId },
        },
        select: {
          id: true,
          title: true,
          content: true,
          aiPrelimStatus: true,
          aiPrelimAnalyzedAt: true,
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      if (!entry.content) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '文章没有内容，无法进行初评',
        });
      }

      // 检查是否已初评（除非强制重分析）
      if (entry.aiPrelimStatus && !forceReanalyze) {
        return {
          status: 'already_evaluated',
          message: '文章已初评',
          entryId: entry.id,
          prelimStatus: entry.aiPrelimStatus,
        };
      }

      // 添加到初评队列
      try {
        const jobId = await addPreliminaryJob(
          { entryId, userId, priority, forceReanalyze },
          { priority: priority || 5 }
        );

        return {
          status: 'queued',
          jobId,
          message: '初评已加入队列',
          entryId: entry.id,
        };
      } catch (error) {
        console.error('添加初评任务失败:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '添加初评任务失败',
        });
      }
    }),

  /**
   * 批量触发初评
   */
  triggerBatch: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string().uuid()).min(1).max(50),
      priority: z.number().min(1).max(10).optional(),
      forceReanalyze: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const { entryIds, priority, forceReanalyze } = input;
      const userId = ctx.userId;

      // 验证文章所有权
      const entries = await ctx.db.entry.findMany({
        where: {
          id: { in: entryIds },
          feed: { userId },
        },
        select: {
          id: true,
          content: true,
          aiPrelimStatus: true,
        },
      });

      if (entries.length !== entryIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '部分文章不存在',
        });
      }

      // 过滤掉没有内容的文章
      const validEntries = entries.filter(e => e.content);

      // 添加到队列
      try {
        const jobIds = await addPreliminaryJobsBatch(
          validEntries.map(entry => ({
            entryId: entry.id,
            userId,
            priority: priority || 5,
            forceReanalyze,
          }))
        );

        return {
          status: 'queued',
          count: jobIds.length,
          jobIds,
          skipped: entries.length - validEntries.length,
          message: `已添加 ${jobIds.length} 篇文章到初评队列`,
        };
      } catch (error) {
        console.error('批量添加初评任务失败:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '批量添加初评任务失败',
        });
      }
    }),

  /**
   * 自动添加未初评文章
   */
  triggerUnanalyzed: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      priority: z.number().min(1).max(10).default(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const { limit, priority } = input;
      const userId = ctx.userId;

      // 获取用户未初评的文章数量
      const unanalyzedCount = await ctx.db.entry.count({
        where: {
          content: { not: null },
          aiPrelimStatus: null,
          feed: { userId },
        },
      });

      if (unanalyzedCount === 0) {
        return {
          status: 'no_entries',
          count: 0,
          message: '没有需要初评的文章',
        };
      }

      // 添加到队列
      try {
        const addedCount = await addUnanalyzedEntries(limit, priority);

        return {
          status: 'queued',
          count: addedCount,
          remaining: Math.max(0, unanalyzedCount - addedCount),
          message: `已添加 ${addedCount} 篇文章到初评队列`,
        };
      } catch (error) {
        console.error('添加未分析文章失败:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '添加未分析文章失败',
        });
      }
    }),

  // =====================================================
  // 初评结果
  // =====================================================

  /**
   * 获取初评结果
   */
  getResult: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: input.entryId,
          feed: { userId: ctx.userId },
        },
        select: {
          id: true,
          aiPrelimIgnore: true,
          aiPrelimReason: true,
          aiPrelimValue: true,
          aiPrelimSummary: true,
          aiPrelimLanguage: true,
          aiPrelimStatus: true,
          aiPrelimAnalyzedAt: true,
          aiPrelimModel: true,
          title: true,
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      // 如果没有初评，返回 null
      if (!entry.aiPrelimStatus) {
        return null;
      }

      return {
        entryId: entry.id,
        title: entry.title,
        ignore: entry.aiPrelimIgnore,
        reason: entry.aiPrelimReason,
        value: entry.aiPrelimValue,
        summary: entry.aiPrelimSummary,
        language: entry.aiPrelimLanguage,
        status: entry.aiPrelimStatus,
        analyzedAt: entry.aiPrelimAnalyzedAt,
        model: entry.aiPrelimModel,
      };
    }),

  /**
   * 批量获取初评状态
   */
  getStatus: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string().uuid()).min(1).max(100),
    }))
    .query(async ({ input, ctx }) => {
      const entries = await ctx.db.entry.findMany({
        where: {
          id: { in: input.entryIds },
          feed: { userId: ctx.userId },
        },
        select: {
          id: true,
          aiPrelimStatus: true,
          aiPrelimValue: true,
          aiPrelimLanguage: true,
          aiPrelimAnalyzedAt: true,
        },
      });

      const statusMap: Record<string, {
        evaluated: boolean;
        status?: string;
        value?: number;
        language?: string;
        analyzedAt?: Date;
      }> = {};

      for (const entry of entries) {
        statusMap[entry.id] = {
          evaluated: !!entry.aiPrelimStatus,
          status: entry.aiPrelimStatus || undefined,
          value: entry.aiPrelimValue || undefined,
          language: entry.aiPrelimLanguage || undefined,
          analyzedAt: entry.aiPrelimAnalyzedAt || undefined,
        };
      }

      // 填充未找到的文章
      for (const entryId of input.entryIds) {
        if (!statusMap[entryId]) {
          statusMap[entryId] = { evaluated: false };
        }
      }

      return statusMap;
    }),

  // =====================================================
  // 统计和分析
  // =====================================================

  /**
   * 获取初评统计
   */
  getStats: protectedProcedure
    .input(z.object({
      period: z.enum(['day', 'week', 'month', 'all']).default('all'),
    }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId;
      const { period } = input;

      // 计算时间范围
      let dateFilter: Date | undefined;
      const now = new Date();
      switch (period) {
        case 'day':
          dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const where: any = {
        feed: { userId },
        aiPrelimStatus: { not: null },
      };

      if (dateFilter) {
        where.aiPrelimAnalyzedAt = { gte: dateFilter };
      }

      // 获取统计数据
      const [total, passed, rejected, byLanguage, byValue] = await Promise.all([
        ctx.db.entry.count({ where }),
        ctx.db.entry.count({ where: { ...where, aiPrelimStatus: 'passed' } }),
        ctx.db.entry.count({ where: { ...where, aiPrelimStatus: 'rejected' } }),
        ctx.db.entry.groupBy({
          by: ['aiPrelimLanguage'],
          where: { ...where, aiPrelimLanguage: { not: null } },
          _count: true,
        }),
        ctx.db.entry.groupBy({
          by: ['aiPrelimValue'],
          where: { ...where, aiPrelimValue: { not: null } },
          _count: true,
        }),
      ]);

      return {
        period,
        total,
        passed,
        rejected,
        passRate: total > 0 ? (passed / total) * 100 : 0,
        byLanguage: byLanguage.map(item => ({
          language: item.aiPrelimLanguage,
          count: item._count,
        })),
        byValue: byValue.map(item => ({
          value: item.aiPrelimValue,
          count: item._count,
        })),
      };
    }),

  /**
   * 获取队列状态
   */
  getQueueStatus: protectedProcedure
    .query(async () => {
      const status = await getQueueStatus();
      const stats = await getQueueStats();

      return {
        queue: status,
        stats,
      };
    }),

  /**
   * 获取任务状态
   */
  getJobStatus: protectedProcedure
    .input(z.object({
      jobId: z.string(),
    }))
    .query(async ({ input }) => {
      const jobState = await getJobState(input.jobId);

      if (!jobState) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '任务不存在',
        });
      }

      return jobState;
    }),

  // =====================================================
  // 队列管理
  // =====================================================

  /**
   * 重试失败任务
   */
  retryFailed: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
    }))
    .mutation(async ({ input }) => {
      const retried = await retryFailedJobs(input.limit);

      return {
        success: true,
        retried,
        message: `已重试 ${retried} 个失败任务`,
      };
    }),

  // =====================================================
  // 配置管理
  // =====================================================

  /**
   * 获取初评配置
   */
  getConfig: protectedProcedure
    .query(() => {
      return {
        models: {
          chinese: process.env.PRELIMINARY_MODEL_ZH || 'deepseek-chat',
          english: process.env.PRELIMINARY_MODEL_EN || 'gemini-1.5-flash',
          other: process.env.PRELIMINARY_MODEL_OTHER || 'gpt-4o-mini',
        },
        minValue: parseInt(process.env.PRELIMINARY_MIN_VALUE || '3', 10),
        enableLanguageDetection: process.env.ENABLE_LANGUAGE_DETECTION !== 'false',
      };
    }),
});
