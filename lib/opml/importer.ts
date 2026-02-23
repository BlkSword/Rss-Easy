/**
 * OPML 智能导入服务
 * 与添加订阅源流程对齐，使用相同的智能发现功能
 *
 * 功能：
 * - 智能识别订阅源信息（与添加订阅源一致）
 * - SSRF 防护
 * - 完整的 OPML 解析（支持分类）
 * - 进度回调支持
 * - 日志记录
 */

import { db } from '@/lib/db';
import { parseFeed } from '@/lib/rss/parser';
import { info, warn, error } from '@/lib/logger';
import { isUrlSafe } from '@/lib/utils';
import { parseOPML, extractFeedsFromOPML, type OPMLOutline } from './parser';

export interface ImportFeedItem {
  url: string;
  title?: string;
  description?: string;
  siteUrl?: string;
  categoryOutline?: OPMLOutline; // 所属分类的 outline（用于创建分类）
}

export interface ImportProgress {
  current: number;
  total: number;
  currentUrl: string;
  status: 'pending' | 'discovering' | 'creating' | 'success' | 'skipped' | 'failed';
  message?: string;
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
  categoryId?: string; // 默认分类
  validateOnly?: boolean; // 只验证不导入
  skipDiscovery?: boolean; // 跳过智能发现（使用 OPML 中的信息）
  onProgress?: (progress: ImportProgress) => void;
}

/**
 * 智能发现订阅源信息
 * 复用添加订阅源的逻辑
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
        signal: AbortSignal.timeout(10000), // 10秒超时
      });

      if (response.ok) {
        const html = await response.text();

        // 提取标题（如果还没有）
        if (!title) {
          const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
          title = titleMatch?.[1]?.trim() || null;
        }

        // 提取描述（如果还没有）
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

          // 如果还是没找到，尝试从第一个段落提取
          if (!description) {
            const pMatch = html.match(/<p[^>]*>([^<]{20,200})<\/p>/i);
            description = pMatch?.[1]?.trim() || null;
          }
        }

        // 提取 favicon
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
 * 从 OPML 提取订阅源（保留分类信息）
 */
