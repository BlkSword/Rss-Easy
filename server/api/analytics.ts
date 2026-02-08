/**
 * Analytics API Router
 *
 * 处理用户行为追踪、偏好学习和个性化推荐
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router, publicProcedure } from '../trpc/init';

export const analyticsRouter = router({
  /**
   * 记录阅读行为
   */
  trackReading: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      dwellTime: z.number().min(0), // 停留时间（秒）
      scrollDepth: z.number().min(0).max(1), // 滚动深度 0-1
      isCompleted: z.boolean(), // 是否阅读完成
      isStarred: z.boolean().optional(),
      rating: z.number().min(1).max(5).optional(),
      attentionSegments: z.array(z.object({
        startOffset: z.number(),
        endOffset: z.number(),
        duration: z.number(),
      })).optional(), // 关注段落
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;

      // 检查文章是否存在
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: input.entryId,
          feed: { userId },
        },
        select: { id: true },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      // 计算开始时间
      const startedAt = new Date(Date.now() - input.dwellTime * 1000);

      // 保存阅读会话
      try {
        const session = await ctx.db.readingSession.create({
          data: {
            userId,
            entryId: input.entryId,
            startedAt,
            endedAt: new Date(),
            dwellTime: input.dwellTime,
            scrollDepth: input.scrollDepth,
            isCompleted: input.isCompleted,
            isStarred: input.isStarred || false,
            rating: input.rating,
            attentionSegments: input.attentionSegments,
          },
        });

        // 异步更新用户偏好（不阻塞响应）
        updateUserPreferences(userId).catch(error => {
          console.error('更新用户偏好失败:', error);
        });

        return {
          success: true,
          sessionId: session.id,
        };
      } catch (error) {
        console.error('保存阅读会话失败:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '保存阅读行为失败',
        });
      }
    }),

  /**
   * 获取用户阅读画像
   */
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;

      // 获取用户偏好
      let preference = await ctx.db.userPreference.findUnique({
        where: { userId },
      });

      // 如果没有偏好记录，创建默认值
      if (!preference) {
        preference = await ctx.db.userPreference.create({
          data: {
            userId,
            topicWeights: {},
            excludedTags: [],
            totalReadTime: 0,
            totalEntries: 0,
            avgCompletion: 0,
            avgDwellTime: 0,
            diversityScore: 0,
          },
        });
      }

      return {
        userId: preference.userId,
        topicWeights: preference.topicWeights as Record<string, number>,
        preferredDepth: preference.preferredDepth,
        preferredLength: preference.preferredLength,
        excludedTags: preference.excludedTags,
        stats: {
          totalReadTime: preference.totalReadTime,
          totalEntries: preference.totalEntries,
          avgCompletion: preference.avgCompletion,
          avgDwellTime: preference.avgDwellTime,
          diversityScore: preference.diversityScore,
        },
        updatedAt: preference.updatedAt,
      };
    }),

  /**
   * 获取阅读统计
   */
  getReadingStats: protectedProcedure
    .input(z.object({
      period: z.enum(['day', 'week', 'month', 'all']).default('week'),
    }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId;
      const period = input.period;

      // 计算时间范围
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
        default:
          startDate = new Date(0);
          break;
      }

      // 获取阅读会话统计
      const sessions = await ctx.db.readingSession.findMany({
        where: {
          userId,
          startedAt: { gte: startDate },
        },
        include: {
          entry: {
            select: {
              tags: true,
              feed: {
                select: {
                  title: true,
                  tags: true,
                },
              },
            },
          },
        },
      });

      // 计算统计数据
      const totalEntries = sessions.length;
      const totalReadTime = sessions.reduce((sum, s) => sum + s.dwellTime, 0);
      const avgDwellTime = totalEntries > 0 ? totalReadTime / totalEntries : 0;
      const completedCount = sessions.filter(s => s.isCompleted).length;
      const completionRate = totalEntries > 0 ? completedCount / totalEntries : 0;
      const starredCount = sessions.filter(s => s.isStarred).length;

      // 统计标签
      const tagCounts: Record<string, number> = {};
      for (const session of sessions) {
        const tags = [...(session.entry.tags || []), ...(session.entry.feed.tags || [])];
        for (const tag of tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      // 排序标签
      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

      return {
        period,
        startDate,
        endDate: now,
        summary: {
          totalEntries,
          totalReadTime,
          avgDwellTime: Math.round(avgDwellTime),
          completionRate: Math.round(completionRate * 100) / 100,
          starredCount,
        },
        topTags,
      };
    }),

  /**
   * 更新用户偏好设置
   */
  updatePreferences: protectedProcedure
    .input(z.object({
      preferredDepth: z.enum(['deep', 'medium', 'light']).optional(),
      preferredLength: z.enum(['short', 'medium', 'long']).optional(),
      excludedTags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;

      try {
        const preference = await ctx.db.userPreference.upsert({
          where: { userId },
          create: {
            userId,
            topicWeights: {},
            preferredDepth: input.preferredDepth,
            preferredLength: input.preferredLength,
            excludedTags: input.excludedTags || [],
            totalReadTime: 0,
            totalEntries: 0,
            avgCompletion: 0,
            avgDwellTime: 0,
            diversityScore: 0,
          },
          update: {
            preferredDepth: input.preferredDepth,
            preferredLength: input.preferredLength,
            excludedTags: input.excludedTags,
          },
        });

        return {
          success: true,
          preference: {
            preferredDepth: preference.preferredDepth,
            preferredLength: preference.preferredLength,
            excludedTags: preference.excludedTags,
          },
        };
      } catch (error) {
        console.error('更新用户偏好失败:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '更新偏好设置失败',
        });
      }
    }),

  /**
   * 获取个性化推荐流
   */
  getPersonalizedFeed: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
      filters: z.object({
        minScore: z.number().optional(),
        tags: z.array(z.string()).optional(),
        excludeRead: z.boolean().default(false),
      }).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId;
      const { limit, cursor, filters } = input;

      // 获取用户偏好
      const preference = await ctx.db.userPreference.findUnique({
        where: { userId },
      });

      if (!preference || Object.keys(preference.topicWeights as Record<string, number>).length === 0) {
        // 没有偏好数据，返回普通列表
        const where: any = {
          feed: { userId },
        };

        if (filters?.excludeRead) {
          where.isRead = false;
        }

        if (cursor) {
          where.publishedAt = { lt: new Date(cursor) };
        }

        const entries = await ctx.db.entry.findMany({
          where,
          take: limit + 1,
          orderBy: { publishedAt: 'desc' },
          include: {
            feed: {
              select: {
                id: true,
                title: true,
                iconUrl: true,
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
          personalized: false,
        };
      }

      // 构建个性化查询
      const topicWeights = preference.topicWeights as Record<string, number>;
      const topTags = Object.entries(topicWeights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      const where: any = {
        feed: { userId },
      };

      // 基于用户偏好标签筛选
      if (topTags.length > 0) {
        where.tags = { hasSome: topTags };
      }

      // 排除不感兴趣的标签
      if (preference.excludedTags.length > 0) {
        where.tags = { ...where.tags, hasNone: preference.excludedTags };
      }

      if (filters?.excludeRead) {
        where.isRead = false;
      }

      if (cursor) {
        where.publishedAt = { lt: new Date(cursor) };
      }

      // 只返回已深度分析的文章
      where.aiAnalyzedAt = { not: null };

      const entries = await ctx.db.entry.findMany({
        where,
        take: limit + 1,
        orderBy: [
          { aiAnalyzedAt: 'desc' },
          { publishedAt: 'desc' },
        ],
        include: {
          feed: {
            select: {
              id: true,
              title: true,
              iconUrl: true,
            },
          },
        },
      });

      // 计算个性化评分
      const scoredEntries = entries.map(entry => {
        const scoreDimensions = entry.aiScoreDimensions as any;
        const baseScore = scoreDimensions
          ? ((scoreDimensions.depth || 5) * 0.3 +
             (scoreDimensions.quality || 5) * 0.3 +
             (scoreDimensions.practicality || 5) * 0.2 +
             (scoreDimensions.novelty || 5) * 0.2)
          : 5;

        // 计算标签匹配度
        const entryTags = entry.tags || [];
        const tagMatch = entryTags.reduce((sum, tag) => {
          return sum + (topicWeights[tag] || 0);
        }, 0) / Math.max(entryTags.length, 1);

        const personalScore = baseScore * 0.7 + tagMatch * 3;

        return {
          ...entry,
          personalScore,
        };
      });

      // 按个性化评分排序
      scoredEntries.sort((a, b) => b.personalScore - a.personalScore);

      let nextCursor: string | undefined;
      let items = scoredEntries;

      if (scoredEntries.length > limit) {
        items = scoredEntries.slice(0, limit);
        nextCursor = items[items.length - 1]?.publishedAt?.toISOString();
      } else {
        items = scoredEntries;
      }

      return {
        items,
        pagination: {
          nextCursor,
          hasNext: !!nextCursor,
        },
        personalized: true,
      };
    }),
  // =====================================================
  // 反馈相关 API
  // =====================================================

  /**
   * 提交分析反馈
   */
  submitFeedback: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      summaryIssue: z.string().optional(),
      tagSuggestions: z.array(z.string()).optional(),
      rating: z.number().min(1).max(5).optional(),
      isHelpful: z.boolean().optional(),
      comments: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.userId;
      const { entryId, ...feedbackData } = input;

      // 检查文章是否存在
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: entryId,
          feed: { userId },
        },
        select: { id: true },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      try {
        // 保存反馈
        await ctx.db.analysisFeedback.upsert({
          where: {
            entryId_userId: {
              entryId,
              userId,
            },
          },
          create: {
            entryId,
            userId,
            summaryIssue: feedbackData.summaryIssue,
            tagSuggestions: feedbackData.tagSuggestions || [],
            rating: feedbackData.rating,
            isHelpful: feedbackData.isHelpful,
            comments: feedbackData.comments,
          },
          update: {
            summaryIssue: feedbackData.summaryIssue,
            tagSuggestions: feedbackData.tagSuggestions || [],
            rating: feedbackData.rating,
            isHelpful: feedbackData.isHelpful,
            comments: feedbackData.comments,
            isApplied: false,
            appliedAt: null,
          },
        });

        return {
          success: true,
          message: '感谢您的反馈！',
        };
      } catch (error) {
        console.error('保存反馈失败:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '保存反馈失败',
        });
      }
    }),

  /**
   * 获取文章反馈统计
   */
  getFeedbackStats: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const { entryId } = input;

      // 检查文章是否存在
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: entryId,
          feed: { userId: ctx.userId },
        },
        select: { id: true },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      // 获取反馈统计
      const feedbacks = await ctx.db.analysisFeedback.findMany({
        where: { entryId },
      });

      const total = feedbacks.length;
      const helpful = feedbacks.filter(f => f.isHelpful === true).length;
      const notHelpful = feedbacks.filter(f => f.isHelpful === false).length;

      const ratings = feedbacks
        .map(f => f.rating)
        .filter((r): r is number => r !== undefined);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      // 统计常见问题
      const issueMap = new Map<string, number>();
      for (const f of feedbacks) {
        if (f.summaryIssue) {
          const key = f.summaryIssue.slice(0, 50);
          issueMap.set(key, (issueMap.get(key) || 0) + 1);
        }
      }

      const commonIssues = Array.from(issueMap.entries())
        .map(([issue, count]) => ({ issue, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        total,
        helpful,
        notHelpful,
        avgRating: Math.round(avgRating * 10) / 10,
        commonIssues,
      };
    }),
});

/**
 * 异步更新用户偏好
 */
async function updateUserPreferences(userId: string): Promise<void> {
  // 这里可以实现用户偏好的自动学习逻辑
  // 例如：根据最近的阅读行为更新主题权重
  // 暂时简化处理，实际应用中需要更复杂的算法
}
