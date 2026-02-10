/**
 * 后台任务调度器
 * 负责 Feed 抓取和 AI 分析的定时调度
 */

import { feedManager } from '@/lib/rss/feed-manager';
import { AIAnalysisQueue, getAIQueue } from '@/lib/ai/queue';
import { db } from '@/lib/db';
import { getNotificationService } from '@/lib/notifications/service';

export class TaskScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly fetchInterval = 5 * 60 * 1000; // 5分钟
  private readonly aiProcessInterval = 2 * 60 * 1000; // 2分钟

  /**
   * 启动调度器
   */
  start() {
    if (this.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting task scheduler...');
    this.isRunning = true;

    // 立即执行一次
    this.runFetchCycle();
    this.runAIProcessCycle();

    // 定期执行 Feed 抓取
    this.intervalId = setInterval(() => {
      this.runFetchCycle();
      this.runAIProcessCycle();
    }, Math.min(this.fetchInterval, this.aiProcessInterval));
  }

  /**
   * 停止调度器
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Scheduler] Stopped');
  }

  /**
   * 运行 Feed 抓取周期
   */
  private async runFetchCycle() {
    try {
      console.log('[Scheduler] Starting fetch cycle...');

      // 获取需要更新的 feeds
      const feeds = await feedManager.getFeedsToUpdate(20);

      if (feeds.length === 0) {
        console.log('[Scheduler] No feeds to update');
        return;
      }

      console.log(`[Scheduler] Fetching ${feeds.length} feeds...`);

      // 批量抓取
      const results = await feedManager.fetchMultipleFeeds(feeds.map((f) => f.id));

      let totalAdded = 0;
      let totalUpdated = 0;
      let errorCount = 0;

      for (const result of results) {
        if (result.success) {
          totalAdded += result.entriesAdded;
          totalUpdated += result.entriesUpdated;
        } else {
          errorCount++;
        }
      }

      console.log(
        `[Scheduler] Fetch cycle complete: ${totalAdded} added, ${totalUpdated} updated, ${errorCount} errors`
      );

      // 检查并通知失败的订阅源
      await this.notifyFailedFeeds(feeds, results);

      // 将新文章加入 AI 分析队列
      if (totalAdded > 0) {
        await this.queueNewEntriesForAI();
      }
    } catch (error) {
      console.error('[Scheduler] Fetch cycle error:', error);
    }
  }

  /**
   * 运行 AI 处理周期
   */
  private async runAIProcessCycle() {
    try {
      console.log('[Scheduler] Starting AI process cycle...');

      // 获取待处理任务数量
      const queue = getAIQueue();
      const status = await queue.getQueueStatus();

      if (status.pending === 0) {
        console.log('[Scheduler] No AI tasks to process');
        return;
      }

      console.log(`[Scheduler] ${status.pending} AI tasks in queue`);

      // 队列处理器会自动处理任务，这里只需确保它在运行
      // 如果需要手动触发处理，可以启动队列处理器
    } catch (error) {
      console.error('[Scheduler] AI process cycle error:', error);
    }
  }

  /**
   * 通知失败的订阅源
   */
  private async notifyFailedFeeds(feeds: any[], results: any[]) {
    const notificationService = getNotificationService();

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.success) {
        const feed = feeds[i];
        // 检查错误计数
        if (feed.errorCount >= 3) {
          await notificationService.notifyFeedError(
            feed.userId,
            feed.id,
            feed.title,
            result.error || '未知错误',
            feed.errorCount
          );
        }
      }
    }
  }

  /**
   * 将新文章加入 AI 分析队列
   */
  private async queueNewEntriesForAI() {
    try {
      // 获取最近1小时内创建且没有AI分析的文章
      const recentEntries = await db.entry.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000),
          },
          aiSummary: null,
        },
        select: {
          id: true,
        },
        take: 50,
      });

      console.log(`[Scheduler] Queuing ${recentEntries.length} entries for AI analysis...`);

      for (const entry of recentEntries) {
        await AIAnalysisQueue.addTask(entry.id, 'summary', 5);
      }
    } catch (error) {
      console.error('[Scheduler] Queue error:', error);
    }
  }

  /**
   * 手动触发 Feed 抓取
   */
  async triggerFetch() {
    console.log('[Scheduler] Manual fetch triggered');
    await this.runFetchCycle();
  }

  /**
   * 手动触发 AI 处理
   */
  async triggerAIProcess() {
    console.log('[Scheduler] Manual AI process triggered');
    await this.runAIProcessCycle();
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      fetchInterval: this.fetchInterval,
      aiProcessInterval: this.aiProcessInterval,
    };
  }
}

// 单例实例
let schedulerInstance: TaskScheduler | null = null;

export function getScheduler(): TaskScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new TaskScheduler();
  }
  return schedulerInstance;
}

// 自动启动（仅在非测试环境且明确启用时）
// 设置 SCHEDULER_AUTO_START=true 来自动启动调度器
if (process.env.NODE_ENV !== 'test' && process.env.SCHEDULER_AUTO_START === 'true') {
  // 延迟启动，等待数据库连接就绪
  setTimeout(() => {
    const scheduler = getScheduler();
    scheduler.start();
  }, 5000);
}
