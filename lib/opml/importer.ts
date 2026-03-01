/**
 * OPML 智能导入服务
 * 与添加订阅源流程对齐，使用相同的智能发现功能
 *
 * 功能：
 * - 智能识别订阅源信息（与添加订阅源一致）
 * - 并行智能发现，提升导入速度
 * - SSRF 防护
 * - 完整的 OPML 解析（支持分类）
 * - 进度追踪支持（细粒度实时更新）
 * - 日志记录
 */

import { db } from '@/lib/db';
import { parseFeed } from '@/lib/rss/parser';
import { info, warn, error } from '@/lib/logger';
import { isUrlSafe } from '@/lib/utils';
import { parseOPML, type OPMLOutline } from './parser';

export interface ImportFeedItem {
  url: string;
  title?: string;
  description?: string;
  siteUrl?: string;
  categoryOutline?: OPMLOutline;
}

export interface ImportProgress {
  phase: 'parsing' | 'discovering' | 'creating' | 'fetching' | 'completed';
  current: number;
  total: number;
  currentItem?: string;
  message: string;
  stats: {
    imported: number;
    skipped: number;
    failed: number;
  };
  /** 发现阶段统计 */
  discoveredCount?: number;
  /** 开始时间 */
  startTime?: number;
  /** 最后更新时间 */
  lastUpdate?: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  skipped: number;
  total: number;
  errors: Array<{ url: string; error: string }>;
  details: Array<{
    url: string;
    title: string;
    status: 'imported' | 'skipped' | 'failed';
    message?: string;
  }>;
}

export interface ImportOptions {
  userId: string;
  categoryId?: string;
  skipDiscovery?: boolean;
  concurrency?: number; // 并行数量，默认 5
  onProgress?: (progress: ImportProgress) => void;
}

// 存储导入进度（用于轮询）
const importProgressStore = new Map<string, ImportProgress>();

/**
 * 获取导入进度
 */
export function getImportProgress(userId: string): ImportProgress | null {
  const progress = importProgressStore.get(userId);
  if (!progress) return null;

  // 返回副本，避免外部修改
  return {
    ...progress,
    stats: { ...progress.stats },
  };
}

/**
 * 设置导入进度（带时间戳）
 */
function setImportProgress(userId: string, progress: ImportProgress) {
  const now = Date.now();
  importProgressStore.set(userId, {
    ...progress,
    lastUpdate: now,
    startTime: progress.startTime || now,
    stats: { ...progress.stats },
  });
}

/**
 * 清除导入进度
 */
export function clearImportProgress(userId: string) {
  importProgressStore.delete(userId);
}

/**
 * 智能发现订阅源信息
 */
async function discoverFeedInfo(url: string): Promise<{
  title: string | null;
  description: string | null;
  siteUrl: string | null;
  iconUrl: string | null;
}> {
  let title: string | null = null;
  let description: string | null = null;
  let siteUrl: string | null = null;
  let iconUrl: string | null = null;

  try {
    // 首先尝试直接解析 RSS feed
    try {
      const parsed = await parseFeed(url);
      title = parsed.title || null;
      description = parsed.description || null;
      siteUrl = parsed.link || url;
    } catch (feedError) {
      // RSS feed 解析失败，尝试从网页提取
    }

    // 如果 RSS feed 中没有描述或标题，尝试从 HTML 网页提取
    if (!title || !description) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Rss-Easy/1.0)',
        },
        signal: AbortSignal.timeout(10000),
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
            /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i,
          ];

          for (const pattern of descPatterns) {
            const match = html.match(pattern);
            if (match?.[1]) {
              description = match[1].trim();
              break;
            }
          }

          if (!description) {
            const pMatch = html.match(/<p[^>]*>([^<]{20,200})<\/p>/i);
            description = pMatch?.[1]?.trim() || null;
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
  } catch (err) {
    // 发现失败，返回 null
  }

  return { title, description, siteUrl, iconUrl };
}

/**
 * 批量并行智能发现（带实时进度更新）
 */
