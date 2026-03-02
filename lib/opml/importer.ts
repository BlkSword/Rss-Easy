/**
 * OPML 快速导入服务
 *
 * 优化策略：
 * 1. 解析 OPML → 立即创建订阅源 → 快速返回
 * 2. 设置 nextFetchAt 触发调度器自动抓取
 * 3. 批量数据库操作替代串行
 */

import { db } from '@/lib/db';
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
  phase: 'parsing' | 'validating' | 'creating' | 'completed';
  current: number;
  total: number;
  currentItem?: string;
  message: string;
  stats: {
    imported: number;
    skipped: number;
    failed: number;
  };
  /** 后台任务数量 */
  backgroundTasks?: number;
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
  /** 触发抓取的订阅源数量 */
  triggeredFeeds?: number;
}

export interface ImportOptions {
  userId: string;
  categoryId?: string;
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

  return {
    ...progress,
    stats: { ...progress.stats },
  };
}

/**
 * 设置导入进度
 */
function setImportProgress(userId: string, progress: ImportProgress) {
  importProgressStore.set(userId, {
    ...progress,
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
 * 快速导入 OPML
 *
 * 流程：
 * 1. 解析 OPML（< 1秒）
 * 2. 批量检查重复（< 1秒）
 * 3. 批量创建订阅源（1-3秒）
 * 4. 添加后台任务（< 1秒）
 * 5. 立即返回结果
 *
 * 后台任务负责：
 * - 智能发现（补充描述、图标等）
 * - 首次抓取
 */
export async function smartImportOPML(
  xmlString: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { userId, categoryId, onProgress } = options;

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
    // ========================================
    // 阶段 1：解析 OPML（快速）
    // ========================================
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

    await info('rss', '开始 OPML 快速导入', {
      userId,
      totalFeeds: feeds.length,
    });

    // ========================================
    // 阶段 2：批量验证 URL（快速）
    // ========================================
    setImportProgress(userId, {
      phase: 'validating',
      current: 0,
      total: feeds.length,
      message: '正在验证订阅源...',
      stats: { imported: 0, skipped: 0, failed: 0 },
    });

    const validFeeds: ImportFeedItem[] = [];
    const invalidFeeds: Array<{ feed: ImportFeedItem; reason: string }> = [];

    for (const feed of feeds) {
      const urlCheck = isUrlSafe(feed.url);
      if (!urlCheck.safe) {
        invalidFeeds.push({ feed, reason: urlCheck.reason || 'URL 不安全' });
        result.failed++;
        result.errors.push({ url: feed.url, error: `URL 不安全: ${urlCheck.reason}` });
        result.details.push({
          url: feed.url,
          title: feed.title || feed.url,
          status: 'failed',
          message: `URL 不安全`,
        });
      } else {
        validFeeds.push(feed);
      }
    }

    // ========================================
    // 阶段 3：批量检查重复 + 批量创建（核心优化）
    // ========================================
    setImportProgress(userId, {
      phase: 'creating',
      current: 0,
      total: validFeeds.length,
      message: '正在导入订阅源...',
      stats: { imported: 0, skipped: 0, failed: result.failed },
    });

    // 3.1 获取用户现有订阅源（一次性查询）
    const existingFeeds = await db.feed.findMany({
      where: { userId },
      select: { feedUrl: true, title: true },
    });
    const existingUrlSet = new Set(existingFeeds.map((f: { feedUrl: string }) => f.feedUrl));

    // 3.2 获取用户现有分类（一次性查询）
    const existingCategories = await db.category.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    const categoryMap = new Map<string, string>(
      existingCategories.map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
    );

    // 3.3 准备创建数据
    const feedsToCreate: ImportFeedItem[] = [];
    const categoryToCreateSet = new Set<string>();

    for (const feed of validFeeds) {
      if (existingUrlSet.has(feed.url)) {
        // 已存在，跳过
        result.skipped++;
        result.details.push({
          url: feed.url,
          title: feed.title || feed.url,
          status: 'skipped',
          message: '订阅源已存在',
        });
      } else {
        feedsToCreate.push(feed);

        // 收集需要创建的分类
        if (feed.categoryOutline) {
          const categoryName = feed.categoryOutline.text || feed.categoryOutline.title;
          if (categoryName && !categoryMap.has(categoryName.toLowerCase())) {
            categoryToCreateSet.add(categoryName);
          }
        }
      }
    }

    // 3.4 批量创建分类
    if (categoryToCreateSet.size > 0) {
      const newCategories = await db.category.createMany({
        data: Array.from(categoryToCreateSet).map(name => ({
          userId,
          name,
          color: '#94a3b8',
        })),
        skipDuplicates: true,
      });

      // 重新获取分类映射
      if (newCategories.count > 0) {
        const updatedCategories = await db.category.findMany({
          where: { userId },
          select: { id: true, name: true },
        });
        categoryMap.clear();
        updatedCategories.forEach((c: { id: string; name: string }) => categoryMap.set(c.name.toLowerCase(), c.id));
      }
    }

    // 3.5 批量创建订阅源
    const importedFeedIds: string[] = [];

    if (feedsToCreate.length > 0) {
      // 使用 createMany 批量创建（不返回 ID，需要单独查询）
      await db.feed.createMany({
        data: feedsToCreate.map(feed => {
          // 确定分类
          let feedCategoryId: string | null | undefined = categoryId;
          if (feed.categoryOutline) {
            const categoryName = feed.categoryOutline.text || feed.categoryOutline.title;
            if (categoryName) {
              const foundId = categoryMap.get(categoryName.toLowerCase());
              if (foundId) {
                feedCategoryId = foundId;
              }
            }
          }

          // 生成标题
          let finalTitle = feed.title;
          if (!finalTitle) {
            try {
              finalTitle = new URL(feed.url).hostname;
            } catch {
              finalTitle = 'Unknown Feed';
            }
          }

          return {
            userId,
            feedUrl: feed.url,
            title: finalTitle,
            description: feed.description || '',
            siteUrl: feed.siteUrl || '',
            categoryId: feedCategoryId || null,
            fetchInterval: 3600,
            priority: 5,
            isActive: true,
          };
        }),
        skipDuplicates: true,
      });

      // 查询刚创建的订阅源 ID（通过 feedUrl 匹配）
      const createdFeeds = await db.feed.findMany({
        where: {
          userId,
          feedUrl: { in: feedsToCreate.map((f: ImportFeedItem) => f.url) },
        },
        select: { id: true, feedUrl: true, title: true },
      });

      importedFeedIds.push(...createdFeeds.map((f: { id: string }) => f.id));
      result.imported = createdFeeds.length;

      // 更新详情
      const createdUrlSet = new Set(createdFeeds.map((f: { feedUrl: string }) => f.feedUrl));
      for (const feed of feedsToCreate) {
        if (createdUrlSet.has(feed.url)) {
          const created = createdFeeds.find((f: { feedUrl: string; title: string }) => f.feedUrl === feed.url);
          result.details.push({
            url: feed.url,
            title: created?.title || feed.title || feed.url,
            status: 'imported',
          });
        } else {
          // 可能因为并发问题被跳过
          result.skipped++;
          result.details.push({
            url: feed.url,
            title: feed.title || feed.url,
            status: 'skipped',
            message: '订阅源已存在',
          });
        }
      }
    }

    // ========================================
    // 阶段 4：触发调度器抓取（利用现有机制）
    // ========================================
    if (importedFeedIds.length > 0) {
      // 设置 nextFetchAt 为当前时间，让调度器立即抓取
      await db.feed.updateMany({
        where: { id: { in: importedFeedIds } },
        data: { nextFetchAt: new Date() },
      });

      // 异步触发调度器（不等待）
      import('@/lib/rss/feed-manager').then(({ feedManager }) => {
        // 逐个触发抓取，使用调度器会自动处理
        importedFeedIds.forEach(feedId => {
          feedManager.fetchFeed(feedId).catch(err => {
            console.error(`触发抓取失败: ${feedId}`, err);
          });
        });
      }).catch(err => {
        console.error('导入 feed-manager 失败:', err);
      });

      await info('rss', 'OPML 导入已触发抓取', {
        userId,
        feedCount: importedFeedIds.length,
      });
    }

    // ========================================
    // 完成
    // ========================================
    setImportProgress(userId, {
      phase: 'completed',
      current: result.total,
      total: result.total,
      message: `导入完成: 成功 ${result.imported}, 跳过 ${result.skipped}, 失败 ${result.failed}`,
      stats: { imported: result.imported, skipped: result.skipped, failed: result.failed },
      backgroundTasks: importedFeedIds.length,
    });

    await info('rss', 'OPML 快速导入完成', {
      userId,
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed,
      total: result.total,
      triggeredFeeds: importedFeedIds.length,
    });

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

    await error('rss', 'OPML 导入失败', err instanceof Error ? err : undefined, { userId });
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
