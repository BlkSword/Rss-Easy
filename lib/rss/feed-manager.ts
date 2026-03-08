/**
 * Feed管理器
 * 负责feed的抓取、更新、去重等操作
 */

import { db } from '../db';
import { parseFeed } from './parser';
import { generateContentHash } from '../utils';
import { info, warn, error } from '../logger';
import type { Feed, Entry } from '@prisma/client';
import { addPreliminaryJob } from '../queue/preliminary-processor';
import { controlledRequest } from './request-controller';

export interface FeedUpdateResult {
  success: boolean;
  entriesAdded: number;
  entriesUpdated: number;
  error?: string;
}

export interface CleanupResult {
  deletedCount: number;
  preservedCount: number;
  errors?: string[];
}

/** 单个 Feed 抓取超时时间（毫秒） */
const FEED_FETCH_TIMEOUT = 60000;

/** 默认抓取时间范围（天）- 不限制 */
export const DEFAULT_FETCH_TIME_RANGES = {
  unlimited: null,
  oneMonth: 30,
  threeMonths: 90,
  sixMonths: 180,
  oneYear: 365,
} as const;

/** 默认文章保留时间（天） */
export const DEFAULT_ENTRY_RETENTION_DAYS = 90;

/** 抓取时间范围选项 */
export const FETCH_TIME_RANGE_OPTIONS = [
  { value: null, label: '不限制', days: null },
  { value: 30, label: '一个月', days: 30 },
  { value: 90, label: '三个月', days: 90 },
  { value: 180, label: '半年', days: 180 },
  { value: 365, label: '一年', days: 365 },
] as const;

/**
 * Feed管理器类
 */
