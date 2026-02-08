/**
 * Entries API Router
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { AIAnalysisQueue } from '@/lib/ai/queue';
import { addDeepAnalysisJob } from '@/lib/queue/deep-analysis-processor';

export const entriesRouter = router({
  /**
   * 获取文章列表（支持分页）
   */
  list: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      feedId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
      tag: z.string().optional(),
      unreadOnly: z.boolean().default(false),
      starredOnly: z.boolean().default(false),
      archivedOnly: z.boolean().default(false),
      search: z.string().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      aiCategory: z.string().optional(),
      minImportance: z.number().min(0).max(1).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { page, limit, ...filters } = input;
      const skip = (page - 1) * limit;

      // 构建where条件
      const where: any = {
        feed: {
          userId: ctx.userId,
        },
      };

      if (filters.feedId) where.feedId = filters.feedId;
      if (filters.categoryId) where.feed.categoryId = filters.categoryId;
      if (filters.tag) where.tags = { has: filters.tag };
      if (filters.unreadOnly) where.isRead = false;
      if (filters.starredOnly) where.isStarred = true;
      if (filters.archivedOnly) where.isArchived = true;
      if (filters.aiCategory) where.aiCategory = filters.aiCategory;
      if (filters.minImportance) where.aiImportanceScore = { gte: filters.minImportance };

      if (filters.dateFrom || filters.dateTo) {
        where.publishedAt = {};
        if (filters.dateFrom) where.publishedAt.gte = filters.dateFrom;
        if (filters.dateTo) where.publishedAt.lte = filters.dateTo;
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { summary: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [entries, total] = await Promise.all([
        ctx.db.entry.findMany({
          where,
          skip,
          take: limit,
          orderBy: { publishedAt: 'desc' },
          include: {
            feed: {
              select: {
                id: true,
                title: true,
                iconUrl: true,
                categoryId: true,
              },
            },
          },
        }),
        ctx.db.entry.count({ where }),
      ]);

      return {
        items: entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: skip + limit < total,
          hasPrev: page > 1,
        },
      };
    }),

  /**
   * 获取文章列表（无限滚动）
   */
  infiniteList: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
      feedId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
      tag: z.string().optional(),
      unreadOnly: z.boolean().default(false),
      starredOnly: z.boolean().default(false),
      archivedOnly: z.boolean().default(false),
      search: z.string().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      aiCategory: z.string().optional(),
      minImportance: z.number().min(0).max(1).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { limit, cursor, ...filters } = input;

      // 构建where条件
      const where: any = {
        feed: {
          userId: ctx.userId,
        },
      };

      if (filters.feedId) where.feedId = filters.feedId;
      if (filters.categoryId) where.feed.categoryId = filters.categoryId;
      if (filters.tag) where.tags = { has: filters.tag };
      if (filters.unreadOnly) where.isRead = false;
      if (filters.starredOnly) where.isStarred = true;
      if (filters.archivedOnly) where.isArchived = true;
      if (filters.aiCategory) where.aiCategory = filters.aiCategory;
      if (filters.minImportance) where.aiImportanceScore = { gte: filters.minImportance };

      if (filters.dateFrom || filters.dateTo) {
        where.publishedAt = {};
        if (filters.dateFrom) where.publishedAt.gte = filters.dateFrom;
        if (filters.dateTo) where.publishedAt.lte = filters.dateTo;
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { summary: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // 游标条件
      if (cursor) {
        where.publishedAt = { lt: new Date(cursor) };
      }

      const entries = await ctx.db.entry.findMany({
        where,
        take: limit + 1, // 多取一个判断是否还有更多
        orderBy: { publishedAt: 'desc' },
        include: {
          feed: {
            select: {
              id: true,
              title: true,
              iconUrl: true,
              categoryId: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (entries.length > limit) {
        const nextItem = entries.pop();
        nextCursor = nextItem?.publishedAt?.toISOString();
      }

      return {
        items: entries,
        pagination: {
          nextCursor,
          hasNext: !!nextCursor,
        },
      };
    }),

  /**
   * 获取单篇文章
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: input.id,
          feed: { userId: ctx.userId },
        },
        include: {
          feed: {
            select: {
              id: true,
              title: true,
              iconUrl: true,
              categoryId: true,
            },
          },
        },
      });

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '文章不存在' });
      }

      // 记录阅读历史
      await ctx.db.readingHistory.upsert({
        where: {
          userId_entryId: {
            userId: ctx.userId,
            entryId: entry.id,
          },
        },
        create: {
          userId: ctx.userId,
          entryId: entry.id,
          source: 'direct',
        },
        update: {
          lastOpenedAt: new Date(),
        },
      });

      return entry;
    }),

  /**
   * 标记为已读
   */
  markAsRead: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string().uuid()),
      readAt: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.entry.updateMany({
        where: {
          id: { in: input.entryIds },
          feed: { userId: ctx.userId },
        },
        data: {
          isRead: true,
          readAt: input.readAt || new Date(),
        },
      });

      // 更新feed的未读计数
      const feedIds = await ctx.db.entry.findMany({
        where: { id: { in: input.entryIds } },
        select: { feedId: true },
      });

      for (const { feedId } of feedIds) {
        const unreadCount = await ctx.db.entry.count({
          where: { feedId, isRead: false },
        });
        await ctx.db.feed.update({
          where: { id: feedId },
          data: { unreadCount },
        });
      }

      return { success: true };
    }),

  /**
   * 标记星标
   */
  markAsStarred: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string().uuid()),
      starred: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.entry.updateMany({
        where: {
          id: { in: input.entryIds },
          feed: { userId: ctx.userId },
        },
        data: {
          isStarred: input.starred,
        },
      });

      return { success: true };
    }),

  /**
   * 切换星标状态
   */
  toggleStar: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: input.entryId,
          feed: { userId: ctx.userId },
        },
        select: { isStarred: true },
      });

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '文章不存在' });
      }

      await ctx.db.entry.update({
        where: { id: input.entryId },
        data: { isStarred: !entry.isStarred },
      });

      return { isStarred: !entry.isStarred };
    }),

  /**
   * 切换已读状态
   */
  toggleRead: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: input.entryId,
          feed: { userId: ctx.userId },
        },
        select: {
          isRead: true,
          feedId: true,
        },
      });

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '文章不存在' });
      }

      const newReadState = !entry.isRead;

      await ctx.db.entry.update({
        where: { id: input.entryId },
        data: {
          isRead: newReadState,
          readAt: newReadState ? new Date() : null,
        },
      });

      // 更新feed的未读计数
      if (!newReadState) {
        // 标记为未读，增加计数
        await ctx.db.feed.update({
          where: { id: entry.feedId },
          data: { unreadCount: { increment: 1 } },
        });
      } else {
        // 标记为已读，减少计数
        await ctx.db.feed.update({
          where: { id: entry.feedId },
          data: { unreadCount: { decrement: 1 } },
        });
      }

      return { isRead: newReadState };
    }),

  /**
   * 批量操作
   */
  bulkAction: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string().uuid()),
      action: z.enum(['markRead', 'markUnread', 'star', 'unstar', 'archive', 'unarchive', 'delete']),
    }))
    .mutation(async ({ input, ctx }) => {
      const { entryIds, action } = input;

      switch (action) {
        case 'markRead':
          await ctx.db.entry.updateMany({
            where: { id: { in: entryIds }, feed: { userId: ctx.userId } },
            data: { isRead: true, readAt: new Date() },
          });
          break;

        case 'markUnread':
          await ctx.db.entry.updateMany({
            where: { id: { in: entryIds }, feed: { userId: ctx.userId } },
            data: { isRead: false, readAt: null },
          });
          break;

        case 'star':
          await ctx.db.entry.updateMany({
            where: { id: { in: entryIds }, feed: { userId: ctx.userId } },
            data: { isStarred: true },
          });
          break;

        case 'unstar':
          await ctx.db.entry.updateMany({
            where: { id: { in: entryIds }, feed: { userId: ctx.userId } },
            data: { isStarred: false },
          });
          break;

        case 'archive':
          await ctx.db.entry.updateMany({
            where: { id: { in: entryIds }, feed: { userId: ctx.userId } },
            data: { isArchived: true },
          });
          break;

        case 'unarchive':
          await ctx.db.entry.updateMany({
            where: { id: { in: entryIds }, feed: { userId: ctx.userId } },
            data: { isArchived: false },
          });
          break;

        case 'delete':
          await ctx.db.entry.deleteMany({
            where: { id: { in: entryIds }, feed: { userId: ctx.userId } },
          });
          break;
      }

      return { success: true };
    }),

  /**
   * AI分析文章
   */
  analyze: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      analysisType: z.enum(['summary', 'category', 'keywords', 'sentiment', 'all']),
    }))
    .mutation(async ({ input, ctx }) => {
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: input.entryId,
          feed: { userId: ctx.userId },
        },
      });

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '文章不存在' });
      }

      // 检查是否已有分析结果
      if (input.analysisType === 'summary' && entry.aiSummary) {
        return {
          entryId: entry.id,
          summary: entry.aiSummary,
          keywords: entry.aiKeywords,
          category: entry.aiCategory,
          sentiment: entry.aiSentiment,
          importanceScore: entry.aiImportanceScore,
          status: 'completed',
        };
      }

      // 添加到AI分析队列
      await AIAnalysisQueue.addTask(entry.id, input.analysisType, 5);

      return {
        entryId: entry.id,
        status: 'queued',
        message: 'AI分析已加入队列',
      };
    }),

  // =====================================================
  // AI-Native 深度分析 API（新增）
  // =====================================================

  /**
   * 触发深度分析
   */
  triggerDeepAnalysis: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      priority: z.number().min(1).max(10).default(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const { entryId, priority } = input;
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
          aiAnalyzedAt: true,
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
          message: '文章没有内容，无法进行深度分析',
        });
      }

      // 检查是否已有深度分析
      if (entry.aiAnalyzedAt) {
        return {
          status: 'already_analyzed',
          message: '文章已进行过深度分析',
          entryId: entry.id,
        };
      }

      // 添加到深度分析队列
      try {
        const jobId = await addDeepAnalysisJob({
          entryId,
          userId,
          priority,
        });

        return {
          status: 'queued',
          jobId,
          message: '深度分析已加入队列',
          entryId: entry.id,
        };
      } catch (error) {
        console.error('添加深度分析任务失败:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '添加分析任务失败',
        });
      }
    }),

  /**
   * 获取深度分析结果
   */
  getDeepAnalysis: protectedProcedure
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
          title: true,
          aiOneLineSummary: true,
          aiSummary: true,
          aiMainPoints: true,
          aiKeyQuotes: true,
          aiScoreDimensions: true,
          aiAnalysisModel: true,
          aiProcessingTime: true,
          aiReflectionRounds: true,
          aiAnalyzedAt: true,
          feed: {
            select: {
              title: true,
            },
          },
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      // 如果没有深度分析，返回 null
      if (!entry.aiAnalyzedAt) {
        return null;
      }

      // 计算综合评分
      const scoreDimensions = entry.aiScoreDimensions as any;
      const aiScore = scoreDimensions
        ? ((scoreDimensions.depth || 5) * 0.3 +
           (scoreDimensions.quality || 5) * 0.3 +
           (scoreDimensions.practicality || 5) * 0.2 +
           (scoreDimensions.novelty || 5) * 0.2)
        : 5;

      return {
        entryId: entry.id,
        title: entry.title,
        feedName: entry.feed.title,
        oneLineSummary: entry.aiOneLineSummary,
        summary: entry.aiSummary,
        mainPoints: entry.aiMainPoints,
        keyQuotes: entry.aiKeyQuotes,
        scoreDimensions,
        aiScore,
        analysisModel: entry.aiAnalysisModel,
        processingTime: entry.aiProcessingTime,
        reflectionRounds: entry.aiReflectionRounds,
        analyzedAt: entry.aiAnalyzedAt,
      };
    }),

  /**
   * 批量获取分析状态
   */
  getAnalysisStatus: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string().uuid()),
    }))
    .query(async ({ input, ctx }) => {
      const entries = await ctx.db.entry.findMany({
        where: {
          id: { in: input.entryIds },
          feed: { userId: ctx.userId },
        },
        select: {
          id: true,
          aiAnalyzedAt: true,
          aiProcessingTime: true,
          aiReflectionRounds: true,
          aiScoreDimensions: true,
        },
      });

      const statusMap: Record<string, {
        analyzed: boolean;
        processingTime?: number;
        reflectionRounds?: number;
        score?: number;
      }> = {};

      for (const entry of entries) {
        const scoreDimensions = entry.aiScoreDimensions as any;
        const aiScore = scoreDimensions
          ? ((scoreDimensions.depth || 5) * 0.3 +
             (scoreDimensions.quality || 5) * 0.3 +
             (scoreDimensions.practicality || 5) * 0.2 +
             (scoreDimensions.novelty || 5) * 0.2)
          : undefined;

        statusMap[entry.id] = {
          analyzed: !!entry.aiAnalyzedAt,
          processingTime: entry.aiProcessingTime || undefined,
          reflectionRounds: entry.aiReflectionRounds,
          score: aiScore,
        };
      }

      return statusMap;
    }),
});
