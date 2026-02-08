/**
 * 初评队列处理器
 *
 * 使用 BullMQ 处理文章初评任务
 * 基于 BestBlogs 的分层处理架构
 */

import { Queue, Worker, Job, JobsOptions } from 'bullmq';
import { db } from '@/lib/db';
import { createPreliminaryEvaluator } from '@/lib/ai/preliminary-evaluator';
import type { PreliminaryEvaluation } from '@/lib/ai/preliminary-evaluator';

// =====================================================
// Redis 配置
// =====================================================

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

// =====================================================
// 任务数据类型
// =====================================================

export interface PreliminaryJobData {
  entryId: string;
  userId?: string;
  priority?: number;
  forceReanalyze?: boolean;
}

export interface PreliminaryJobResult {
  success: boolean;
  evaluation?: PreliminaryEvaluation;
  queuedForDeepAnalysis?: boolean;
  error?: string;
}

// =====================================================
// 队列定义
// =====================================================

export const preliminaryQueue = new Queue<PreliminaryJobData>('preliminary-analysis', {
  connection: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3 * 24 * 3600, // 3天后删除
      count: 500,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 7天后删除
    },
  },
});

// =====================================================
// 队列处理器
// =====================================================

export function createPreliminaryWorker(): Worker<PreliminaryJobData, PreliminaryJobResult> {
  return new Worker<PreliminaryJobData, PreliminaryJobResult>(
    'preliminary-analysis',
    async (job: Job<PreliminaryJobData>) => {
      const { entryId, forceReanalyze } = job.data;

      job.updateProgress(10);

      // 1. 获取文章
      const entry = await db.entry.findUnique({
        where: { id: entryId },
        select: {
          id: true,
          title: true,
          content: true,
          url: true,
          author: true,
          aiPrelimStatus: true,
          feedId: true,
        },
      });

      if (!entry) {
        throw new Error(`文章 ${entryId} 不存在`);
      }

      if (!entry.content) {
        throw new Error(`文章 ${entryId} 没有内容`);
      }

      // 检查是否已初评（除非强制重分析）
      if (entry.aiPrelimStatus && !forceReanalyze) {
        return {
          success: true,
          evaluation: undefined, // 已存在，不需要返回
          queuedForDeepAnalysis: false,
        };
      }

      job.updateProgress(30);

      // 2. 执行初评
      const evaluator = createPreliminaryEvaluator();
      const evaluation = await evaluator.evaluate({
        title: entry.title,
        content: entry.content,
        url: entry.url,
        author: entry.author || undefined,
      });

      job.updateProgress(70);

      // 3. 更新数据库
      await db.entry.update({
        where: { id: entryId },
        data: {
          aiPrelimIgnore: evaluation.ignore,
          aiPrelimReason: evaluation.reason,
          aiPrelimValue: evaluation.value,
          aiPrelimSummary: evaluation.summary,
          aiPrelimLanguage: evaluation.language,
          aiPrelimStatus: evaluation.ignore ? 'rejected' : 'passed',
          aiPrelimAnalyzedAt: new Date(),
          aiPrelimModel: evaluation.language === 'zh' ? 'deepseek-chat' : 'gemini-1.5-flash',
        },
      });

      job.updateProgress(90);

      // 4. 如果通过初评，添加到深度分析队列
      let queuedForDeepAnalysis = false;
      if (!evaluation.ignore) {
        try {
          const { addDeepAnalysisJob } = await import('@/lib/queue/deep-analysis-processor');
          await addDeepAnalysisJob({
            entryId,
            priority: job.data.priority || 5,
          });
          queuedForDeepAnalysis = true;
        } catch (error) {
          console.error('添加到深度分析队列失败:', error);
          // 不影响初评结果，只记录错误
        }
      }

      job.updateProgress(100);

      return {
        success: true,
        evaluation,
        queuedForDeepAnalysis,
      };
    },
    {
      connection: REDIS_CONFIG,
      concurrency: parseInt(process.env.PRELIMINARY_WORKER_CONCURRENCY || '5', 10),
    }
  );
}

