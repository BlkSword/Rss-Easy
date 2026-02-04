/**
 * Entries API Router
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { AIAnalysisQueue } from '@/lib/ai/queue';

export const entriesRouter = router({
  /**
   * 获取文章列表
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
});
