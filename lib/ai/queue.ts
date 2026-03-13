/**
 * AI分析队列处理器（已废弃）
 *
 * @deprecated 此文件已废弃，请使用 BullMQ 队列系统：
 *   - 初评队列: lib/queue/preliminary-processor.ts
 *   - 深度分析队列: lib/queue/deep-analysis-processor.ts
 *   - 订阅源发现队列: lib/queue/feed-discovery-processor.ts
 *
 * 新系统使用 BullMQ + Redis，支持分布式处理和更好的监控。
 * 保留此文件仅供参考，不应在新代码中使用。
 *
 * 改进的速率限制和并发控制：
 * 1. 按用户速率限制 - 防止单个用户触发API限流
 * 2. 按提供商并发控制 - 不同AI提供商有不同的限制
 * 3. 任务间隔控制 - 避免连续请求触发限流
 * 4. 数据库行锁 - 防止竞态条件
 */

import { db } from '../db';
import { AIService, type AIConfig } from './client';
import { sleep } from '../utils';
import { getNotificationService } from '../notifications/service';
import { info, warn, error as logError } from '../logger';
import type { Entry, Feed, User } from '@prisma/client';
import type { AIAnalysisQueue as AIAnalysisQueueModel } from '@prisma/client';
import { safeDecrypt } from '../crypto/encryption';

// 任务类型，包含嵌套的关系
type TaskWithRelations = AIAnalysisQueueModel & {
  entry: Entry & {
    feed: Feed & {
      user: Pick<User, 'aiConfig' | 'id'> | null;
    };
  };
};

export interface QueueOptions {
  concurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
  taskIntervalMs?: number; // 任务之间的最小间隔
  userRateLimitWindowMs?: number; // 用户速率限制窗口
  userMaxRequestsPerWindow?: number; // 每个窗口内最大请求数
}

// 用户请求计数器（用于速率限制）
interface UserRequestCounter {
  count: number;
  windowStart: number;
}

/**
 * AI分析队列处理器
 */
export class AIAnalysisQueue {
  private processing = false;
  private concurrency: number;
  private retryDelay: number;
  private maxRetries: number;
  private taskIntervalMs: number;
  private userRateLimitWindowMs: number;
  private userMaxRequestsPerWindow: number;
  
  // 速率限制追踪
  private userRequestCounters: Map<string, UserRequestCounter> = new Map();
  private lastTaskEndTime: number = 0;
  private activeTasks: Set<string> = new Set(); // 正在处理的任务ID

  constructor(options: QueueOptions = {}) {
    this.concurrency = options.concurrency || 3;
    this.retryDelay = options.retryDelay || 5000;
    this.maxRetries = options.maxRetries || 3;
    this.taskIntervalMs = options.taskIntervalMs || 1000; // 默认1秒间隔
    this.userRateLimitWindowMs = options.userRateLimitWindowMs || 60000; // 默认1分钟窗口
    this.userMaxRequestsPerWindow = options.userMaxRequestsPerWindow || 30; // 默认每分钟30个请求
  }

  /**
   * 检查用户是否超出速率限制
   */
  private checkUserRateLimit(userId: string): boolean {
    const now = Date.now();
    const counter = this.userRequestCounters.get(userId);

    if (!counter) {
      // 首次请求
      this.userRequestCounters.set(userId, { count: 1, windowStart: now });
      return true;
    }

    // 检查窗口是否过期
    if (now - counter.windowStart > this.userRateLimitWindowMs) {
      // 重置窗口
      counter.count = 1;
      counter.windowStart = now;
      return true;
    }

    // 检查是否超出限制
    if (counter.count >= this.userMaxRequestsPerWindow) {
      return false;
    }

    // 增加计数
    counter.count++;
    return true;
  }

  /**
   * 检测错误是否是 API 速率限制错误
   */
  private isRateLimitError(errorMessage: string): boolean {
    const rateLimitKeywords = [
      'rate limit',
      'ratelimit',
      'too many requests',
      '429',
      'quota exceeded',
      'insufficient quota',
      'limit exceeded',
      'throttled',
      '请求过于频繁',
      '超出限制',
      '配额不足',
    ];
    
    const lowerMessage = errorMessage.toLowerCase();
    return rateLimitKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
  }

  /**
   * 等待任务间隔
   */
  private async waitForTaskInterval(): Promise<void> {
    const now = Date.now();
    const timeSinceLastTask = now - this.lastTaskEndTime;
    
    if (timeSinceLastTask < this.taskIntervalMs) {
      const waitTime = this.taskIntervalMs - timeSinceLastTask;
      await sleep(waitTime);
    }
  }

