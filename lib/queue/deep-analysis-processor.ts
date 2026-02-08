/**
 * 深度分析队列处理器
 *
 * 使用 BullMQ 处理文章深度分析任务
 */

import { Queue, Worker, Job } from 'bullmq';
import { db } from '@/lib/db';
import { getDefaultAIService } from '@/lib/ai/client';
import { SegmentedAnalyzer } from '@/lib/ai/analysis/segmented-analyzer';
import { ReflectionEngine } from '@/lib/ai/analysis/reflection-engine';
import { PersonalScorer } from '@/lib/ai/scoring/personal-scorer';
import type { ArticleAnalysisResult } from '@/lib/ai/analysis/types';
import { quickDetectLanguage } from '@/lib/ai/language-detector';
import { createModelSelector } from '@/lib/ai/model-selector';

// Redis 连接配置
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

// 创建模型选择器（全局实例）
const modelSelector = createModelSelector();

// =====================================================
// 任务数据类型
// =====================================================

export interface DeepAnalysisJobData {
  entryId: string;
  userId?: string;
  priority?: number;
}

// =====================================================
// 队列定义
// =====================================================

export const deepAnalysisQueue = new Queue<DeepAnalysisJobData>('deep-analysis', {
  connection: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 7 * 24 * 3600, // 7天后删除
      count: 1000, // 最多保留1000个
    },
    removeOnFail: {
      age: 30 * 24 * 3600, // 30天后删除
    },
  },
});

// =====================================================
// 队列处理器
// =====================================================

export function createDeepAnalysisWorker(): Worker<DeepAnalysisJobData> {
  return new Worker<DeepAnalysisJobData>(
    'deep-analysis',
    async (job: Job<DeepAnalysisJobData>) => {
      const { entryId, userId } = job.data;

      job.updateProgress(10);

      // 1. 获取文章内容
      const entry = await db.entry.findUnique({
        where: { id: entryId },
        include: {
          feed: {
            select: {
              title: true,
              feedUrl: true,
            },
          },
        },
      });

      if (!entry) {
        throw new Error(`文章 ${entryId} 不存在`);
      }

      if (!entry.content) {
        throw new Error(`文章 ${entryId} 没有内容`);
      }

      job.updateProgress(20);

      // 2. 获取用户偏好（如果有）
      let userPrefs = null;
      if (userId) {
        userPrefs = await db.userPreference.findUnique({
          where: { userId },
        });
      }

      job.updateProgress(30);

      // 3. 语言检测和模型选择
      const language = entry.aiPrelimLanguage || quickDetectLanguage(entry.content || '');
      const analysisModel = modelSelector.selectModel(language, 'analysis');
      const reflectionModel = modelSelector.selectModel(language, 'reflection');

      console.log(`文章 ${entryId}: 语言=${language}, 分析模型=${analysisModel}, 反思模型=${reflectionModel}`);

      job.updateProgress(35);

      // 4. 初始化 AI 服务
      const aiService = getDefaultAIService();
      const llm = {
        chat: async (params: any) => {
          // 使用 AI 服务进行对话
          const result = await aiService.analyzeArticle(params.messages[1].content, {
            summary: true,
            keywords: true,
            category: true,
          });
          return {
            content: JSON.stringify(result),
          };
        },
      } as any;

      job.updateProgress(40);

      // 5. 执行分段分析
      const segmentedAnalyzer = new SegmentedAnalyzer(llm);
      let analysisResult: ArticleAnalysisResult;

      try {
        analysisResult = await segmentedAnalyzer.analyze(entry.content, {
          title: entry.title,
          author: entry.author || undefined,
        });

        job.updateProgress(60);
      } catch (error) {
        console.error('分段分析失败:', error);
        throw new Error(`分段分析失败: ${error}`);
      }

      // 5. 执行反思优化
      const reflectionEngine = new ReflectionEngine(llm);
      try {
        analysisResult = await reflectionEngine.refine(
          entry.content,
          analysisResult,
          2 // 最多2轮反思
        );

        job.updateProgress(80);
      } catch (error) {
        console.error('反思优化失败:', error);
        // 反思失败不影响主流程，继续使用原始分析结果
      }

      // 6. 保存分析结果到数据库
      const processingTime = Date.now() - job.processedOn!;

      try {
        await db.entry.update({
          where: { id: entryId },
          data: {
            aiOneLineSummary: analysisResult.oneLineSummary,
            aiSummary: analysisResult.summary,
            aiMainPoints: analysisResult.mainPoints as any,
            aiKeyQuotes: analysisResult.keyQuotes as any,
            aiScoreDimensions: analysisResult.scoreDimensions as any,
            aiAnalysisModel: `${analysisModel}+${reflectionModel}`,
            aiProcessingTime: processingTime,
            aiReflectionRounds: analysisResult.reflectionRounds || 2,
            aiAnalyzedAt: new Date(),
          },
        });
      } catch (dbError) {
        console.error('保存分析结果失败:', dbError);
        // 数据库保存失败不影响任务完成
      }

      job.updateProgress(90);

      // 7. 计算个性化评分（如果有用户）
      if (userId && userPrefs) {
        const personalScorer = new PersonalScorer(llm);
        // 映射数据库字段到 UserPreferenceProfile 接口
        const mappedPrefs: any = {
          userId: userPrefs.userId,
          topicWeights: userPrefs.topicWeights as Record<string, number>,
          preferredDepth: (userPrefs.preferredDepth || 'medium') as 'deep' | 'medium' | 'light',
          preferredLength: (userPrefs.preferredLength || 'medium') as 'short' | 'medium' | 'long',
          excludedTags: userPrefs.excludedTags,
          avgDwellTime: userPrefs.avgDwellTime,
          completionRate: userPrefs.avgCompletion, // 映射 avgCompletion 到 completionRate
          diversityScore: userPrefs.diversityScore,
          updatedAt: userPrefs.updatedAt,
        };
        const personalScore = await personalScorer.calculateScore(
          analysisResult,
          mappedPrefs
        );

        // TODO: 保存个性化评分
        console.log('个性化评分:', personalScore);
      }

      job.updateProgress(100);

      return {
        success: true,
        analysisResult,
      };
    },
    {
      connection: REDIS_CONFIG,
      concurrency: 3, // 并发处理3个任务
    }
  );
}