async function batchDiscoverFeedInfo(
  feeds: ImportFeedItem[],
  concurrency: number,
  userId: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<Map<string, Awaited<ReturnType<typeof discoverFeedInfo>>>> {
  const results = new Map<string, Awaited<ReturnType<typeof discoverFeedInfo>>>();
  let discoveredCount = 0;

  // 分批并行处理，每批完成后更新进度
  for (let i = 0; i < feeds.length; i += concurrency) {
    const batch = feeds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (feed) => {
        try {
          const info = await discoverFeedInfo(feed.url);
          return { url: feed.url, info };
        } catch (err) {
          return { url: feed.url, info: { title: null, description: null, siteUrl: null, iconUrl: null } };
        }
      })
    );

    for (const { url, info } of batchResults) {
      results.set(url, info);
    }

    // 更新进度
    discoveredCount = Math.min(i + concurrency, feeds.length);
    const progress: ImportProgress = {
      phase: 'discovering',
      current: discoveredCount,
      total: feeds.length,
      message: `正在智能识别: ${discoveredCount}/${feeds.length}`,
      stats: { imported: 0, skipped: 0, failed: 0 },
      discoveredCount,
    };

    setImportProgress(userId, progress);
    onProgress?.(progress);
  }

  return results;
}

/**
 * 从 OPML 提取订阅源（保留分类信息）
 */
function extractFeedsWithCategories(outlines: OPMLOutline[], parentCategory?: OPMLOutline): ImportFeedItem[] {
  const feeds: ImportFeedItem[] = [];

  for (const outline of outlines) {
    if (outline.xmlUrl) {
      const isFeedType = !outline.type ||
        outline.type.toLowerCase() === 'rss' ||
        outline.type.toLowerCase() === 'atom' ||
        outline.type.toLowerCase() === 'feed';

      if (isFeedType) {
        feeds.push({
          url: outline.xmlUrl,
          title: outline.text || outline.title,
          description: outline.description,
          siteUrl: outline.htmlUrl,
          categoryOutline: parentCategory,
        });
      }
    }

    if (outline.outlines && outline.outlines.length > 0) {
      const isCategoryOutline = !outline.xmlUrl && (outline.text || outline.title);
      feeds.push(...extractFeedsWithCategories(
        outline.outlines,
        isCategoryOutline ? outline : parentCategory
      ));
    }
  }

  return feeds;
}

/**
 * 获取或创建分类
 */
async function getOrCreateCategory(
  userId: string,
  categoryName: string,
  existingCategories: Map<string, string>
): Promise<string | null> {
  const existingId = existingCategories.get(categoryName.toLowerCase());
  if (existingId) {
    return existingId;
  }

  try {
    const category = await db.category.create({
      data: {
        userId,
        name: categoryName,
        color: '#94a3b8',
      },
    });

    existingCategories.set(categoryName.toLowerCase(), category.id);
    info('rss', 'OPML 导入创建分类', {
      userId,
      categoryName,
      categoryId: category.id,
    }).catch(() => {});

    return category.id;
  } catch (err) {
    error('rss', 'OPML 导入创建分类失败', err instanceof Error ? err : undefined, {
      userId,
      categoryName,
    }).catch(() => {});
    return null;
  }
}

/**
 * 智能导入 OPML（带进度追踪）
 */
