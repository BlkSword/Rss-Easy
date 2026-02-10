/**
 * Feed管理器
 * 负责feed的抓取、更新、去重等操作
 */

import { db } from '../db';
import { parseFeed } from './parser';
import { generateContentHash } from '../utils';
import { info, warn, error } from '../logger';
import type { Feed, Entry } from '@prisma/client';

export interface FeedUpdateResult {
  success: boolean;
  entriesAdded: number;
  entriesUpdated: number;
  error?: string;
}

/**
 * Feed管理器类
 */
export class FeedManager {
  /**
   * 抓取单个feed
   */
  async fetchFeed(feedId: string): Promise<FeedUpdateResult> {
    const startTime = Date.now();
    try {
      // 获取feed信息
      const feed = await db.feed.findUnique({
        where: { id: feedId },
      });

      if (!feed) {
        await warn('rss', '订阅源不存在', { feedId });
        return { success: false, entriesAdded: 0, entriesUpdated: 0, error: 'Feed not found' };
      }

      await info('rss', '开始抓取订阅源', { feedId, feedUrl: feed.feedUrl, title: feed.title });

      // 解析RSS feed
      const parsedFeed = await parseFeed(feed.feedUrl);

      let entriesAdded = 0;
      let entriesUpdated = 0;

      // 处理每个条目
      for (const item of parsedFeed.items) {
        const contentHash = await generateContentHash(
          `${item.title}${item.link}${item.content || ''}`
        );

        // 检查是否已存在
        const existingEntry = await db.entry.findUnique({
          where: { contentHash },
        });

        if (existingEntry) {
          // 更新现有条目
          await db.entry.update({
            where: { id: existingEntry.id },
            data: {
              title: item.title,
              content: item.content,
              summary: item.contentSnippet,
              url: item.link,
              publishedAt: item.pubDate,
              author: item.author,
            },
          });
          entriesUpdated++;
        } else {
          // 创建新条目
          await db.entry.create({
            data: {
              feedId: feed.id,
              title: item.title,
              url: item.link,
              content: item.content,
              summary: item.contentSnippet,
              contentHash,
              publishedAt: item.pubDate,
              author: item.author,
              tags: item.categories || [],
            },
          });
          entriesAdded++;
        }
      }

      const duration = Date.now() - startTime;
      await info('rss', '订阅源抓取完成', { 
        feedId, 
        title: feed.title,
        entriesAdded, 
        entriesUpdated,
        duration,
      });

      // 更新feed信息
      await db.feed.update({
        where: { id: feedId },
        data: {
          lastFetchedAt: new Date(),
          lastSuccessAt: new Date(),
          nextFetchAt: this.calculateNextFetch(feed.priority),
          totalEntries: {
            increment: entriesAdded,
          },
          errorCount: 0,
          lastError: null,
        },
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
        duration,
        error: errorMessage,
      });

      // 更新错误信息
      await db.feed.update({
        where: { id: feedId },
        data: {
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
   * 批量抓取feeds
   */
  async fetchMultipleFeeds(feedIds: string[]): Promise<FeedUpdateResult[]> {
    const results = await Promise.allSettled(
      feedIds.map((id) => this.fetchFeed(id))
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
   */
  async cleanupOldEntries(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db.entry.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        isRead: true,
        isStarred: false,
      },
    });

    return result.count;
  }
}

// 单例导出
export const feedManager = new FeedManager();