// =====================================================
// 队列操作函数
// =====================================================

/**
 * 添加深度分析任务
 */
export async function addDeepAnalysisJob(data: DeepAnalysisJobData): Promise<string> {
  const job = await deepAnalysisQueue.add('analyze', data, {
    priority: data.priority || 5,
    delay: 1000, // 延迟1秒，避免RSS抓取高峰
  });

  return job.id!;
}

/**
 * 批量添加深度分析任务
 */
export async function addDeepAnalysisJobsBatch(
  jobs: DeepAnalysisJobData[]
): Promise<string[]> {
  const jobPromises = jobs.map(data => addDeepAnalysisJob(data));
  return Promise.all(jobPromises);
}

/**
 * 获取队列状态
 */
export async function getQueueStatus() {
  const [waiting, active, completed, failed] = await Promise.all([
    deepAnalysisQueue.getWaiting(),
    deepAnalysisQueue.getActive(),
    deepAnalysisQueue.getCompleted(),
    deepAnalysisQueue.getFailed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
  };
}

/**
 * 清空队列
 */
export async function clearQueue(): Promise<void> {
  await deepAnalysisQueue.drain();
}

/**
 * 暂停队列
 */
export async function pauseQueue(): Promise<void> {
  await deepAnalysisQueue.pause();
}

/**
 * 恢复队列
 */
export async function resumeQueue(): Promise<void> {
  await deepAnalysisQueue.resume();
}

/**
 * 获取任务状态
 */
export async function getJobState(jobId: string) {
  const job = await deepAnalysisQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
  };
}

// =====================================================
// 错误处理
// =====================================================

/**
 * 重试失败的任务
 */
export async function retryFailedJobs(limit: number = 10): Promise<number> {
  const failed = await deepAnalysisQueue.getFailed(0, limit);
  let retried = 0;

  for (const job of failed) {
    try {
      await job.retry();
      retried++;
    } catch (error) {
      console.error(`重试任务 ${job.id} 失败:`, error);
    }
  }

  return retried;
}
