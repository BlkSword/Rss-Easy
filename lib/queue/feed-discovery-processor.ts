/**
 * 订阅源发现队列处理器
 *
 * 用于后台处理 OPML 导入后的智能发现和首次抓取
 * 实现快速导入 + 后台丰富订阅源信息
 */

import { Queue, Worker, Job, JobsOptions } from 'bullmq';
import { db } from '@/lib/db';
import { parseFeed } from '@/lib/rss/parser';
import { info, error as logError } from '@/lib/logger';

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

export interface FeedDiscoveryJobData {
  feedId: string;
  feedUrl: string;
  userId: string;
  /** 是否触发首次抓取 */
  triggerFetch?: boolean;
}

export interface FeedDiscoveryJobResult {
  success: boolean;
  feedId: string;
  title?: string;
  description?: string;
  siteUrl?: string;
  iconUrl?: string;
  fetched?: boolean;
  entriesCount?: number;
  error?: string;
}

// =====================================================
// 队列定义（懒加载）
// =====================================================

let feedDiscoveryQueueInstance: Queue | null = null;

export function getFeedDiscoveryQueue(): Queue {
  if (!feedDiscoveryQueueInstance) {
    feedDiscoveryQueueInstance = new Queue('feed-discovery', {
      connection: REDIS_CONFIG,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // 1天后删除
          count: 200,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7天后删除
        },
      },
    });
  }
  return feedDiscoveryQueueInstance;
}

// =====================================================
// 智能发现函数（带可达性检查）
// =====================================================

async function discoverFeedInfo(url: string): Promise<{
  title: string | null;
  description: string | null;
  siteUrl: string | null;
  iconUrl: string | null;
  reachable: boolean;
  error?: string;
}> {
  let title: string | null = null;
  let description: string | null = null;
  let siteUrl: string | null = null;
  let iconUrl: string | null = null;

  try {
    // ========================================
    // 第一步：可达性检查（HEAD 请求，轻量快速）
    // ========================================
    try {
      const headResponse = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSS-Post/1.0)',
        },
        signal: AbortSignal.timeout(5000), // 5秒超时
      });

      // 检查响应状态
      if (!headResponse.ok) {
        return {
          title: null,
          description: null,
          siteUrl: null,
          iconUrl: null,
          reachable: false,
          error: `HTTP ${headResponse.status}: ${headResponse.statusText}`,
        };
      }

      // 检查 Content-Type 是否是有效的 RSS/Atom feed
      const contentType = headResponse.headers.get('content-type') || '';
      const validTypes = [
        'application/rss+xml',
        'application/atom+xml',
        'application/xml',
        'text/xml',
        'application/json', // JSON Feed
      ];
      const isFeedType = validTypes.some((t) => contentType.toLowerCase().includes(t));

      // 如果不是明显的 feed 类型，但可能是 text/html，也继续尝试
      if (!isFeedType && !contentType.includes('text/html')) {
        return {
          title: null,
          description: null,
          siteUrl: null,
          iconUrl: null,
          reachable: false,
          error: `不支持的 Content-Type: ${contentType}`,
        };
      }
    } catch (headError) {
      // HEAD 请求失败，可能服务器不支持 HEAD，继续尝试 GET
      console.warn(`HEAD 请求失败，尝试 GET: ${url}`, headError);
    }

    // ========================================
    // 第二步：解析 RSS Feed 内容
    // ========================================
    try {
      const parsed = await parseFeed(url);
      title = parsed.title || null;
      description = parsed.description || null;
      siteUrl = parsed.link || url;
    } catch {
      // RSS feed 解析失败，尝试从网页提取
    }

    // ========================================
    // 第三步：如果 RSS feed 中没有描述或标题，尝试从 HTML 网页提取
    // ========================================
    if (!title || !description) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSS-Post/1.0)',
        },
        signal: AbortSignal.timeout(8000), // 8秒超时
      });

      if (response.ok) {
        const html = await response.text();

        if (!title) {
          const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
          title = titleMatch?.[1]?.trim() || null;
        }

        if (!description) {
          const descPatterns = [
            /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
            /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i,
          ];

          for (const pattern of descPatterns) {
            const match = html.match(pattern);
            if (match?.[1]) {
              description = match[1].trim();
              break;
            }
          }
        }

        if (!iconUrl) {
          const iconPatterns = [
            /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i,
            /<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']+)["']/i,
          ];

          for (const pattern of iconPatterns) {
            const match = html.match(pattern);
            if (match?.[1]) {
              iconUrl = match[1].trim();
              if (iconUrl && !iconUrl.startsWith('http')) {
                try {
                  iconUrl = new URL(iconUrl, url).href;
                } catch {
                  iconUrl = null;
                }
              }
              break;
            }
          }
        }
      }
    }

    return { title, description, siteUrl, iconUrl, reachable: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      title: null,
      description: null,
      siteUrl: null,
      iconUrl: null,
      reachable: false,
      error: errorMessage,
    };
  }
}