// =====================================================
// 队列操作函数
// =====================================================

/**
 * 添加初评任务
 */
export async function addPreliminaryJob(
  data: PreliminaryJobData,
  options?: JobsOptions
): Promise<string> {
  const jobOptions: JobsOptions = {
    priority: data.priority || 5,
    delay: 1000, // 延迟1秒，避免RSS抓取高峰
    ...options,
  };

  const job = await preliminaryQueue.add('evaluate', data, jobOptions);
  return job.id!;
}

/**
 * 批量添加初评任务
 */
export async function addPreliminaryJobsBatch(
  jobs: PreliminaryJobData[]
): Promise<string[]> {
  const jobPromises = jobs.map(data => addPreliminaryJob(data));
  return Promise.all(jobPromises);
}

/**
 * 批量添加未初评的文章
 *
 * @param limit - 限制数量
 * @param priority - 优先级
 * @returns 添加的任务数量
 */
export async function addUnanalyzedEntries(
  limit: number = 100,
  priority: number = 5
): Promise<number> {
  // 获取未初评的文章
  const unanalyzedEntries = await db.entry.findMany({
    where: {
      content: { not: null },
      aiPrelimStatus: null,
    },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  if (unanalyzedEntries.length === 0) {
    return 0;
  }

  // 批量添加到队列
  const jobIds = await addPreliminaryJobsBatch(
    unanalyzedEntries.map(entry => ({ entryId: entry.id, priority }))
  );

  console.log(`已添加 ${jobIds.length} 篇文章到初评队列`);
  return jobIds.length;
}

/**
 * 获取队列状态
 */
export async function getQueueStatus() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    preliminaryQueue.getWaiting(),
    preliminaryQueue.getActive(),
    preliminaryQueue.getCompleted(),
    preliminaryQueue.getFailed(),
    preliminaryQueue.getDelayed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
  };
}

/**
 * 清空队列
 */
export async function clearQueue(): Promise<void> {
  await preliminaryQueue.drain();
}

/**
 * 暂停队列
 */
export async function pauseQueue(): Promise<void> {
  await preliminaryQueue.pause();
}

/**
 * 恢复队列
 */
export async function resumeQueue(): Promise<void> {
  await preliminaryQueue.resume();
}

/**
 * 获取任务状态
 */
export async function getJobState(jobId: string) {
  const job = await preliminaryQueue.getJob(jobId);

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

/**
 * 重试失败的任务
 */
export async function retryFailedJobs(limit: number = 10): Promise<number> {
  const failed = await preliminaryQueue.getFailed(0, limit);
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

/**
 * 获取队列统计
 */
export async function getQueueStats() {
  const status = await getQueueStatus();
  const totalProcessed = status.completed + status.failed;
  const successRate = totalProcessed > 0
    ? (status.completed / totalProcessed) * 100
    : 0;

  return {
    ...status,
    totalProcessed,
    successRate: Math.round(successRate * 100) / 100,
  };
}

// =====================================================
// 事件监听
// =====================================================

/**
 * 设置队列事件监听
 */
export function setupQueueEvents(): void {
  preliminaryQueue.on('waiting' as any, (jobId: string) => {
    console.log(`任务 ${jobId} 进入等待队列`);
  });

  preliminaryQueue.on('active' as any, (job: { id: string }) => {
    console.log(`任务 ${job.id} 开始处理`);
  });

  preliminaryQueue.on('completed' as any, (job: { id: string }, result: any) => {
    const { evaluation, queuedForDeepAnalysis } = result as PreliminaryJobResult;
    console.log(
      `任务 ${job.id} 完成: ${evaluation?.language}, ` +
      `评分 ${evaluation?.value}/5, ` +
      `${queuedForDeepAnalysis ? '已加入深度分析' : '已忽略'}`
    );
  });

  preliminaryQueue.on('failed' as any, (job: { id?: string }, error: Error) => {
    console.error(`任务 ${job?.id} 失败:`, error.message);
  });

  preliminaryQueue.on('stalled' as any, (jobId: string) => {
    console.warn(`任务 ${jobId} 被标记为停滞`);
  });
}
