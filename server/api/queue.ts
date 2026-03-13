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
import { getFeedDiscoveryQueueStatus } from '@/lib/queue/feed-discovery-processor';
import {
  getQueueStatus as getPreliminaryQueueStatus,
  addPreliminaryJob,
  getJobState as getPreliminaryJobState,
} from '@/lib/queue/preliminary-processor';
import {
  getQueueStatus as getDeepAnalysisQueueStatus,
  getJobState as getDeepAnalysisJobState,
} from '@/lib/queue/deep-analysis-processor';

// 详细监控返回类型
interface DetailedMonitorResult {
  feeds: {
    total: number;
    active: number;
    successful: number;
    errors: number;
    toUpdate: number;
    recentlyFetched: number;
    healthScore: number;
  };
  entries: {
    total: number;
    lastHour: number;
    lastDay: number;
    unread: number;
    starred: number;
  };
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
    activeTasks: Array<{
      id: string;
      entryTitle: string;
      feedTitle: string;
      processingTime: number;
    }>;
  };
  scheduler: {
    isRunning: boolean;
    fetchInterval: number;
    aiProcessInterval: number;
  };
  health: {
    status: 'healthy' | 'warning';
    message: string;
  };
  timestamp: string;
}

// BullMQ 队列状态类型
interface BullMQQueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

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

      // 检查用户 AI 配置（优先检查，用于所有分支）
      const user = await db.user.findUnique({
        where: { id: ctx.userId! },
        select: { aiConfig: true },
      });

      const aiConfig = (user?.aiConfig as any) || {};
      const hasUserApiKey = !!aiConfig.apiKey;

      // 验证环境变量 API Key 是否有效（排除占位符）
      const isValidApiKey = (key: string | undefined): boolean => {
        if (!key) return false;
        const invalidPatterns = [
          /^sk-xxx/i,
          /^sk-ant-xxx/i,
          /^your-.*-key/i,
          /^xxx+/i,
          /^placeholder/i,
          /^test/i,
          /^example/i,
          /^change-?me/i,
        ];
        if (key.length < 20) return false;
        return !invalidPatterns.some(pattern => pattern.test(key));
      };

      const hasEnvApiKey = isValidApiKey(process.env.OPENAI_API_KEY) ||
                           isValidApiKey(process.env.ANTHROPIC_API_KEY) ||
                           isValidApiKey(process.env.DEEPSEEK_API_KEY) ||
                           isValidApiKey(process.env.GEMINI_API_KEY);

      const hasApiKey = hasUserApiKey || hasEnvApiKey;
      const autoSummary = aiConfig.autoSummary !== false; // 默认开启

      // configValid 必须是明确的 true（用户已测试通过）
      // 环境变量配置不再默认有效
      const hasExplicitUserConfig = hasUserApiKey || !!aiConfig.provider;
      const configValid = hasExplicitUserConfig
        ? aiConfig.configValid === true
        : false; // 环境变量配置不再默认有效

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

      // AI 未配置时，直接返回 no_config，不检查队列状态
      if (!hasApiKey || !configValid) {
        return {
          status: 'not_analyzed',
          reason: 'no_config',
          hasApiKey,
          configValid,
          autoSummary,
          articleAge: Date.now() - entry.createdAt.getTime(),
        };
      }

      // 检查是否在 BullMQ 队列中（初评或深度分析）
      // 由于 BullMQ 的 job ID 不直接对应 entryId，我们通过数据库的初评状态字段判断
      const entryWithPrelim = await db.entry.findUnique({
        where: { id: input.entryId },
        select: {
          aiPrelimStatus: true,
          aiPrelimAnalyzedAt: true,
          aiAnalyzedAt: true,
        },
      });

      // 如果初评状态为 pending 或 passed 但没有深度分析，可能在队列中
      if (entryWithPrelim?.aiPrelimStatus === 'pending') {
        return {
          status: 'pending' as const,
          queuePosition: undefined, // BullMQ 不直接支持位置查询
          errorMessage: undefined,
          retryCount: 0,
        };
      }

      // 如果已通过初评但没有深度分析，可能在深度分析队列中
      if (entryWithPrelim?.aiPrelimStatus === 'passed' && !entryWithPrelim.aiAnalyzedAt) {
        return {
          status: 'pending' as const, // 深度分析队列中等待
          queuePosition: undefined,
          errorMessage: undefined,
          retryCount: 0,
        };
      }

      // 判断原因
      let reason: 'not_queued' | 'old_article' = 'not_queued';

      if (entry.createdAt < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
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

      // 检查用户配置的 API Key
      const hasUserApiKey = !!aiConfig.apiKey;

      // 检查环境变量中的 API Key（必须是有效的真实密钥，不是占位符）
      const isValidApiKey = (key: string | undefined): boolean => {
        if (!key) return false;
        // 排除常见的占位符模式
        const invalidPatterns = [
          /^sk-xxx/i,
          /^sk-ant-xxx/i,
          /^your-.*-key/i,
          /^xxx+/i,
          /^placeholder/i,
          /^test/i,
          /^example/i,
          /^change-?me/i,
        ];
        // 密钥长度至少 20 个字符才算有效
        if (key.length < 20) return false;
        return !invalidPatterns.some(pattern => pattern.test(key));
      };

      const envOpenAI = process.env.OPENAI_API_KEY;
      const envAnthropic = process.env.ANTHROPIC_API_KEY;
      const envDeepSeek = process.env.DEEPSEEK_API_KEY;
      const envGemini = process.env.GEMINI_API_KEY;

      const hasEnvApiKey = isValidApiKey(envOpenAI) ||
                           isValidApiKey(envAnthropic) ||
                           isValidApiKey(envDeepSeek) ||
                           isValidApiKey(envGemini);

      // 获取当前提供商
      const provider = aiConfig.provider || process.env.AI_PROVIDER || 'openai';
      const model = aiConfig.model || process.env.AI_MODEL;

      // configValid 必须是明确的 true（用户已测试通过）
      // 环境变量的 API Key 不再默认有效，必须经过测试验证
      const hasExplicitUserConfig = hasUserApiKey || !!aiConfig.provider;
      const configValid = hasExplicitUserConfig
        ? aiConfig.configValid === true
        : false; // 环境变量配置不再默认有效，需要用户在界面上测试

      return {
        hasApiKey: hasUserApiKey || hasEnvApiKey,
        hasUserApiKey,
        hasEnvApiKey,
        provider,
        model,
        configValid,
        autoSummary: aiConfig.autoSummary !== false,
        autoCategorize: aiConfig.autoCategorize !== false,
        aiQueueEnabled: aiConfig.aiQueueEnabled === true,
        lastTestedAt: aiConfig.lastTestedAt,
      };
    }),

  /**
   * 手动触发文章分析
   * 使用 BullMQ 初评队列
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

      // 检查是否已有分析结果
      if (entry.aiSummary || entry.aiAnalyzedAt) {
        return {
          success: true,
          status: 'already_analyzed',
          message: '文章已完成 AI 分析',
        };
      }

      // 检查是否已在初评队列中（通过数据库状态判断）
      if (entry.aiPrelimStatus === 'pending') {
        return {
          success: true,
          status: 'already_queued',
          message: '文章已在分析队列中',
        };
      }

      // 添加到 BullMQ 初评队列
      const jobId = await addPreliminaryJob({
        entryId: input.entryId,
        userId: ctx.userId,
        priority: 3, // 手动触发优先级较高
        forceReanalyze: true, // 强制重新分析
      });

      return {
        success: true,
        status: 'queued',
        taskId: jobId,
        message: 'AI 分析已加入队列',
      };
    }),

  /**
   * 获取 AI 分析队列状态
   * 使用 BullMQ 队列状态（初评 + 深度分析）
   */
  aiQueueStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!;

      try {
        // 获取 BullMQ 队列状态
        const [preliminaryStatus, deepAnalysisStatus] = await Promise.all([
          getPreliminaryQueueStatus(),
          getDeepAnalysisQueueStatus(),
        ]);

        // 合并两个队列的状态
        const totalPending = preliminaryStatus.waiting + deepAnalysisStatus.waiting;
        const totalActive = preliminaryStatus.active + deepAnalysisStatus.active;
        const totalCompleted = preliminaryStatus.completed + deepAnalysisStatus.completed;
        const totalFailed = preliminaryStatus.failed + deepAnalysisStatus.failed;

        // 获取用户待分析的文章数（从数据库查询）
        const userFeedIds = await getUserFeedIds(userId);

        // 获取用户自己的文章分析状态统计
        const [userPendingCount, userCompletedCount] = userFeedIds.length > 0
          ? await Promise.all([
              db.entry.count({
                where: {
                  feedId: { in: userFeedIds },
                  content: { not: null },
                  aiPrelimStatus: null, // 未初评
                },
              }),
              db.entry.count({
                where: {
                  feedId: { in: userFeedIds },
                  aiAnalyzedAt: { not: null }, // 已深度分析
                },
              }),
            ])
          : [0, 0];

        return {
          // BullMQ 队列状态
          preliminary: {
            waiting: preliminaryStatus.waiting,
            active: preliminaryStatus.active,
            completed: preliminaryStatus.completed,
            failed: preliminaryStatus.failed,
            delayed: preliminaryStatus.delayed,
          },
          deepAnalysis: {
            waiting: deepAnalysisStatus.waiting,
            active: deepAnalysisStatus.active,
            completed: deepAnalysisStatus.completed,
            failed: deepAnalysisStatus.failed,
            delayed: deepAnalysisStatus.delayed,
          },
          // 汇总统计
          pending: totalPending,
          processing: totalActive,
          completed: totalCompleted,
          failed: totalFailed,
          total: totalPending + totalActive + totalCompleted + totalFailed,
          // 用户相关统计
          userStats: {
            pendingEntries: userPendingCount,
            completedEntries: userCompletedCount,
          },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error('获取队列状态失败:', error);
        return {
          preliminary: null,
          deepAnalysis: null,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          total: 0,
          userStats: {
            pendingEntries: 0,
            completedEntries: 0,
          },
          timestamp: new Date().toISOString(),
          error: '无法连接到 Redis 队列',
        };
      }
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
        bullMQStatus,
        feedsToUpdate,
        schedulerStatus,
      ] = await Promise.all([
        db.entry.count({ where: { feedId: { in: userFeedIds } } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, createdAt: { gte: oneHourAgo } } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, createdAt: { gte: oneDayAgo } } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, isRead: false } }),
        db.entry.count({ where: { feedId: { in: userFeedIds }, isStarred: true } }),
        // 使用 BullMQ 队列状态替代数据库查询
        Promise.all([
          getPreliminaryQueueStatus(),
          getDeepAnalysisQueueStatus(),
        ]).catch(() => [null, null]),
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

      // 解析 BullMQ 队列状态
      const [prelimStatus, deepStatus] = bullMQStatus;
      const queueStats = {
        pending: (prelimStatus?.waiting || 0) + (deepStatus?.waiting || 0),
        processing: (prelimStatus?.active || 0) + (deepStatus?.active || 0),
        completed: (prelimStatus?.completed || 0) + (deepStatus?.completed || 0),
        failed: (prelimStatus?.failed || 0) + (deepStatus?.failed || 0),
      };

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
   * 由于 BullMQ 不支持按用户过滤，这里通过数据库状态字段判断
   */
  activeTasks: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!;
      const userFeedIds = await getUserFeedIds(userId);

      // 如果用户没有订阅源，返回空数据
      if (userFeedIds.length === 0) {
        return [];
      }

      // 通过数据库字段查询正在处理的文章
      // aiPrelimStatus = 'pending' 表示在初评队列中
      // aiAnalyzedAt 为 null 但 aiPrelimStatus = 'passed' 表示在深度分析队列中
      const processingEntries = await db.entry.findMany({
        where: {
          feedId: { in: userFeedIds },
          OR: [
            { aiPrelimStatus: 'pending' },
            {
              aiPrelimStatus: 'passed',
              aiAnalyzedAt: null,
              aiPrelimAnalyzedAt: { not: null },
            },
          ],
        },
        orderBy: { aiPrelimAnalyzedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          aiPrelimStatus: true,
          aiPrelimAnalyzedAt: true,
          feed: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return processingEntries.map(entry => ({
        id: entry.id,
        entryId: entry.id,
        entryTitle: entry.title,
        feedTitle: entry.feed.title,
        startedAt: entry.aiPrelimAnalyzedAt,
        processingTime: entry.aiPrelimAnalyzedAt
          ? Date.now() - entry.aiPrelimAnalyzedAt.getTime()
          : 0,
        phase: entry.aiPrelimStatus === 'pending' ? 'preliminary' : 'deep-analysis',
      }));
    }),

  /**
   * 获取待更新的订阅源列表
   * 数据隔离：只显示用户自己的订阅源
   */
  feedsToUpdate: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input, ctx }) => {
      const userId = ctx.userId!;
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

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
          { errorCount: 'desc' }, // 有错误的优先显示
          { nextFetchAt: 'asc' },
          { lastFetchedAt: 'asc' },
        ],
        skip: offset,
        take: limit,
      });

      // 获取总数
      const total = await db.feed.count({
        where: {
          userId,
          isActive: true,
          OR: [
            { nextFetchAt: null },
            { nextFetchAt: { lte: new Date() } },
          ],
        },
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

      return {
        feeds: feedsWithStatus,
        total,
        hasMore: offset + feeds.length < total,
      };
    }),

  /**
   * 获取详细的系统监控数据
   * 数据隔离：只显示用户自己的数据
   */
  detailedMonitor: protectedProcedure
    .query(async ({ ctx }): Promise<DetailedMonitorResult> => {
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
            successful: 0,
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
        successfulFeeds,
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
        db.feed.count({ where: { userId, lastSuccessAt: { gte: sevenDaysAgo } } }),
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

        // BullMQ 队列状态
        Promise.all([
          getPreliminaryQueueStatus(),
          getDeepAnalysisQueueStatus(),
        ]).catch(() => [null, null]),

        // 通过数据库查询正在处理的文章（用于显示任务详情）
        db.entry.findMany({
          where: {
            feedId: { in: userFeedIds },
            OR: [
              { aiPrelimStatus: 'pending' },
              {
                aiPrelimStatus: 'passed',
                aiAnalyzedAt: null,
                aiPrelimAnalyzedAt: { not: null },
              },
            ],
          },
          select: {
            id: true,
            title: true,
            aiPrelimStatus: true,
            aiPrelimAnalyzedAt: true,
            feed: {
              select: { title: true },
            },
          },
          take: 3,
          orderBy: { aiPrelimAnalyzedAt: 'desc' },
        }),

        // 数据库统计（仅用户的）
        db.entry.count({ where: { feedId: { in: userFeedIds } } }),
        db.feed.count({ where: { userId } }),
        db.user.count({ where: { id: userId } }),
      ]);

      // 解析 BullMQ 队列状态
      const [prelimStatus, deepStatus] = aiQueueStats || [null, null];
      const queueStats = {
        pending: (prelimStatus?.waiting || 0) + (deepStatus?.waiting || 0),
        processing: (prelimStatus?.active || 0) + (deepStatus?.active || 0),
        completed: (prelimStatus?.completed || 0) + (deepStatus?.completed || 0),
        failed: (prelimStatus?.failed || 0) + (deepStatus?.failed || 0),
      };

      // 获取调度器状态
      const schedulerStatus = getScheduler().getStatus();

      // 计算正在处理的文章
      const activeTasksList = processingTasks.map(entry => ({
        id: entry.id,
        entryTitle: entry.title,
        feedTitle: entry.feed.title,
        startedAt: entry.aiPrelimAnalyzedAt,
        processingTime: entry.aiPrelimAnalyzedAt
          ? now.getTime() - entry.aiPrelimAnalyzedAt.getTime()
          : 0,
        phase: entry.aiPrelimStatus === 'pending' ? 'preliminary' : 'deep-analysis',
      }));

      return {
        // Feed 状态
        feeds: {
          total: totalFeeds,
          active: activeFeeds,
          successful: successfulFeeds,
          errors: errorFeeds,
          toUpdate: feedsToUpdate,
          recentlyFetched: recentlyFetchedFeeds,
          healthScore: totalFeeds > 0 ? Math.round((successfulFeeds) / totalFeeds * 100) : 100,
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
          activeTasks: processingTasks.map(entry => ({
            id: entry.id,
            entryTitle: entry.title,
            feedTitle: entry.feed.title,
            startedAt: entry.aiPrelimAnalyzedAt,
            processingTime: entry.aiPrelimAnalyzedAt
              ? now.getTime() - entry.aiPrelimAnalyzedAt.getTime()
              : 0,
            phase: entry.aiPrelimStatus === 'pending' ? 'preliminary' : 'deep-analysis',
          })),
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

  /**
   * 获取 BullMQ 队列状态
   * 包括 feed-discovery、preliminary、deep-analysis 队列
   */
  bullMQStatus: protectedProcedure
    .query(async () => {
      try {
        // 并行获取所有 BullMQ 队列状态
        const [feedDiscovery, preliminary, deepAnalysis] = await Promise.all([
          getFeedDiscoveryQueueStatus().catch(() => null),
          getPreliminaryQueueStatus().catch(() => null),
          getDeepAnalysisQueueStatus().catch(() => null),
        ]);

        return {
          feedDiscovery: feedDiscovery ? {
            waiting: feedDiscovery.waiting,
            active: feedDiscovery.active,
            completed: feedDiscovery.completed,
            failed: feedDiscovery.failed,
            delayed: feedDiscovery.delayed,
          } : null,
          preliminary: preliminary ? {
            waiting: preliminary.waiting,
            active: preliminary.active,
            completed: preliminary.completed,
            failed: preliminary.failed,
            delayed: preliminary.delayed,
          } : null,
          deepAnalysis: deepAnalysis ? {
            waiting: deepAnalysis.waiting,
            active: deepAnalysis.active,
            completed: deepAnalysis.completed,
            failed: deepAnalysis.failed,
            delayed: deepAnalysis.delayed,
          } : null,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error('Failed to get BullMQ status:', error);
        return {
          feedDiscovery: null,
          preliminary: null,
          deepAnalysis: null,
          timestamp: new Date().toISOString(),
          error: 'Failed to connect to Redis',
        };
      }
    }),
});