export class FeedManager {
  /**
   * 抓取单个feed
   */
  async fetchFeed(feedId: string): Promise<FeedUpdateResult> {
    const startTime = Date.now();

    // 先获取feed信息（数据库操作不受请求控制）
    let feed: Feed | null;
    try {
      feed = await db.feed.findUnique({
        where: { id: feedId },
      });
    } catch (dbErr) {
      await error('rss', '获取订阅源信息失败', dbErr instanceof Error ? dbErr : undefined, { feedId });
      return { success: false, entriesAdded: 0, entriesUpdated: 0, error: 'Database error' };
    }

    if (!feed) {
      await warn('rss', '订阅源不存在', { feedId });
      return { success: false, entriesAdded: 0, entriesUpdated: 0, error: 'Feed not found' };
    }

    await info('rss', '开始抓取订阅源', { feedId, feedUrl: feed.feedUrl, title: feed.title });

    try {
      // 使用请求控制器执行网络请求
      const parsedFeed = await controlledRequest(
        () => Promise.race([
          parseFeed(feed.feedUrl),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Feed 解析超时')), FEED_FETCH_TIMEOUT)
          ),
        ]),
        { url: feed.feedUrl, feedId }
      );

      let entriesAdded = 0;
      let entriesUpdated = 0;
      let entryErrors = 0;

      // 计算时间范围过滤
      const fetchTimeRange = feed.fetchTimeRange;
      const cutoffDate = fetchTimeRange
        ? new Date(Date.now() - fetchTimeRange * 24 * 60 * 60 * 1000)
        : null;

      if (fetchTimeRange) {
        await info('rss', '启用时间范围过滤', {
          feedId,
          fetchTimeRange: `${fetchTimeRange}天`,
          cutoffDate: cutoffDate!.toISOString(),
        });
      }

      // 处理每个条目（带容错机制）
      for (const item of parsedFeed.items) {
        try {
          // 时间范围过滤：如果文章发布时间早于截止时间，则跳过
          if (cutoffDate && item.pubDate) {
            if (item.pubDate < cutoffDate) {
              continue; // 跳过过期文章
            }
          }

          const contentHash = await generateContentHash(
            `${item.title}${item.link}${item.content || ''}`
          );

          // 检查是否已存在
          const existingEntry = await db.entry.findUnique({
            where: { contentHash },
          });

          // 准备通用数据
          const entryData = {
            title: item.title,
            content: item.content,
            summary: item.contentSnippet?.slice(0, 500), // 限制摘要长度
            url: item.link,
            publishedAt: item.pubDate,
            author: item.author,
            tags: item.categories || [],
            // 存储图片URL（如果有）
            ...(item.image && { mainImageUrl: item.image }),
          };

          if (existingEntry) {
            // 更新现有条目
            await db.entry.update({
              where: { id: existingEntry.id },
              data: entryData,
            });
            entriesUpdated++;
          } else {
            // 创建新条目
            const newEntry = await db.entry.create({
              data: {
                feedId: feed.id,
                contentHash,
                ...entryData,
              },
            });
            entriesAdded++;

            // 自动添加到AI分析队列（需要用户启用且配置有效）
            try {
              // 获取用户的AI配置
              const user = await db.user.findUnique({
                where: { id: feed.userId },
                select: { aiConfig: true },
              });

              const aiConfig = (user?.aiConfig as any) || {};
              const configValid = aiConfig.configValid === true;
              const autoSummary = aiConfig.autoSummary === true;
              const autoCategorize = aiConfig.autoCategorize === true;
              const aiQueueEnabled = aiConfig.aiQueueEnabled === true;

              // 只有当配置验证通过且用户启用功能时才添加到队列
              if (configValid && (autoSummary || autoCategorize || aiQueueEnabled)) {
                // 使用新的 BullMQ 队列系统
                await addPreliminaryJob({
                  entryId: newEntry.id,
                  userId: feed.userId,
                  priority: 5,
                });
              }
            } catch (err) {
              // AI分析失败不影响feed抓取
              await error('rss', '添加AI分析任务失败', err instanceof Error ? err : undefined, {
                entryId: newEntry.id,
                feedId: feed.id,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        } catch (entryErr) {
          // 单个条目失败不影响其他条目
          entryErrors++;
          await warn('rss', '处理条目失败，跳过继续', {
            feedId,
            itemTitle: item.title?.slice(0, 100),
            error: entryErr instanceof Error ? entryErr.message : String(entryErr),
          });
        }
      }

      const duration = Date.now() - startTime;
      await info('rss', '订阅源抓取完成', {
        feedId,
        title: feed.title,
        entriesAdded,
        entriesUpdated,
        entryErrors,
        totalItems: parsedFeed.items.length,
        duration,
      });

      // 更新feed信息（包括从RSS获取的描述）
      const updateData: any = {
        lastFetchedAt: new Date(),
        lastSuccessAt: new Date(),
        nextFetchAt: this.calculateNextFetch(feed.priority),
        totalEntries: {
          increment: entriesAdded,
        },
        errorCount: 0,
        lastError: null,
      };

      // 如果RSS中有描述且当前描述为空，更新描述
      if (parsedFeed.description && !feed.description) {
        updateData.description = parsedFeed.description;
      }

      // 如果RSS中有siteUrl且当前siteUrl为空，更新siteUrl
      if (parsedFeed.link && !feed.siteUrl) {
        updateData.siteUrl = parsedFeed.link;
      }

      await db.feed.update({
        where: { id: feedId },
        data: updateData,
      });

      // 更新未读计数
      await this.updateUnreadCount(feedId);

      return {
        success: true,
        entriesAdded,
        entriesUpdated,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const duration = Date.now() - startTime;

      await error('rss', '订阅源抓取失败', err instanceof Error ? err : undefined, {
        feedId,
        feedUrl: feed.feedUrl,
        duration,
        error: errorMessage,
      });

      // 更新错误信息（同时更新 lastFetchedAt 表示已尝试抓取）
      await db.feed.update({
        where: { id: feedId },
        data: {
          lastFetchedAt: new Date(),
          errorCount: {
            increment: 1,
          },
          lastError: errorMessage,
        },
      });

      return {
        success: false,
        entriesAdded: 0,
        entriesUpdated: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * 批量抓取feeds（带并发控制）
   */
  async fetchMultipleFeeds(feedIds: string[]): Promise<FeedUpdateResult[]> {
    // 使用请求控制器进行并发限制
    const results = await Promise.allSettled(
      feedIds.map((id) =>
        controlledRequest(
          () => this.fetchFeed(id),
          { feedId: id }
        )
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          entriesAdded: 0,
          entriesUpdated: 0,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });
  }

  /**
   * 获取需要更新的feeds
   */
  async getFeedsToUpdate(limit: number = 50): Promise<Feed[]> {
    const now = new Date();

    return db.feed.findMany({
      where: {
        isActive: true,
        OR: [
          { nextFetchAt: null },
          { nextFetchAt: { lte: now } },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { nextFetchAt: 'asc' },
      ],
      take: limit,
    });
  }

  /**
   * 计算下次抓取时间
   */
  private calculateNextFetch(priority: number): Date {
    const baseInterval = 3600000; // 1小时
    const priorityMultiplier = 11 - priority; // 优先级越高，间隔越短
    const interval = baseInterval * priorityMultiplier;

    return new Date(Date.now() + interval);
  }

  /**
   * 更新未读计数
   */
  private async updateUnreadCount(feedId: string): Promise<void> {
    const unreadCount = await db.entry.count({
      where: {
        feedId,
        isRead: false,
      },
    });

    await db.feed.update({
      where: { id: feedId },
      data: { unreadCount },
    });
  }

  /**
   * 清理旧条目
   * @param daysToKeep 保留天数
   * @param userId 可选：指定用户ID，为null则清理所有用户的过期文章
   * @returns 清理结果
   */
  async cleanupOldEntries(
    daysToKeep: number = DEFAULT_ENTRY_RETENTION_DAYS,
    userId?: string | null
  ): Promise<CleanupResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const errors: string[] = [];

    try {
      await info('rss', '开始清理旧文章', {
        daysToKeep,
        cutoffDate: cutoffDate.toISOString(),
        userId: userId || 'all',
      });

      // 构建查询条件
      const whereClause: any = {
        createdAt: {
          lt: cutoffDate,
        },
        isRead: true,
        isStarred: false,
      };

      // 如果指定了用户ID，添加用户过滤
      if (userId) {
        whereClause.feed = {
          userId: userId,
        };
      }

      // 先统计将要删除的文章数量
      const toDeleteCount = await db.entry.count({
        where: whereClause,
      });

      // 统计符合清理条件但受保护的文章（未读或星标）
      const protectedWhereClause: any = {
        createdAt: {
          lt: cutoffDate,
        },
        OR: [
          { isRead: false },
          { isStarred: true },
        ],
      };

      if (userId) {
        protectedWhereClause.feed = {
          userId: userId,
        };
      }

      const preservedCount = await db.entry.count({
        where: protectedWhereClause,
      });

      // 执行删除
      const result = await db.entry.deleteMany({
        where: whereClause,
      });

      await info('rss', '清理旧文章完成', {
        daysToKeep,
        deletedCount: result.count,
        preservedCount,
        userId: userId || 'all',
      });

      return {
        deletedCount: result.count,
        preservedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errors.push(errorMessage);
      await error('rss', '清理旧文章失败', err instanceof Error ? err : undefined, {
        daysToKeep,
        userId: userId || 'all',
      });
      return {
        deletedCount: 0,
        preservedCount: 0,
        errors,
      };
    }
  }

  /**
   * 根据用户设置自动清理过期文章
   * 遍历所有用户，根据各自的设置清理文章
   */
  async autoCleanupByUserSettings(): Promise<{ totalDeleted: number; userCount: number; errors: string[] }> {
    const errors: string[] = [];
    let totalDeleted = 0;
    let userCount = 0;

    try {
      await info('rss', '开始自动清理：获取用户设置');

      // 获取所有用户及其偏好设置
      const users = await db.user.findMany({
        select: {
          id: true,
          preferences: true,
        },
      });

      for (const user of users) {
        try {
          const preferences = (user.preferences as any) || {};
          
          // 获取用户的文章保留设置（默认90天）
          const retentionDays = preferences.entryRetentionDays || DEFAULT_ENTRY_RETENTION_DAYS;
          
          // 如果设置为0或负数，表示不自动清理
          if (retentionDays <= 0) {
            await info('rss', '用户设置为不自动清理，跳过', {
              userId: user.id,
              retentionDays,
            });
            continue;
          }

          const result = await this.cleanupOldEntries(retentionDays, user.id);
          
          totalDeleted += result.deletedCount;
          userCount++;

          await info('rss', '用户自动清理完成', {
            userId: user.id,
            deletedCount: result.deletedCount,
            retentionDays,
          });
        } catch (userErr) {
          const errorMessage = userErr instanceof Error ? userErr.message : 'Unknown error';
          errors.push(`用户 ${user.id}: ${errorMessage}`);
          await error('rss', '用户自动清理失败', userErr instanceof Error ? userErr : undefined, {
            userId: user.id,
          });
        }
      }

      await info('rss', '自动清理全部完成', {
        totalDeleted,
        userCount,
        errorCount: errors.length,
      });

      return {
        totalDeleted,
        userCount,
        errors: errors.length > 0 ? errors : [],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errors.push(errorMessage);
      await error('rss', '自动清理失败', err instanceof Error ? err : undefined);
      return {
        totalDeleted,
        userCount,
        errors,
      };
    }
  }
}

// 单例导出
export const feedManager = new FeedManager();
