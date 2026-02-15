/**
 * 队列状态 API
 * 提供实时队列监控信息
 * 安全修复：添加用户数据隔离
 */

import { router, publicProcedure, protectedProcedure } from '../trpc/init';
import { db } from '@/lib/db';
import { getScheduler } from '@/lib/jobs/scheduler';
import { z } from 'zod';
import { safeDecrypt } from '@/lib/crypto/encryption';

// 辅助函数：获取用户的 Feed ID 列表
async function getUserFeedIds(userId: string): Promise<string[]> {
  const feeds = await db.feed.findMany({
    where: { userId },
    select: { id: true },
  });
  return feeds.map(f => f.id);
}

export const queueRouter = router({
  /**
   * 获取文章的 AI 分析状态
   */
  entryAnalysisStatus: protectedProcedure
    .input(z.object({ entryId: z.string() }))
    .query(async ({ input, ctx }) => {
      // 检查文章是否有 AI 分析结果
      const entry = await db.entry.findUnique({
        where: { id: input.entryId },
        select: {
          aiSummary: true,
          aiKeywords: true,
          aiCategory: true,
          aiSentiment: true,
          aiImportanceScore: true,
          aiAnalyzedAt: true,
          createdAt: true,
        },
      });

      if (!entry) {
        return { status: 'not_found' };
      }

      // 检查是否有分析结果
      const hasAnalysis = !!(
        entry.aiSummary ||
        (entry.aiKeywords && entry.aiKeywords.length > 0) ||
        entry.aiCategory ||
        entry.aiSentiment ||
        (entry.aiImportanceScore && entry.aiImportanceScore > 0)
      );

      if (hasAnalysis) {
        return { status: 'completed', analyzedAt: entry.aiAnalyzedAt };
      }

      // 检查是否在队列中
      const queueTask = await db.aIAnalysisQueue.findFirst({
        where: { entryId: input.entryId },
        orderBy: { createdAt: 'desc' },
      });

      if (queueTask) {
        return {
          status: queueTask.status as 'pending' | 'processing' | 'failed',
          queuePosition: queueTask.status === 'pending' ? await db.aIAnalysisQueue.count({
            where: { status: 'pending', createdAt: { lte: queueTask.createdAt } },
          }) : undefined,
          errorMessage: queueTask.errorMessage,
          retryCount: queueTask.retryCount,
        };
      }

      // 检查用户 AI 配置
      const user = await db.user.findUnique({
        where: { id: ctx.userId! },
        select: { aiConfig: true },
      });

      const aiConfig = (user?.aiConfig as any) || {};
      const hasApiKey = !!(aiConfig.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY);
      const autoSummary = aiConfig.autoSummary !== false; // 默认开启
      const configValid = aiConfig.configValid !== false; // 默认有效

      // 判断原因
      let reason: 'no_config' | 'not_queued' | 'old_article' = 'not_queued';

      if (!hasApiKey || !configValid) {
        reason = 'no_config';
      } else if (entry.createdAt < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
        // 文章超过7天
        reason = 'old_article';
      }

      return {
        status: 'not_analyzed',
        reason,
        hasApiKey,
        configValid,
        autoSummary,
        articleAge: Date.now() - entry.createdAt.getTime(),
      };
    }),

  /**
   * 获取用户的 AI 配置状态
   */
  aiConfigStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db.user.findUnique({
        where: { id: ctx.userId! },
        select: { aiConfig: true },
      });

      const aiConfig = (user?.aiConfig as any) || {};

      // 检查各种 API Key
      const hasUserApiKey = !!aiConfig.apiKey;
      const hasEnvApiKey = !!(
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.DEEPSEEK_API_KEY ||
        process.env.GEMINI_API_KEY
      );

      // 获取当前提供商
      const provider = aiConfig.provider || process.env.AI_PROVIDER || 'openai';
      const model = aiConfig.model || process.env.AI_MODEL;

      return {
        hasApiKey: hasUserApiKey || hasEnvApiKey,
        hasUserApiKey,
        hasEnvApiKey,
        provider,
        model,
        configValid: aiConfig.configValid !== false,
        autoSummary: aiConfig.autoSummary !== false,
        autoCategorize: aiConfig.autoCategorize !== false,
        aiQueueEnabled: aiConfig.aiQueueEnabled === true,
        lastTestedAt: aiConfig.lastTestedAt,
      };
    }),

  /**
   * 手动触发文章分析
   */
  triggerAnalysis: protectedProcedure
    .input(z.object({ entryId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 检查文章是否存在
      const entry = await db.entry.findUnique({
        where: { id: input.entryId },
        include: { feed: { select: { userId: true } } },
      });

      if (!entry) {
        throw new Error('文章不存在');
      }
      
      // 验证文章所有权
      if (entry.feed.userId !== ctx.userId) {
        throw new Error('无权操作此文章');
      }

      // 检查是否已在队列中
      const existingTask = await db.aIAnalysisQueue.findFirst({
        where: {
          entryId: input.entryId,
          status: { in: ['pending', 'processing'] },
        },
      });

      if (existingTask) {
        return { success: true, status: 'already_queued', taskId: existingTask.id };
      }

      // 添加到队列
      const task = await db.aIAnalysisQueue.create({
        data: {
          entryId: input.entryId,
          analysisType: 'all',
          priority: 3,
          status: 'pending',
        },
      });

      return { success: true, status: 'queued', taskId: task.id };
    }),

  /**
   * 获取 AI 分析队列状态
   * 数据隔离：只显示用户自己的 Feed 相关任务
   */
  aiQueueStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!;
      const userFeedIds = await getUserFeedIds(userId);

      // 如果用户没有订阅源，返回空数据
      if (userFeedIds.length === 0) {
        return {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          total: 0,
          recentTasks: [],
        };
      }

      const [pending, processing, completed, failed, recentTasks] = await Promise.all([
        db.aIAnalysisQueue.count({
          where: { status: 'pending', entry: { feedId: { in: userFeedIds } } }
        }),
        db.aIAnalysisQueue.count({
          where: { status: 'processing', entry: { feedId: { in: userFeedIds } } }
        }),
        db.aIAnalysisQueue.count({
          where: { status: 'completed', entry: { feedId: { in: userFeedIds } } }
        }),
        db.aIAnalysisQueue.count({
          where: { status: 'failed', entry: { feedId: { in: userFeedIds } } }
        }),
        // 获取最近的任务
        db.aIAnalysisQueue.findMany({
          where: {
            status: { in: ['pending', 'processing'] },
            entry: { feedId: { in: userFeedIds } },
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            entry: {
              select: {
                id: true,
                title: true,
                feed: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      return {
        pending,
        processing,
        completed,
        failed,
        total: pending + processing + completed + failed,
        recentTasks: recentTasks.map(task => ({
          id: task.id,
          entryId: task.entryId,
          entryTitle: task.entry.title,
          feedTitle: task.entry.feed.title,
          status: task.status,
          analysisType: task.analysisType,
          priority: task.priority,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          retryCount: task.retryCount,
          errorMessage: task.errorMessage,
        })),
      };
    }),

  /**
   * 获取调度器状态
   * 数据隔离：只显示用户自己的 Feed 统计
   */
  schedulerStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!;
      const scheduler = getScheduler();
      const status = scheduler.getStatus();

      // 获取待抓取的 Feed 数量（仅用户的）
      const feedsToUpdate = await db.feed.count({
        where: {
          userId,
          isActive: true,
          OR: [
            { nextFetchAt: null },
            { nextFetchAt: { lte: new Date() } },
          ],
        },
      });

      // 获取 Feed 统计（仅用户的）
      const [totalFeeds, activeFeeds, errorFeeds] = await Promise.all([
        db.feed.count({ where: { userId } }),
        db.feed.count({ where: { userId, isActive: true } }),
        db.feed.count({ where: { userId, errorCount: { gt: 0 } } }),
      ]);

      return {
        isRunning: status.isRunning,
        fetchInterval: status.fetchInterval,
        aiProcessInterval: status.aiProcessInterval,
        feedsToUpdate,
        totalFeeds,
        activeFeeds,
        errorFeeds,
      };
    }),

  /**
   * 获取系统概览状态
   * 数据隔离：只显示用户自己的数据
   */
  systemOverview: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!;
      const userFeedIds = await getUserFeedIds(userId);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 如果用户没有订阅源，返回空数据
      if (userFeedIds.length === 0) {
        return {
          entries: {
            total: 0,
            lastHour: 0,
            lastDay: 0,
            unread: 0,
            starred: 0,
          },
          queue: {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
          },
          feeds: {
            toUpdate: 0,
          },
          scheduler: getScheduler().getStatus(),
          timestamp: now.toISOString(),
        };
      }

      const [
        totalEntries,
        entriesLastHour,
        entriesLastDay,
        unreadEntries,
        starredEntries,
        aiQueueStatus,
        feedsToUpdate,
        schedulerStatus,
      ] = await Promise.all([
        db.entry.count({ where: { feedId: { in: userFeedIds } } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, createdAt: { gte: oneHourAgo } } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, createdAt: { gte: oneDayAgo } } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, isRead: false } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, isStarred: true } }),
        db.aIAnalysisQueue.groupBy({
          by: ['status'],
          where: { entry: { feedId: { in: userFeedIds } } },
          _count: { id: true },
        }),
        db.feed.count({
          where: {
            userId,
            isActive: true,
            OR: [
              { nextFetchAt: null },
              { nextFetchAt: { lte: now } },
            ],
          },
        }),
        getScheduler().getStatus(),
      ]);

      // 转换队列状态
      const queueStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };
      aiQueueStatus.forEach(item => {
        queueStats[item.status as keyof typeof queueStats] = item._count.id;
      });

      return {
        entries: {
          total: totalEntries,
          lastHour: entriesLastHour,
          lastDay: entriesLastDay,
          unread: unreadEntries,
          starred: starredEntries,
        },
        queue: queueStats,
        feeds: {
          toUpdate: feedsToUpdate,
        },
        scheduler: schedulerStatus,
        timestamp: now.toISOString(),
      };
    }),

  /**
   * 获取当前正在处理的任务
   * 数据隔离：只显示用户自己的 Feed 相关任务
   */
  activeTasks: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!;
      const userFeedIds = await getUserFeedIds(userId);

      // 如果用户没有订阅源，返回空数据
      if (userFeedIds.length === 0) {
        return [];
      }

      const tasks = await db.aIAnalysisQueue.findMany({
        where: {
          status: 'processing',
          entry: { feedId: { in: userFeedIds } },
        },
        orderBy: { startedAt: 'desc' },
        take: 5,
        include: {
          entry: {
            select: {
              id: true,
              title: true,
              feed: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      return tasks.map(task => ({
        id: task.id,
        entryId: task.entryId,
        entryTitle: task.entry.title,
        feedTitle: task.entry.feed.title,
        startedAt: task.startedAt,
        processingTime: task.startedAt ? Date.now() - task.startedAt.getTime() : 0,
      }));
    }),

  /**
   * 获取待更新的订阅源列表
   * 数据隔离：只显示用户自己的订阅源
   */
  feedsToUpdate: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
    }).optional())
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId!;
      const limit = input?.limit ?? 10;

      const feeds = await db.feed.findMany({
        where: {
          userId,
          isActive: true,
          OR: [
            { nextFetchAt: null },
            { nextFetchAt: { lte: new Date() } },
          ],
        },
        select: {
          id: true,
          title: true,
          feedUrl: true,
          siteUrl: true,
          iconUrl: true,
          lastFetchedAt: true,
          lastSuccessAt: true,
          nextFetchAt: true,
          errorCount: true,
          lastError: true,
          totalEntries: true,
          unreadCount: true,
          fetchInterval: true,
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: [
          { nextFetchAt: 'asc' },
          { lastFetchedAt: 'asc' },
        ],
        take: limit,
      });

      // 计算待更新时间
      const now = new Date();
      const feedsWithStatus = feeds.map(feed => {
        const lastFetch = feed.lastFetchedAt ? new Date(feed.lastFetchedAt) : null;
        const timeSinceLastFetch = lastFetch ? now.getTime() - lastFetch.getTime() : null;

        return {
          ...feed,
          timeSinceLastFetch,
          isOverdue: !feed.nextFetchAt || new Date(feed.nextFetchAt) <= now,
          hasError: feed.errorCount > 0,
        };
      });

      return feedsWithStatus;
    }),

  /**
   * 获取详细的系统监控数据
   * 数据隔离：只显示用户自己的数据
   */
  detailedMonitor: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!;
      const userFeedIds = await getUserFeedIds(userId);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 如果用户没有订阅源，返回空数据
      if (userFeedIds.length === 0) {
        return {
          feeds: {
            total: 0,
            active: 0,
            errors: 0,
            toUpdate: 0,
            recentlyFetched: 0,
            healthScore: 100,
          },
          entries: {
            total: 0,
            lastHour: 0,
            lastDay: 0,
            unread: 0,
            starred: 0,
          },
          queue: {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            total: 0,
            activeTasks: [],
          },
          scheduler: {
            isRunning: getScheduler().getStatus().isRunning,
            fetchInterval: getScheduler().getStatus().fetchInterval,
            aiProcessInterval: getScheduler().getStatus().aiProcessInterval,
          },
          health: {
            status: 'healthy',
            message: '系统运行正常',
          },
          timestamp: now.toISOString(),
        };
      }

      // 并行获取所有统计数据
      const [
        // Feed 统计
        totalFeeds,
        activeFeeds,
        errorFeeds,
        feedsToUpdate,
        recentlyFetchedFeeds,

        // 文章统计
        totalEntries,
        entriesLastHour,
        entriesLastDay,
        unreadEntries,
        starredEntries,

        // AI 队列统计
        aiQueueStats,
        processingTasks,

        // 数据库大小估算
        entryCount,
        feedCount,
        userCount,
      ] = await Promise.all([
        // Feed 统计（仅用户的）
        db.feed.count({ where: { userId } }),
        db.feed.count({ where: { userId, isActive: true } }),
        db.feed.count({ where: { userId, errorCount: { gt: 0 } } }),
        db.feed.count({
          where: {
            userId,
            isActive: true,
            OR: [
              { nextFetchAt: null },
              { nextFetchAt: { lte: now } },
            ],
          },
        }),
        db.feed.count({
          where: {
            userId,
            lastFetchedAt: { gte: oneHourAgo },
          },
        }),

        // 文章统计（仅用户的）
        db.entry.count({ where: { feedId: { in: userFeedIds } } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, createdAt: { gte: oneHourAgo } } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, createdAt: { gte: oneDayAgo } } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, isRead: false } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, isStarred: true } }),

        // AI 队列统计（仅用户的）
        db.aIAnalysisQueue.groupBy({
          by: ['status'],
          where: { entry: { feedId: { in: userFeedIds } } },
          _count: { id: true },
        }),
        db.aIAnalysisQueue.findMany({
          where: {
            status: 'processing',
            entry: { feedId: { in: userFeedIds } },
          },
          select: {
            id: true,
            startedAt: true,
            entry: {
              select: {
                id: true,
                title: true,
                feed: { select: { title: true } },
              },
            },
          },
          take: 3,
          orderBy: { startedAt: 'desc' },
        }),

        // 数据库统计（仅用户的）
        db.entry.count({ where: { feedId: { in: userFeedIds } } }),
        db.feed.count({ where: { userId } }),
        db.user.count({ where: { id: userId } }),
      ]);

      // 转换队列状态
      const queueStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };
      aiQueueStats.forEach(item => {
        queueStats[item.status as keyof typeof queueStats] = item._count.id;
      });

      // 获取调度器状态
      const schedulerStatus = getScheduler().getStatus();

      // 计算处理中任务的耗时
      const activeTasks = processingTasks.map(task => ({
        id: task.id,
        entryTitle: task.entry.title,
        feedTitle: task.entry.feed.title,
        processingTime: task.startedAt ? now.getTime() - task.startedAt.getTime() : 0,
      }));

      return {
        // Feed 状态
        feeds: {
          total: totalFeeds,
          active: activeFeeds,
          errors: errorFeeds,
          toUpdate: feedsToUpdate,
          recentlyFetched: recentlyFetchedFeeds,
          healthScore: totalFeeds > 0 ? Math.round((activeFeeds - errorFeeds) / totalFeeds * 100) : 100,
        },

        // 文章状态
        entries: {
          total: totalEntries,
          lastHour: entriesLastHour,
          lastDay: entriesLastDay,
          unread: unreadEntries,
          starred: starredEntries,
        },

        // AI 队列状态
        queue: {
          ...queueStats,
          total: queueStats.pending + queueStats.processing + queueStats.completed + queueStats.failed,
          activeTasks,
        },

        // 调度器状态
        scheduler: {
          isRunning: schedulerStatus.isRunning,
          fetchInterval: schedulerStatus.fetchInterval,
          aiProcessInterval: schedulerStatus.aiProcessInterval,
        },

        // 系统健康状态
        health: {
          status: errorFeeds > totalFeeds * 0.3 ? 'warning' : 'healthy',
          message: errorFeeds > totalFeeds * 0.3
            ? `${errorFeeds} 个订阅源存在错误`
            : '系统运行正常',
        },

        // 时间戳
        timestamp: now.toISOString(),
      };
    }),
});