// =====================================================
// 队列处理器
// =====================================================

export function createFeedDiscoveryWorker(): Worker<FeedDiscoveryJobData, FeedDiscoveryJobResult> {
  return new Worker<FeedDiscoveryJobData, FeedDiscoveryJobResult>(
    'feed-discovery',
    async (job: Job<FeedDiscoveryJobData>) => {
      const { feedId, feedUrl, userId, triggerFetch = true } = job.data;

      job.updateProgress(5);

      try {
        // 1. 获取当前订阅源信息
        const feed = await db.feed.findUnique({
          where: { id: feedId },
          select: { id: true, title: true, description: true, siteUrl: true },
        });

        if (!feed) {
          throw new Error(`订阅源 ${feedId} 不存在`);
        }

        job.updateProgress(10);

        // 2. 智能发现订阅源信息（包含可达性检查）
        const discovered = await discoverFeedInfo(feedUrl);

        job.updateProgress(40);

        // 3. 如果不可达，记录错误并返回
        if (!discovered.reachable) {
          await db.feed.update({
            where: { id: feedId },
            data: {
              errorCount: { increment: 1 },
              lastError: discovered.error || '订阅源不可达',
            },
          });

          await logError('rss', '订阅源不可达', undefined, {
            feedId,
            feedUrl,
            userId,
            error: discovered.error,
          });

          return {
            success: false,
            feedId,
            error: discovered.error || '订阅源不可达',
            fetched: false,
            entriesCount: 0,
          };
        }

        job.updateProgress(50);

        // 4. 更新订阅源信息（只更新缺失的字段）
        const updateData: Record<string, string | null> = {};

        if (!feed.title && discovered.title) {
          updateData.title = discovered.title;
        }
        if (!feed.description && discovered.description) {
          updateData.description = discovered.description;
        }
        if (!feed.siteUrl && discovered.siteUrl) {
          updateData.siteUrl = discovered.siteUrl;
        }
        if (discovered.iconUrl) {
          updateData.iconUrl = discovered.iconUrl;
        }

        if (Object.keys(updateData).length > 0) {
          await db.feed.update({
            where: { id: feedId },
            data: updateData,
          });
        }

        job.updateProgress(60);

        // 5. 触发首次抓取
        let fetched = false;
        let entriesCount = 0;

        if (triggerFetch) {
          try {
            const { feedManager } = await import('@/lib/rss/feed-manager');
            const result = await feedManager.fetchFeed(feedId);
            fetched = result?.success || false;
            entriesCount = result?.entriesAdded || 0;
          } catch (fetchError) {
            console.error(`首次抓取失败: ${feedId}`, fetchError);
            // 抓取失败不影响发现结果
          }
        }

        job.updateProgress(100);

        await info('rss', '订阅源发现完成', {
          feedId,
          feedUrl,
          userId,
          discovered: !!discovered.title,
          reachable: discovered.reachable,
          fetched,
          entriesCount,
        });

        return {
          success: true,
          feedId,
          title: discovered.title || undefined,
          description: discovered.description || undefined,
          siteUrl: discovered.siteUrl || undefined,
          iconUrl: discovered.iconUrl || undefined,
          fetched,
          entriesCount,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logError('rss', '订阅源发现失败', error instanceof Error ? error : undefined, {
          feedId,
          feedUrl,
          userId,
          errorMessage,
        });

        throw error;
      }
    },
    {
      connection: REDIS_CONFIG,
      concurrency: parseInt(process.env.FEED_DISCOVERY_CONCURRENCY || '3', 10), // 降低默认并发，避免网络过载
    }
  );
}

// =====================================================
// 队列操作函数
// =====================================================

/**
 * 添加发现任务
 */
export async function addFeedDiscoveryJob(
  data: FeedDiscoveryJobData,
  options?: JobsOptions
): Promise<string> {
  const queue = getFeedDiscoveryQueue();
  const job = await queue.add('discover', data, {
    priority: 5,
    ...options,
  });
  return job.id!;
}

/**
 * 批量添加发现任务
 */
export async function addFeedDiscoveryJobsBatch(
  jobs: FeedDiscoveryJobData[]
): Promise<string[]> {
  const queue = getFeedDiscoveryQueue();
  const jobPromises = jobs.map(data =>
    queue.add('discover', data, { priority: 5 })
  );
  const jobResults = await Promise.all(jobPromises);
  return jobResults.map(job => job.id!);
}

/**
 * 获取队列状态
 */
export async function getFeedDiscoveryQueueStatus() {
  const queue = getFeedDiscoveryQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed(),
    queue.getDelayed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
  };
}