function extractFeedsWithCategories(outlines: OPMLOutline[], parentCategory?: OPMLOutline): ImportFeedItem[] {
  const feeds: ImportFeedItem[] = [];

  for (const outline of outlines) {
    if (outline.xmlUrl) {
      // 这是一个订阅源
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

    // 递归处理子 outline
    if (outline.outlines && outline.outlines.length > 0) {
      // 如果当前 outline 有 xmlUrl，它是分类容器
      // 否则，如果它有 text/title 但没有 xmlUrl，它可能是分类
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
  // 检查是否已存在
  const existingId = existingCategories.get(categoryName.toLowerCase());
  if (existingId) {
    return existingId;
  }

  // 创建新分类
  try {
    const category = await db.category.create({
      data: {
        userId,
        name: categoryName,
        color: '#94a3b8', // 默认颜色
      },
    });

    existingCategories.set(categoryName.toLowerCase(), category.id);
    await info('rss', 'OPML 导入创建分类', {
      userId,
      categoryName,
      categoryId: category.id,
    });

    return category.id;
  } catch (err) {
    await error('rss', 'OPML 导入创建分类失败', err instanceof Error ? err : undefined, {
      userId,
      categoryName,
    });
    return null;
  }
}

/**
 * 智能导入 OPML
 */
export async function smartImportOPML(
  xmlString: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { userId, categoryId, validateOnly, skipDiscovery, onProgress } = options;

  const result: ImportResult = {
    success: true,
    imported: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    errors: [],
    details: [],
  };

  try {
    // 解析 OPML
    const opml = parseOPML(xmlString);
    const feeds = extractFeedsWithCategories(opml.outlines);
    result.total = feeds.length;

    await info('rss', '开始 OPML 导入', {
      userId,
      totalFeeds: feeds.length,
      validateOnly,
    });

    if (validateOnly) {
      // 只验证模式
      for (let i = 0; i < feeds.length; i++) {
        const feed = feeds[i];
        onProgress?.({
          current: i + 1,
          total: feeds.length,
          currentUrl: feed.url,
          status: 'pending',
        });
        result.details.push({
          url: feed.url,
          title: feed.title || feed.url,
          status: 'imported',
        });
      }
      result.imported = feeds.length;
      return result;
    }

    // 获取用户现有分类（用于匹配和创建）
    const existingCategories = await db.category.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(
      existingCategories.map(c => [c.name.toLowerCase(), c.id])
    );

    // 收集成功导入的订阅源 ID，用于后续统一抓取
    const importedFeedIds: string[] = [];

    // 逐个处理订阅源
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];

      try {
        // 进度回调
        onProgress?.({
          current: i + 1,
          total: feeds.length,
          currentUrl: feed.url,
          status: 'pending',
        });

        // SSRF 防护
        const urlCheck = isUrlSafe(feed.url);
        if (!urlCheck.safe) {
          result.failed++;
          result.errors.push({ url: feed.url, error: `URL 不安全: ${urlCheck.reason}` });
          result.details.push({
            url: feed.url,
            title: feed.title || feed.url,
            status: 'failed',
            message: `URL 不安全: ${urlCheck.reason}`,
          });
          onProgress?.({
            current: i + 1,
            total: feeds.length,
            currentUrl: feed.url,
            status: 'failed',
            message: `URL 不安全`,
          });
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
          onProgress?.({
            current: i + 1,
            total: feeds.length,
            currentUrl: feed.url,
            status: 'skipped',
            message: '已存在',
          });
          continue;
        }

        // 智能发现
        onProgress?.({
          current: i + 1,
          total: feeds.length,
          currentUrl: feed.url,
          status: 'discovering',
        });

        let finalTitle = feed.title;
        let finalDescription = feed.description;
        let finalSiteUrl = feed.siteUrl;

        if (!skipDiscovery) {
          const discovered = await discoverFeedInfo(feed.url);

          // 优先级：OPML 中的值 > 智能发现的值
          finalTitle = finalTitle || discovered.title || undefined;
          finalDescription = finalDescription || discovered.description || undefined;
          finalSiteUrl = finalSiteUrl || discovered.siteUrl || undefined;
        }

        // 确定分类
        let feedCategoryId = categoryId;

        // 如果 OPML 中有分类信息，尝试匹配或创建
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
        onProgress?.({
          current: i + 1,
          total: feeds.length,
          currentUrl: feed.url,
          status: 'creating',
        });

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
            // 不设置 nextFetchAt，等所有导入完成后再统一设置
          },
        });

        // 收集导入成功的订阅源 ID
        importedFeedIds.push(newFeed.id);

        result.imported++;
        result.details.push({
          url: feed.url,
          title: finalTitle,
          status: 'imported',
        });

        onProgress?.({
          current: i + 1,
          total: feeds.length,
          currentUrl: feed.url,
          status: 'success',
          message: finalTitle,
        });

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

        onProgress?.({
          current: i + 1,
          total: feeds.length,
          currentUrl: feed.url,
          status: 'failed',
          message: errorMsg,
        });
      }
    }

    // 所有导入完成后，统一设置 nextFetchAt 并触发抓取
    if (importedFeedIds.length > 0) {
      await info('rss', 'OPML 导入完成，开始触发抓取', {
        userId,
        importedCount: importedFeedIds.length,
      });

      // 更新所有导入的订阅源的 nextFetchAt
      await db.feed.updateMany({
        where: {
          id: { in: importedFeedIds },
        },
        data: {
          nextFetchAt: new Date(),
        },
      });

      // 异步触发抓取（不等待）
      const { feedManager } = await import('@/lib/rss/feed-manager');
      for (const feedId of importedFeedIds) {
        feedManager.fetchFeed(feedId).catch(console.error);
      }
    }

    await info('rss', 'OPML 导入完成', {
      userId,
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed,
      total: result.total,
    });

  } catch (err) {
    result.success = false;
    const errorMsg = err instanceof Error ? err.message : 'OPML 解析失败';
    result.errors.push({ url: '', error: errorMsg });

    await error('rss', 'OPML 导入失败', err instanceof Error ? err : undefined, {
      userId,
    });
  }

  return result;
}

/**
 * 预览 OPML 内容
 * 返回将要导入的订阅源列表，不执行实际导入
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
