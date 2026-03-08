/**
 * 后台任务调度器
 * 负责 Feed 抓取、AI 分析和文章清理的定时调度
 */

import { feedManager, DEFAULT_ENTRY_RETENTION_DAYS } from '@/lib/rss/feed-manager';
import {
  getQueueStatus as getPreliminaryQueueStatus,
  addUnanalyzedEntries,
} from '@/lib/queue/preliminary-processor';
import {
  getQueueStatus as getDeepAnalysisQueueStatus,
} from '@/lib/queue/deep-analysis-processor';
import { getNotificationService } from '@/lib/notifications/service';
import { info, error as logError } from '@/lib/logger';

export class TaskScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly fetchInterval = 60 * 60 * 1000; // 1小时
  private readonly aiProcessInterval = 2 * 60 * 1000; // 2分钟
  private readonly cleanupInterval = 24 * 60 * 60 * 1000; // 24小时（每天清理一次）

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
    this.runCleanupCycle();

    // 定期执行 Feed 抓取
    this.intervalId = setInterval(() => {
      this.runFetchCycle();
      this.runAIProcessCycle();
    }, Math.min(this.fetchInterval, this.aiProcessInterval));

    // 定期执行文章清理（每天一次）
    this.cleanupIntervalId = setInterval(() => {
      this.runCleanupCycle();
    }, this.cleanupInterval);
  }

  /**
   * 停止调度器
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
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

      // 获取初评队列状态
      const prelimStatus = await getPreliminaryQueueStatus();
      // 获取深度分析队列状态
      const deepStatus = await getDeepAnalysisQueueStatus();

      const totalPending = prelimStatus.waiting + deepStatus.waiting;
      const totalActive = prelimStatus.active + deepStatus.active;

      if (totalPending === 0 && totalActive === 0) {
        console.log('[Scheduler] No AI tasks to process');
        return;
      }

      console.log(
        `[Scheduler] AI tasks: Preliminary(${prelimStatus.waiting} waiting, ${prelimStatus.active} active), ` +
        `Deep(${deepStatus.waiting} waiting, ${deepStatus.active} active)`
      );

      // BullMQ Workers 会自动处理队列中的任务
      // 这里只需要确保 Workers 在运行（通过 Docker 容器或启动脚本）
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
      // 使用新的 BullMQ 队列系统批量添加未分析的文章
      // addUnanalyzedEntries(limit, priority) - 获取未分析的文章并添加到队列
      const addedCount = await addUnanalyzedEntries(50, 5);

      if (addedCount > 0) {
        console.log(`[Scheduler] Added ${addedCount} entries to preliminary queue`);
        await info('queue', '新文章已加入AI分析队列', { count: addedCount });
      }
    } catch (err) {
      console.error('[Scheduler] Queue error:', err);
      await logError('queue', '添加AI分析任务失败', err instanceof Error ? err : undefined);
    }
  }

  /**
   * 运行文章清理周期
   */
  private async runCleanupCycle() {
    try {
      console.log('[Scheduler] Starting cleanup cycle...');
      
      const result = await feedManager.autoCleanupByUserSettings();
      
      if (result.errors.length > 0) {
        console.error(`[Scheduler] Cleanup completed with ${result.errors.length} errors`);
        for (const err of result.errors) {
          console.error(`[Scheduler] Cleanup error: ${err}`);
        }
      }
      
      console.log(
        `[Scheduler] Cleanup cycle complete: ${result.totalDeleted} entries deleted from ${result.userCount} users`
      );
    } catch (error) {
      console.error('[Scheduler] Cleanup cycle error:', error);
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
   * 手动触发文章清理
   */
  async triggerCleanup() {
    console.log('[Scheduler] Manual cleanup triggered');
    await this.runCleanupCycle();
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
