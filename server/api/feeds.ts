/**
 * Feeds API Router
 * 安全修复：添加 SSRF 防护
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { feedManager } from '@/lib/rss/feed-manager';
import { parseFeed } from '@/lib/rss/parser';
import { AIAnalysisQueue } from '@/lib/ai/queue';
import { info, warn, error } from '@/lib/logger';
import { isUrlSafe } from '@/lib/utils';

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
              select: {
                entries: true,
              },
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

      // 优化：使用单次聚合查询获取所有订阅源的未读数量
      const feedIds = feeds.map(f => f.id);
      const unreadCounts = await ctx.db.entry.groupBy({
        by: ['feedId'],
        where: {
          feedId: { in: feedIds },
          isRead: false,
        },
        _count: { id: true },
      });

      // 创建 feedId -> unreadCount 的映射
      const unreadMap = new Map(
        unreadCounts.map(item => [item.feedId, item._count.id])
      );

      // 合并未读数量（无需额外查询）
      const feedsWithUnreadCount = feeds.map(feed => ({
        ...feed,
        unreadCount: unreadMap.get(feed.id) || 0,
      }));

      return {
        items: feedsWithUnreadCount,
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
   * 安全修复：添加 SSRF 防护
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
      // SSRF 防护：验证 URL 安全性
      const urlCheck = isUrlSafe(input.url);
      if (!urlCheck.safe) {
        await warn('rss', '订阅源 URL 被 SSRF 防护拦截', {
          userId: ctx.userId,
          url: input.url,
          reason: urlCheck.reason
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `URL 不安全: ${urlCheck.reason}`
        });
      }

      await info('rss', '用户尝试创建订阅源', {
        userId: ctx.userId,
        url: input.url,
        title: input.title
      });

      // 检查是否已存在
      const existing = await ctx.db.feed.findFirst({
        where: {
          userId: ctx.userId,
          feedUrl: input.url,
        },
      });

      if (existing) {
        await warn('rss', '创建订阅源失败：已存在', {
          userId: ctx.userId,
          url: input.url,
          existingFeedId: existing.id
        });
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

      await info('rss', '订阅源创建成功', {
        userId: ctx.userId,
        feedId: feed.id,
        title: feed.title,
        url: input.url,
        categoryId: input.categoryId,
        tags: input.tags
      });

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
      await info('rss', '用户更新订阅源', {
        userId: ctx.userId,
        feedId: input.id,
        updates: Object.keys(input).filter(k => k !== 'id')
      });

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

      await info('rss', '订阅源更新成功', {
        userId: ctx.userId,
        feedId: feed.id,
        title: feed.title,
        updatedFields: Object.keys(input).filter(k => k !== 'id')
      });

      return feed;
    }),

  /**
   * 删除订阅源
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // 先获取feed信息用于日志
      const feed = await ctx.db.feed.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        select: {
          id: true,
          title: true,
          feedUrl: true,
          totalEntries: true
        }
      });

      if (!feed) {
        await warn('rss', '删除订阅源失败：不存在', {
          userId: ctx.userId,
          feedId: input.id
        });
        throw new TRPCError({ code: 'NOT_FOUND', message: '订阅源不存在' });
      }

      await info('rss', '用户删除订阅源', {
        userId: ctx.userId,
        feedId: feed.id,
        title: feed.title,
        totalEntries: feed.totalEntries
      });

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
      await info('rss', '用户手动刷新订阅源', {
        userId: ctx.userId,
        feedId: input.id
      });

      const feed = await ctx.db.feed.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      if (!feed) {
        await warn('rss', '刷新订阅源失败：不存在', {
          userId: ctx.userId,
          feedId: input.id
        });
        throw new TRPCError({ code: 'NOT_FOUND', message: '订阅源不存在' });
      }

      // 异步抓取
      feedManager.fetchFeed(feed.id).catch(console.error);

      await info('rss', '订阅源刷新任务已提交', {
        userId: ctx.userId,
        feedId: feed.id,
        title: feed.title
      });

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

      await info('rss', '用户批量操作订阅源', {
        userId: ctx.userId,
        action,
        feedCount: feedIds.length
      });

      switch (action) {
        case 'activate':
          await ctx.db.feed.updateMany({
            where: {
              id: { in: feedIds },
              userId: ctx.userId,
            },
            data: { isActive: true },
          });
          await info('rss', '批量启用订阅源完成', {
            userId: ctx.userId,
            feedCount: feedIds.length
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
          await info('rss', '批量禁用订阅源完成', {
            userId: ctx.userId,
            feedCount: feedIds.length
          });
          break;

        case 'delete':
          await ctx.db.feed.deleteMany({
            where: {
              id: { in: feedIds },
              userId: ctx.userId,
            },
          });
          await info('rss', '批量删除订阅源完成', {
            userId: ctx.userId,
            feedCount: feedIds.length
          });
          break;

        case 'refresh':
          for (const feedId of feedIds) {
            feedManager.fetchFeed(feedId).catch(console.error);
          }
          await info('rss', '批量刷新订阅源任务已提交', {
            userId: ctx.userId,
            feedCount: feedIds.length
          });
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
   * 优先从 RSS feed 中提取，如果失败则从网页提取
   * 安全修复：添加 SSRF 防护
   */
  discover: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      // SSRF 防护：验证 URL 安全性
      const urlCheck = isUrlSafe(input.url);
      if (!urlCheck.safe) {
        await warn('rss', '发现订阅源 URL 被 SSRF 防护拦截', {
          userId: ctx.userId,
          url: input.url,
          reason: urlCheck.reason
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `URL 不安全: ${urlCheck.reason}`
        });
      }

      try {
        // 首先尝试直接解析 RSS feed
        let title: string | null = null;
        let description: string | null = null;
        let siteUrl: string | null = null;
        let iconUrl: string | null = null;

        try {
          const parsed = await parseFeed(input.url);
          title = parsed.title || null;
          description = parsed.description || null;
          siteUrl = parsed.link || input.url;
        } catch (feedError) {
          // RSS feed 解析失败，尝试从网页提取
          console.warn('Failed to parse RSS feed, trying to extract from webpage:', feedError);
        }

        // 如果 RSS feed 中没有描述或标题，尝试从 HTML 网页提取
        if (!title || !description) {
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

          // 提取标题（如果还没有）
          if (!title) {
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            title = titleMatch?.[1]?.trim() || null;
          }

          // 提取描述（如果还没有）
          if (!description) {
            // 尝试多种 meta 标签
            const descPatterns = [
              /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
              /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i,
              /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i,
            ];

            for (const pattern of descPatterns) {
              const match = html.match(pattern);
              if (match?.[1]) {
                description = match[1].trim();
                break;
              }
            }

            // 如果还是没找到，尝试从第一个段落提取
            if (!description) {
              const pMatch = html.match(/<p[^>]*>([^<]{20,200})<\/p>/i);
              description = pMatch?.[1]?.trim() || null;
            }
          }

          // 提取 favicon（如果还没有）
          if (!iconUrl) {
            const iconPatterns = [
              /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i,
              /<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']+)["']/i,
            ];

            for (const pattern of iconPatterns) {
              const match = html.match(pattern);
              if (match?.[1]) {
                iconUrl = match[1].trim();
                // 处理相对路径
                if (iconUrl && !iconUrl.startsWith('http')) {
                  try {
                    iconUrl = new URL(iconUrl, input.url).href;
                  } catch {
                    iconUrl = null;
                  }
                }
                break;
              }
            }
          }
        }

        return {
          feed: {
            title: title || null,
            description: description || null,
            siteUrl: siteUrl || input.url,
            iconUrl: iconUrl || null,
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
