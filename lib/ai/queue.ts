/**
 * AI分析队列处理器
 * 管理AI分析任务队列
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
      user: Pick<User, 'aiConfig'> | null;
    };
  };
};

export interface QueueOptions {
  concurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
}

/**
 * AI分析队列处理器
 */
export class AIAnalysisQueue {
  private processing = false;
  private concurrency: number;
  private retryDelay: number;
  private maxRetries: number;

  constructor(options: QueueOptions = {}) {
    this.concurrency = options.concurrency || 3;
    this.retryDelay = options.retryDelay || 5000;
    this.maxRetries = options.maxRetries || 3;
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
    await info('queue', 'AI分析队列启动', { concurrency: this.concurrency });

    while (this.processing) {
      try {
        const tasks = await this.getPendingTasks(this.concurrency);

        if (tasks.length === 0) {
          console.log('⏳ [Queue] 暂无待处理任务，等待中...');
          await sleep(5000); // 没有任务时等待5秒
          continue;
        }

        console.log(`🚀 [Queue] 发现 ${tasks.length} 个待处理任务，开始处理...`);
        await info('queue', '开始批量处理AI任务', { count: tasks.length });

        // 并发处理任务
        await Promise.allSettled(
          tasks.map((task) => this.processTask(task))
        );
      } catch (err) {
        console.error('❌ [Queue] 队列处理器错误:', err);
        await logError('queue', '队列处理器错误', err instanceof Error ? err : undefined);
        await sleep(10000); // 出错后等待10秒
      }
    }
  }

  /**
   * 停止队列处理器
   */
  stop(): void {
    this.processing = false;
  }

  /**
   * 获取待处理任务
   */
  private async getPendingTasks(limit: number): Promise<TaskWithRelations[]> {
    return db.aIAnalysisQueue.findMany({
      where: {
        status: 'pending',
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } },
        ],
      },
      take: limit,
      orderBy: {
        priority: 'desc',
      },
      include: {
        entry: {
          include: {
            feed: {
              include: {
                user: {
                  select: {
                    aiConfig: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * 处理单个任务
   */
  private async processTask(task: TaskWithRelations): Promise<void> {
    const startTime = Date.now();

    // 标记为处理中
    await db.aIAnalysisQueue.update({
      where: { id: task.id },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });

    await info('ai', 'AI分析任务开始', {
      taskId: task.id,
      entryId: task.entryId,
      analysisType: task.analysisType,
      entryTitle: task.entry.title
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

      await logError('ai', 'AI分析任务失败', errorObj, {
        taskId: task.id,
        entryId: task.entryId,
        entryTitle: task.entry.title,
        analysisType: task.analysisType,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        duration,
        retryCount,
        willRetry: retryCount < this.maxRetries
      });

      if (retryCount < this.maxRetries) {
        // 计算下次重试时间（指数退避）
        const nextRetryAt = new Date();
        nextRetryAt.setTime(nextRetryAt.getTime() + this.retryDelay * Math.pow(2, retryCount));

        await db.aIAnalysisQueue.update({
          where: { id: task.id },
          data: {
            status: 'pending',
            retryCount,
            nextRetryAt,
            errorMessage,
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

export function getAIQueue(): AIAnalysisQueue {
  if (!defaultQueue) {
    defaultQueue = new AIAnalysisQueue();
  }
  return defaultQueue;
}