export async function smartImportOPML(
  xmlString: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { userId, categoryId, skipDiscovery, concurrency = 5, onProgress } = options;

  const result: ImportResult = {
    success: true,
    imported: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    errors: [],
    details: [],
  };

  let feeds: ImportFeedItem[] = [];

  try {
    // 阶段 1：解析 OPML
    setImportProgress(userId, {
      phase: 'parsing',
      current: 0,
      total: 0,
      message: '正在解析 OPML 文件...',
      stats: { imported: 0, skipped: 0, failed: 0 },
    });
    onProgress?.({
      phase: 'parsing',
      current: 0,
      total: 0,
      message: '正在解析 OPML 文件...',
      stats: { imported: 0, skipped: 0, failed: 0 },
    });

    const opml = parseOPML(xmlString);
    feeds = extractFeedsWithCategories(opml.outlines);
    result.total = feeds.length;

    info('rss', '开始 OPML 导入', {
      userId,
      totalFeeds: feeds.length,
    }).catch(() => {});

    if (feeds.length === 0) {
      setImportProgress(userId, {
        phase: 'completed',
        current: 0,
        total: 0,
        message: 'OPML 文件中没有找到订阅源',
        stats: { imported: 0, skipped: 0, failed: 0 },
      });
      return result;
    }

    // 获取用户现有分类
    const existingCategories = await db.category.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(
      existingCategories.map(c => [c.name.toLowerCase(), c.id])
    );

    // 阶段 2：并行智能发现（带实时进度）
    let discoveredInfos: Map<string, Awaited<ReturnType<typeof discoverFeedInfo>>> = new Map();

    if (!skipDiscovery) {
      discoveredInfos = await batchDiscoverFeedInfo(feeds, concurrency, userId, onProgress);
    }

    // 阶段 3：逐个创建订阅源（带实时进度）
    const importedFeedIds: string[] = [];

    // 辅助函数：更新创建进度
    const updateCreatingProgress = (feed: ImportFeedItem, index: number) => {
      const progress: ImportProgress = {
        phase: 'creating',
        current: index + 1,
        total: feeds.length,
        currentItem: feed.title || feed.url,
        message: `正在导入: ${feed.title || new URL(feed.url).hostname}`,
        stats: { imported: result.imported, skipped: result.skipped, failed: result.failed },
      };
      setImportProgress(userId, progress);
      onProgress?.(progress);
    };

    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];

      // 开始处理前更新进度（显示正在处理哪个）
      updateCreatingProgress(feed, i);

      try {
        // SSRF 防护
        const urlCheck = isUrlSafe(feed.url);
        if (!urlCheck.safe) {
          result.failed++;
          result.errors.push({ url: feed.url, error: `URL 不安全: ${urlCheck.reason}` });
          result.details.push({
            url: feed.url,
            title: feed.title || feed.url,
            status: 'failed',
            message: `URL 不安全`,
          });
          // 更新统计
          updateCreatingProgress(feed, i);
          continue;
        }

        // 检查是否已存在
        const existing = await db.feed.findFirst({
          where: { userId, feedUrl: feed.url },
          select: { id: true, title: true },
        });

        if (existing) {
          result.skipped++;
          result.details.push({
            url: feed.url,
            title: existing.title,
            status: 'skipped',
            message: '订阅源已存在',
          });
          // 更新统计
          updateCreatingProgress(feed, i);
          continue;
        }

        // 获取智能发现的信息
        const discovered = discoveredInfos.get(feed.url);

        // 合并信息（OPML 中的值优先）
        let finalTitle = feed.title || discovered?.title || undefined;
        let finalDescription = feed.description || discovered?.description || undefined;
        let finalSiteUrl = feed.siteUrl || discovered?.siteUrl || undefined;

        // 确定分类
        let feedCategoryId = categoryId;

        if (feed.categoryOutline) {
          const categoryName = feed.categoryOutline.text || feed.categoryOutline.title;
          if (categoryName) {
            const foundOrCreateId = await getOrCreateCategory(userId, categoryName, categoryMap);
            if (foundOrCreateId) {
              feedCategoryId = foundOrCreateId;
            }
          }
        }

        // 最终回退
        if (!finalTitle) {
          try {
            finalTitle = new URL(feed.url).hostname;
          } catch {
            finalTitle = 'Unknown Feed';
          }
        }

        // 创建订阅源
        const newFeed = await db.feed.create({
          data: {
            userId,
            feedUrl: feed.url,
            title: finalTitle,
            description: finalDescription || '',
            siteUrl: finalSiteUrl || '',
            categoryId: feedCategoryId || null,
            fetchInterval: 3600,
            priority: 5,
            isActive: true,
          },
        });

        importedFeedIds.push(newFeed.id);
        result.imported++;
        result.details.push({
          url: feed.url,
          title: finalTitle,
          status: 'imported',
        });

        // 更新统计（成功）
        updateCreatingProgress(feed, i);

      } catch (err) {
        result.failed++;
        const errorMsg = err instanceof Error ? err.message : '导入失败';
        result.errors.push({ url: feed.url, error: errorMsg });
        result.details.push({
          url: feed.url,
          title: feed.title || feed.url,
          status: 'failed',
          message: errorMsg,
        });

        // 更新统计（失败）
        updateCreatingProgress(feed, i);
      }
    }

    // 阶段 4：触发抓取
    if (importedFeedIds.length > 0) {
      setImportProgress(userId, {
        phase: 'fetching',
        current: importedFeedIds.length,
        total: importedFeedIds.length,
        message: '正在触发订阅源抓取...',
        stats: { imported: result.imported, skipped: result.skipped, failed: result.failed },
      });
      onProgress?.({
        phase: 'fetching',
        current: importedFeedIds.length,
        total: importedFeedIds.length,
        message: '正在触发订阅源抓取...',
        stats: { imported: result.imported, skipped: result.skipped, failed: result.failed },
      });

      // 更新所有导入的订阅源的 nextFetchAt
      await db.feed.updateMany({
        where: { id: { in: importedFeedIds } },
        data: { nextFetchAt: new Date() },
      });

      // 异步触发抓取
      const { feedManager } = await import('@/lib/rss/feed-manager');
      for (const feedId of importedFeedIds) {
        feedManager.fetchFeed(feedId).catch(console.error);
      }
    }

    // 完成
    setImportProgress(userId, {
      phase: 'completed',
      current: feeds.length,
      total: feeds.length,
      message: `导入完成: 成功 ${result.imported}, 跳过 ${result.skipped}, 失败 ${result.failed}`,
      stats: { imported: result.imported, skipped: result.skipped, failed: result.failed },
    });
    onProgress?.({
      phase: 'completed',
      current: feeds.length,
      total: feeds.length,
      message: `导入完成: 成功 ${result.imported}, 跳过 ${result.skipped}, 失败 ${result.failed}`,
      stats: { imported: result.imported, skipped: result.skipped, failed: result.failed },
    });

    info('rss', 'OPML 导入完成', {
      userId,
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed,
      total: result.total,
    }).catch(() => {});

  } catch (err) {
    result.success = false;
    const errorMsg = err instanceof Error ? err.message : 'OPML 解析失败';
    result.errors.push({ url: '', error: errorMsg });

    setImportProgress(userId, {
      phase: 'completed',
      current: 0,
      total: 0,
      message: `导入失败: ${errorMsg}`,
      stats: { imported: 0, skipped: 0, failed: 1 },
    });

    error('rss', 'OPML 导入失败', err instanceof Error ? err : undefined, { userId }).catch(() => {});
  }

  return result;
}

/**
 * 预览 OPML 内容
 */
export async function previewOPML(xmlString: string): Promise<{
  success: boolean;
  title: string;
  feeds: Array<{
    url: string;
    title: string;
    category?: string;
  }>;
  categories: string[];
  error?: string;
}> {
  try {
    const opml = parseOPML(xmlString);
    const feeds = extractFeedsWithCategories(opml.outlines);

    const categories = new Set<string>();
    const feedList = feeds.map(f => {
      const category = f.categoryOutline?.text || f.categoryOutline?.title;
      if (category) {
        categories.add(category);
      }
      return {
        url: f.url,
        title: f.title || f.url,
        category,
      };
    });

    return {
      success: true,
      title: opml.title,
      feeds: feedList,
      categories: Array.from(categories),
    };
  } catch (err) {
    return {
      success: false,
      title: '',
      feeds: [],
      categories: [],
      error: err instanceof Error ? err.message : 'OPML 解析失败',
    };
  }
}
