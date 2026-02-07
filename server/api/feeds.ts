/**
 * Feeds API Router
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { feedManager } from '@/lib/rss/feed-manager';
import { parseFeed } from '@/lib/rss/parser';
import { AIAnalysisQueue } from '@/lib/ai/queue';

export const feedsRouter = router({
  /**
   * 获取订阅源列表
   */
  list: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      categoryId: z.string().uuid().optional(),
      tag: z.string().optional(),
      search: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { page, limit, ...filters } = input;
      const skip = (page - 1) * limit;

      const [feeds, total] = await Promise.all([
        ctx.db.feed.findMany({
          where: {
            ...filters,
            userId: ctx.userId,
          },
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            category: true,
            _count: {
              select: { entries: { where: { isRead: false } } },
            },
          },
        }),
        ctx.db.feed.count({
          where: {
            ...filters,
            userId: ctx.userId,
          },
        }),
      ]);

      return {
        items: feeds,
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
   * 获取单个订阅源
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const feed = await ctx.db.feed.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        include: {
          category: true,
          _count: {
            select: { entries: true },
          },
        },
      });

      if (!feed) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '订阅源不存在' });
      }

      // 计算未读数
      const unreadCount = await ctx.db.entry.count({
        where: {
          feedId: feed.id,
          isRead: false,
        },
      });

      return {
        ...feed,
        unreadCount,
      };
    }),

  /**
   * 添加订阅源
   */
  add: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      title: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      tags: z.array(z.string()).optional(),
      fetchInterval: z.number().min(60).max(86400).optional(),
      priority: z.number().min(1).max(10).optional(),
      description: z.string().optional(),
      siteUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 检查是否已存在
      const existing = await ctx.db.feed.findFirst({
        where: {
          userId: ctx.userId,
          feedUrl: input.url,
        },
      });

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '订阅源已存在' });
      }

      // 解析RSS feed获取标题
      let title = input.title;
      let description = input.description;
      let siteUrl = input.siteUrl;
      
      if (!title || !description || !siteUrl) {
        try {
          const parsed = await parseFeed(input.url);
          title = title || parsed.title;
          description = description || parsed.description;
          siteUrl = siteUrl || parsed.link;
        } catch {
          title = title || new URL(input.url).hostname;
        }
      }

      // 创建订阅源
      const feed = await ctx.db.feed.create({
        data: {
          userId: ctx.userId,
          feedUrl: input.url,
          title,
          description,
          siteUrl,
          categoryId: input.categoryId,
          tags: input.tags || [],
          fetchInterval: input.fetchInterval || 3600,
          priority: input.priority || 5,
          nextFetchAt: new Date(), // 立即抓取
        },
      });

      // 异步抓取
      feedManager.fetchFeed(feed.id).catch(console.error);

      return feed;
    }),

  /**
   * 更新订阅源
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      url: z.string().url().optional(),
      title: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      tags: z.array(z.string()).optional(),
      fetchInterval: z.number().min(60).max(86400).optional(),
      priority: z.number().min(1).max(10).optional(),
      description: z.string().optional(),
      siteUrl: z.string().url().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, url, ...data } = input;

      const feed = await ctx.db.feed.update({
        where: {
          id,
          userId: ctx.userId,
        },
        data: {
          ...data,
          ...(url && { feedUrl: url }),
        },
      });

      return feed;
    }),

  /**
   * 删除订阅源
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.feed.delete({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      return { success: true };
    }),

  /**
   * 手动刷新订阅源
   */
  refresh: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const feed = await ctx.db.feed.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      if (!feed) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '订阅源不存在' });
      }

      // 异步抓取
      feedManager.fetchFeed(feed.id).catch(console.error);

      return { success: true };
    }),

  /**
   * 批量操作
   */
  bulkAction: protectedProcedure
    .input(z.object({
      feedIds: z.array(z.string().uuid()),
      action: z.enum(['activate', 'deactivate', 'delete', 'refresh']),
    }))
    .mutation(async ({ input, ctx }) => {
      const { feedIds, action } = input;

      switch (action) {
        case 'activate':
          await ctx.db.feed.updateMany({
            where: {
              id: { in: feedIds },
              userId: ctx.userId,
            },
            data: { isActive: true },
          });
          break;

        case 'deactivate':
          await ctx.db.feed.updateMany({
            where: {
              id: { in: feedIds },
              userId: ctx.userId,
            },
            data: { isActive: false },
          });
          break;

        case 'delete':
          await ctx.db.feed.deleteMany({
            where: {
              id: { in: feedIds },
              userId: ctx.userId,
            },
          });
          break;

        case 'refresh':
          for (const feedId of feedIds) {
            feedManager.fetchFeed(feedId).catch(console.error);
          }
          break;
      }

      return { success: true };
    }),

  /**
   * 获取订阅源统计
   */
  stats: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const stats = await ctx.db.$queryRaw`
        SELECT
          COUNT(*) as total_entries,
          COUNT(CASE WHEN e.is_read = false THEN 1 END) as unread_count,
          COUNT(CASE WHEN e.is_starred = true THEN 1 END) as starred_count,
          COUNT(CASE WHEN e.created_at > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as entries_last_7_days,
          MAX(e.published_at) as latest_entry_at
        FROM entries e
        JOIN feeds f ON e.feed_id = f.id
        WHERE f.id = ${input.id} AND f.user_id = ${ctx.userId}
      ` as any[];

      return stats[0] || {
        total_entries: 0,
        unread_count: 0,
        starred_count: 0,
        entries_last_7_days: 0,
        latest_entry_at: null,
      };
    }),

  /**
   * 获取全局统计（所有订阅源）
   */
  globalStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [totalFeeds, totalEntries, unreadCount, todayEntries] = await Promise.all([
        ctx.db.feed.count({
          where: { userId: ctx.userId, isActive: true },
        }),
        ctx.db.entry.count({
          where: {
            feed: { userId: ctx.userId },
          },
        }),
        ctx.db.entry.count({
          where: {
            feed: { userId: ctx.userId },
            isRead: false,
          },
        }),
        ctx.db.entry.count({
          where: {
            feed: { userId: ctx.userId },
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);

      return {
        totalFeeds,
        totalEntries,
        unreadCount,
        todayEntries,
      };
    }),

  /**
   * 自动发现订阅源信息
   */
  discover: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      try {
        const response = await fetch(input.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Rss-Easy/1.0)',
          },
        });
        
        if (!response.ok) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '无法获取网站内容',
          });
        }

        const html = await response.text();
        
        // 解析标题
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const title = titleMatch?.[1]?.trim();
        
        // 解析描述
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
        const description = descMatch?.[1]?.trim();

        return {
          feed: {
            title: title || null,
            description: description || null,
            siteUrl: input.url,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '自动发现失败',
        });
      }
    }),
});
