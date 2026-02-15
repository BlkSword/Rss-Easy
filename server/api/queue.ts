/**
 * 队列状态 API
 * 提供实时队列监控信息
 */

import { router, publicProcedure, protectedProcedure } from '../trpc/init';
import { db } from '@/lib/db';
import { getScheduler } from '@/lib/jobs/scheduler';
import { z } from 'zod';
import { safeDecrypt } from '@/lib/crypto/encryption';

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
   */
  aiQueueStatus: protectedProcedure
    .query(async () => {
      const [pending, processing, completed, failed, recentTasks] = await Promise.all([
        db.aIAnalysisQueue.count({ where: { status: 'pending' } }),
        db.aIAnalysisQueue.count({ where: { status: 'processing' } }),
        db.aIAnalysisQueue.count({ where: { status: 'completed' } }),
        db.aIAnalysisQueue.count({ where: { status: 'failed' } }),
        // 获取最近的任务
        db.aIAnalysisQueue.findMany({
          where: {
            status: { in: ['pending', 'processing'] },
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
   */
  schedulerStatus: protectedProcedure
    .query(async () => {
      const scheduler = getScheduler();
      const status = scheduler.getStatus();

      // 获取待抓取的 Feed 数量
      const feedsToUpdate = await db.feed.count({
        where: {
          isActive: true,
          OR: [
            { nextFetchAt: null },
            { nextFetchAt: { lte: new Date() } },
          ],
        },
      });

      // 获取 Feed 统计
      const [totalFeeds, activeFeeds, errorFeeds] = await Promise.all([
        db.feed.count(),
        db.feed.count({ where: { isActive: true } }),
        db.feed.count({ where: { errorCount: { gt: 0 } } }),
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
   */
  systemOverview: protectedProcedure
    .query(async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
        db.entry.count(),
        db.entry.count({ where: { createdAt: { gte: oneHourAgo } } }),
        db.entry.count({ where: { createdAt: { gte: oneDayAgo } } }),
        db.entry.count({ where: { isRead: false } }),
        db.entry.count({ where: { isStarred: true } }),
        db.aIAnalysisQueue.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        db.feed.count({
          where: {
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
   */
  activeTasks: protectedProcedure
    .query(async () => {
      const tasks = await db.aIAnalysisQueue.findMany({
        where: {
          status: 'processing',
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
   */
  feedsToUpdate: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 10;

      const feeds = await db.feed.findMany({
        where: {
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
   */
  detailedMonitor: protectedProcedure
    .query(async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
        // Feed 统计
        db.feed.count(),
        db.feed.count({ where: { isActive: true } }),
        db.feed.count({ where: { errorCount: { gt: 0 } } }),
        db.feed.count({
          where: {
            isActive: true,
            OR: [
              { nextFetchAt: null },
              { nextFetchAt: { lte: now } },
            ],
          },
        }),
        db.feed.count({
          where: {
            lastFetchedAt: { gte: oneHourAgo },
          },
        }),

        // 文章统计
        db.entry.count(),
        db.entry.count({ where: { createdAt: { gte: oneHourAgo } } }),
        db.entry.count({ where: { createdAt: { gte: oneDayAgo } } }),
        db.entry.count({ where: { isRead: false } }),
        db.entry.count({ where: { isStarred: true } }),

        // AI 队列统计
        db.aIAnalysisQueue.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        db.aIAnalysisQueue.findMany({
          where: { status: 'processing' },
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

        // 数据库统计
        db.entry.count(),
        db.feed.count(),
        db.user.count(),
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