  /**
   * 启动队列处理器
   */
  async start(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    console.log('🔧 [Queue] AI分析队列启动, concurrency:', this.concurrency);
    console.log(`⏱️  [Queue] 任务间隔: ${this.taskIntervalMs}ms, 用户速率限制: ${this.userMaxRequestsPerWindow}/${this.userRateLimitWindowMs}ms`);
    await info('queue', 'AI分析队列启动', { 
      concurrency: this.concurrency,
      taskIntervalMs: this.taskIntervalMs,
      userRateLimit: `${this.userMaxRequestsPerWindow}/${this.userRateLimitWindowMs}ms`
    });

    while (this.processing) {
      try {
        // 清理过期的速率限制计数器
        this.cleanupExpiredCounters();

        // 获取待处理任务，使用 FOR UPDATE 锁防止竞态条件
        const tasks = await this.getPendingTasksWithLock(this.concurrency);

        if (tasks.length === 0) {
          console.log('⏳ [Queue] 暂无待处理任务，等待中...');
          await sleep(5000); // 没有任务时等待5秒
          continue;
        }

        console.log(`🚀 [Queue] 发现 ${tasks.length} 个待处理任务，开始处理...`);
        await info('queue', '开始批量处理AI任务', { count: tasks.length });

        // 串行处理任务，确保速率限制生效
        // 如果需要并发，使用受控的并发
        for (const task of tasks) {
          if (!this.processing) break;
          
          const userId = task.entry.feed.user?.id;
          if (userId && !this.checkUserRateLimit(userId)) {
            console.log(`⏸️  [Queue] 用户 ${userId} 超出速率限制，跳过任务 ${task.id}`);
            // 将任务重新标记为 pending，延迟处理
            await this.delayTask(task.id, this.userRateLimitWindowMs / 2);
            continue;
          }

          // 等待任务间隔
          await this.waitForTaskInterval();

          // 处理任务
          await this.processTaskWithTracking(task);
        }
      } catch (err) {
        console.error('❌ [Queue] 队列处理器错误:', err);
        await logError('queue', '队列处理器错误', err instanceof Error ? err : undefined);
        await sleep(10000); // 出错后等待10秒
      }
    }
  }

  /**
   * 清理过期的速率限制计数器
   */
  private cleanupExpiredCounters(): void {
    const now = Date.now();
    for (const [userId, counter] of this.userRequestCounters.entries()) {
      if (now - counter.windowStart > this.userRateLimitWindowMs) {
        this.userRequestCounters.delete(userId);
      }
    }
  }

  /**
   * 延迟任务执行
   */
  private async delayTask(taskId: string, delayMs: number): Promise<void> {
    const nextRetryAt = new Date(Date.now() + delayMs);
    await db.aIAnalysisQueue.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        nextRetryAt,
      },
    });
  }

  /**
   * 带追踪的任务处理
   */
  private async processTaskWithTracking(task: TaskWithRelations): Promise<void> {
    // 检查任务是否已经在处理中（防止重复处理）
    if (this.activeTasks.has(task.id)) {
      console.log(`⚠️  [Queue] 任务 ${task.id} 已在处理中，跳过`);
      return;
    }

    this.activeTasks.add(task.id);
    
    try {
      await this.processTask(task);
    } finally {
      this.activeTasks.delete(task.id);
      this.lastTaskEndTime = Date.now();
    }
  }

  /**
   * 获取待处理任务（带数据库锁）
   * 使用事务和 FOR UPDATE 锁防止多个实例同时获取同一任务
   */
  private async getPendingTasksWithLock(limit: number): Promise<TaskWithRelations[]> {
    // 使用事务和行级锁获取任务
    return await db.$transaction(async (tx) => {
      // 首先查找待处理的任务ID
      const pendingTasks = await tx.aIAnalysisQueue.findMany({
        where: {
          status: 'pending',
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: new Date() } },
          ],
        },
        take: limit,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        select: { id: true },
      });

      if (pendingTasks.length === 0) {
        return [];
      }

      // 锁定这些任务（标记为 processing）
      const taskIds = pendingTasks.map(t => t.id);
      await tx.aIAnalysisQueue.updateMany({
        where: { id: { in: taskIds } },
        data: { 
          status: 'processing',
          startedAt: new Date(),
        },
      });

      // 返回完整的任务数据
      return tx.aIAnalysisQueue.findMany({
        where: { id: { in: taskIds } },
        include: {
          entry: {
            include: {
              feed: {
                include: {
                  user: {
                    select: {
                      id: true,
                      aiConfig: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    }, {
      isolationLevel: 'Serializable', // 最高隔离级别，防止竞态条件
      maxWait: 5000, // 最多等待5秒获取锁
      timeout: 10000, // 事务超时10秒
    });
  }

  /**
   * 停止队列处理器
   */
  stop(): void {
    this.processing = false;
  }

  /**
   * 处理单个任务
   */
  private async processTask(task: TaskWithRelations): Promise<void> {
    const startTime = Date.now();

    // 任务已经在获取时标记为 processing，这里不需要重复标记
    await info('ai', 'AI分析任务开始', {
      taskId: task.id,
      entryId: task.entryId,
      analysisType: task.analysisType,
      entryTitle: task.entry.title,
      userId: task.entry.feed.user?.id,
    });

    console.log(`🔧 [Queue] 开始处理任务 ${task.id}, 文章: ${task.entry.title}`);

    try {
      // 获取AI配置
      const aiConfig = (task.entry.feed.user?.aiConfig as any) as AIConfig | undefined;
      const configValid = (task.entry.feed.user?.aiConfig as any)?.configValid === true;

      if (!aiConfig || !configValid) {
        throw new Error('AI configuration not found or invalid');
      }

      const provider = aiConfig?.provider || 'openai';
      const model = aiConfig?.model || 'gpt-4o';

      // 解密 apiKey（如果存在）
      let decryptedApiKey: string | undefined;
      if (aiConfig.apiKey) {
        decryptedApiKey = safeDecrypt(aiConfig.apiKey);
      }

      // 创建 AI 服务
      const serviceConfig: AIConfig = {
        provider,
        model,
        maxTokens: aiConfig?.maxTokens || 2000,
        temperature: aiConfig?.temperature || 0.7,
        baseURL: aiConfig?.baseURL,
      };

      // 只有当有 apiKey 时才添加（Ollama 不需要）
      if (decryptedApiKey && provider !== 'ollama') {
        serviceConfig.apiKey = decryptedApiKey;
      }

      const service = new AIService(serviceConfig);

      // 执行分析
      const result = await service.analyzeArticle(
        task.entry.content || task.entry.summary || '',
        {
          summary: task.analysisType === 'all' || task.analysisType === 'summary',
          keywords: task.analysisType === 'all' || task.analysisType === 'keywords',
          category: task.analysisType === 'all' || task.analysisType === 'category',
          sentiment: task.analysisType === 'all' || task.analysisType === 'sentiment',
          importance: true,
        }
      );

      // 验证结果：确保至少有一个分析成功
      const hasValidResult =
        result.summary ||
        (result.keywords && result.keywords.length > 0) ||
        result.category ||
        result.sentiment !== undefined ||
        result.importanceScore !== undefined;

      if (!hasValidResult) {
        throw new Error('AI analysis returned no valid results');
      }

      // 只更新成功的字段
      const updateData: any = {};
      if (result.summary) updateData.aiSummary = result.summary;
      if (result.keywords && result.keywords.length > 0) updateData.aiKeywords = result.keywords;
      if (result.category) updateData.aiCategory = result.category;
      if (result.sentiment) updateData.aiSentiment = result.sentiment;
      if (result.importanceScore !== undefined) updateData.aiImportanceScore = result.importanceScore;

      // 更新文章
      await db.entry.update({
        where: { id: task.entryId },
        data: updateData,
      });

      const duration = Date.now() - startTime;
      console.log(`✅ [Queue] 任务 ${task.id} 完成, 耗时: ${duration}ms`);

      // 标记任务完成
      await db.aIAnalysisQueue.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          provider: aiConfig?.provider,
          model: aiConfig?.model,
          totalTokens: result.tokensUsed,
          cost: result.cost,
        },
      });

      // 记录详细日志
      await info('ai', '文章AI分析完成', {
        taskId: task.id,
        entryId: task.entryId,
        analysisType: task.analysisType,
        provider,
        model,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        duration: duration,
        hasSummary: !!result.summary,
        hasKeywords: !!(result.keywords && result.keywords.length > 0),
        hasCategory: !!result.category,
        hasSentiment: !!result.sentiment,
        hasImportance: result.importanceScore !== undefined
      });

      // 发送AI分析完成通知
      const notificationService = getNotificationService();
      await notificationService.notifyAIComplete(
        task.entry.feed.userId,
        task.entry.id,
        task.entry.title
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const retryCount = task.retryCount + 1;
      const errorObj = error instanceof Error ? error : undefined;

      // 检测是否是 API 速率限制错误
      const isRateLimitError = this.isRateLimitError(errorMessage);
      const isTimeoutError = errorMessage.includes('timeout') || errorMessage.includes('超时');

      await logError('ai', 'AI分析任务失败', errorObj, {
        taskId: task.id,
        entryId: task.entryId,
        entryTitle: task.entry.title,
        analysisType: task.analysisType,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        duration,
        retryCount,
        willRetry: retryCount < this.maxRetries,
        isRateLimitError,
        isTimeoutError,
      });

      if (retryCount < this.maxRetries) {
        // 计算下次重试时间（指数退避）
        let delayMs = this.retryDelay * Math.pow(2, retryCount);
        
        // 如果是速率限制错误，增加更长的退避时间
        if (isRateLimitError) {
          delayMs = Math.max(delayMs, 60000); // 至少等待1分钟
          console.log(`⏸️  [Queue] 任务 ${task.id} 触发速率限制，延迟 ${delayMs}ms 后重试`);
        }
        
        // 如果是超时错误，增加中等退避时间
        if (isTimeoutError) {
          delayMs = Math.max(delayMs, 30000); // 至少等待30秒
        }

        const nextRetryAt = new Date(Date.now() + delayMs);

        await db.aIAnalysisQueue.update({
          where: { id: task.id },
          data: {
            status: 'pending',
            retryCount,
            nextRetryAt,
            errorMessage: isRateLimitError ? `[RateLimit] ${errorMessage}` : errorMessage,
          },
        });
      } else {
        // 达到最大重试次数，标记为失败
        await db.aIAnalysisQueue.update({
          where: { id: task.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage,
            retryCount,
          },
        });
      }
    }
  }

  /**
   * 添加分析任务
   */
  static async addTask(entryId: string, analysisType: string, priority: number = 5): Promise<void> {
    // 检查是否已存在待处理或处理中的任务
    const existing = await db.aIAnalysisQueue.findFirst({
      where: {
        entryId,
        analysisType,
        status: {
          in: ['pending', 'processing'],
        },
      },
    });

    if (existing) {
      return;
    }

    await db.aIAnalysisQueue.create({
      data: {
        entryId,
        analysisType,
        priority,
        status: 'pending',
      },
    });
  }

  /**
   * 批量添加任务
   */
  static async addTasks(entries: Array<{ entryId: string; analysisType: string; priority?: number }>): Promise<void> {
    await db.aIAnalysisQueue.createMany({
      data: entries.map(e => ({
        entryId: e.entryId,
        analysisType: e.analysisType,
        priority: e.priority || 5,
        status: 'pending',
      })),
      skipDuplicates: true,
    });
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const [pending, processing, completed, failed] = await Promise.all([
      db.aIAnalysisQueue.count({ where: { status: 'pending' } }),
      db.aIAnalysisQueue.count({ where: { status: 'processing' } }),
      db.aIAnalysisQueue.count({ where: { status: 'completed' } }),
      db.aIAnalysisQueue.count({ where: { status: 'failed' } }),
    ]);

    return { pending, processing, completed, failed };
  }

  /**
   * 清理已完成的任务
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.aIAnalysisQueue.deleteMany({
      where: {
        status: 'completed',
        completedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

// 导出AIService
export { AIService } from './client';

// 默认队列处理器实例
let defaultQueue: AIAnalysisQueue | null = null;

/**
 * 获取AI分析队列实例
 * 支持从环境变量配置队列参数
 */
export function getAIQueue(): AIAnalysisQueue {
  if (!defaultQueue) {
    // 从环境变量读取配置，使用合理的默认值
    defaultQueue = new AIAnalysisQueue({
      concurrency: parseInt(process.env.AI_QUEUE_CONCURRENCY || '3', 10),
      retryDelay: parseInt(process.env.AI_QUEUE_RETRY_DELAY_MS || '5000', 10),
      maxRetries: parseInt(process.env.AI_QUEUE_MAX_RETRIES || '3', 10),
      taskIntervalMs: parseInt(process.env.AI_QUEUE_TASK_INTERVAL_MS || '1000', 10),
      userRateLimitWindowMs: parseInt(process.env.AI_QUEUE_USER_WINDOW_MS || '60000', 10),
      userMaxRequestsPerWindow: parseInt(process.env.AI_QUEUE_USER_MAX_REQUESTS || '30', 10),
    });
  }
  return defaultQueue;
}
