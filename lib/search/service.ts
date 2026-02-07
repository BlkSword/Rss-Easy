/**
 * 全文搜索服务
 * 支持关键词搜索、语义搜索和混合搜索
 */

import { db } from '../db';
import type { Prisma } from '@prisma/client';

export interface SearchFilters {
  feedIds?: string[];
  categoryIds?: string[];
  tags?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  startDate?: Date;
  endDate?: Date;
  minImportance?: number;
}

export interface SearchResult {
  entryId: string;
  title: string;
  url: string;
  summary: string | null;
  feedTitle: string;
  feedId: string;
  publishedAt: Date | null;
  isRead: boolean;
  isStarred: boolean;
  aiCategory: string | null;
  aiImportanceScore: number;
  relevanceScore: number;
  highlights?: {
    title: string[];
    content: string[];
  };
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
  semanticSearch?: boolean;
  includeHighlights?: boolean;
}

/**
 * 全文搜索服务
 */
export class SearchService {
  /**
   * 关键词搜索
   */
  async keywordSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<{ results: SearchResult[]; total: number }> {
    const { limit = 20, offset = 0, filters = {}, includeHighlights = true } = options;

    // 构建 WHERE 条件
    const where: Prisma.EntryWhereInput = {
      AND: [
        // 关键词搜索
        {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { summary: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
            { aiKeywords: { has: query } },
          ],
        },
        // 应用过滤器
        ...this.buildFilters(filters),
      ],
    };

    // 查询总数
    const total = await db.entry.count({ where });

    // 查询结果
    const entries = await db.entry.findMany({
      where,
      include: {
        feed: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [
        { publishedAt: 'desc' },
        { aiImportanceScore: 'desc' },
      ],
      take: limit,
      skip: offset,
    });

    // 转换结果并计算相关性得分
    const results: SearchResult[] = entries.map((entry) => ({
      entryId: entry.id,
      title: entry.title,
      url: entry.url,
      summary: entry.summary,
      feedTitle: entry.feed.title,
      feedId: entry.feed.id,
      publishedAt: entry.publishedAt,
      isRead: entry.isRead,
      isStarred: entry.isStarred,
      aiCategory: entry.aiCategory,
      aiImportanceScore: entry.aiImportanceScore,
      relevanceScore: this.calculateRelevanceScore(query, entry),
      highlights: includeHighlights ? this.generateHighlights(query, entry) : undefined,
    }));

    // 按相关性排序
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return { results, total };
  }

  /**
   * 语义搜索（使用向量嵌入）
   */
  async semanticSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<{ results: SearchResult[]; total: number }> {
    const { limit = 20, offset = 0, filters = {} } = options;

    try {
      // 获取 AI 服务生成查询嵌入
      const { getDefaultAIService } = await import('../ai/client');
      const aiService = getDefaultAIService();
      const { embedding } = await aiService.generateEmbedding(query);

      // 构建 WHERE 条件
      const whereConditions = this.buildFilters(filters);

      // 使用 pgvector 进行相似度搜索
      // 计算余弦相似度
      const similaritySql = `
        1 - (embedding <=> '[${embedding.join(',')}]'::vector)
      `.trim();

      // 查询相似度最高的文章
      const entries = await db.$queryRaw`
        SELECT
          e.id,
          e.title,
          e.url,
          e.summary,
          e.published_at,
          e.is_read,
          e.is_starred,
          e.ai_category,
          e.ai_importance_score,
          e.content,
          f.id as "feedId",
          f.title as "feedTitle"
        FROM "Entry" e
        LEFT JOIN "Feed" f ON e."feedId" = f.id
        WHERE e.embedding IS NOT NULL
          ${whereConditions.length > 0 ? this.buildSqlWhere(whereConditions) : ''}
        ORDER BY (e.embedding <=> '[${embedding.join(',')}]'::vector) ASC
        LIMIT ${limit}
        OFFSET ${offset}
      ` as any[];

      // 查询总数（对于相似度搜索，我们只返回有嵌入的条目）
      const totalResult = await db.$queryRaw`
        SELECT COUNT(*) as count
        FROM "Entry" e
        WHERE e.embedding IS NOT NULL
          ${whereConditions.length > 0 ? this.buildSqlWhere(whereConditions) : ''}
      ` as { count: bigint }[];
      const total = Number(totalResult[0].count);

      // 转换结果并计算相关性得分
      const results: SearchResult[] = entries.map((entry: any) => ({
        entryId: entry.id,
        title: entry.title,
        url: entry.url,
        summary: entry.summary,
        feedTitle: entry.feedTitle,
        feedId: entry.feedId,
        publishedAt: entry.publishedAt ? new Date(entry.publishedAt) : null,
        isRead: entry.is_read,
        isStarred: entry.is_starred,
        aiCategory: entry.ai_category,
        aiImportanceScore: entry.ai_importance_score || 0,
        relevanceScore: 1 - parseFloat(entry.similarity || '0'), // 相似度转换为相关性得分
        highlights: this.generateHighlights(query, {
          title: entry.title,
          summary: entry.summary,
          content: entry.content,
        }),
      }));

      return { results, total };
    } catch (error) {
      console.error('语义搜索失败，回退到关键词搜索:', error);
      return this.keywordSearch(query, options);
    }
  }

  /**
   * 混合搜索（结合关键词和语义搜索）
   */
  async hybridSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<{ results: SearchResult[]; total: number }> {
    const { limit = 20, offset = 0, semanticSearch = false } = options;

    if (semanticSearch) {
      // 语义搜索 + 关键词过滤
      return this.semanticSearch(query, options);
    }

    // 纯关键词搜索
    return this.keywordSearch(query, options);
  }

  /**
   * 构建过滤条件
   */
  private buildFilters(filters: SearchFilters): Prisma.EntryWhereInput[] {
    const conditions: Prisma.EntryWhereInput[] = [];

    if (filters.feedIds && filters.feedIds.length > 0) {
      conditions.push({ feedId: { in: filters.feedIds } });
    }

    if (filters.categoryIds && filters.categoryIds.length > 0) {
      conditions.push({
        feed: {
          categoryId: { in: filters.categoryIds },
        },
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      conditions.push({
        OR: filters.tags.map((tag) => ({ tags: { has: tag } })),
      });
    }

    if (filters.isRead !== undefined) {
      conditions.push({ isRead: filters.isRead });
    }

    if (filters.isStarred !== undefined) {
      conditions.push({ isStarred: filters.isStarred });
    }

    if (filters.startDate) {
      conditions.push({ publishedAt: { gte: filters.startDate } });
    }

    if (filters.endDate) {
      conditions.push({ publishedAt: { lte: filters.endDate } });
    }

    if (filters.minImportance !== undefined) {
      conditions.push({ aiImportanceScore: { gte: filters.minImportance } });
    }

    return conditions;
  }

  /**
   * 构建 SQL WHERE 条件（用于原始查询）
   */
  private buildSqlWhere(conditions: Prisma.EntryWhereInput[]): string {
    if (conditions.length === 0) return '';

    const parts: string[] = [];
    for (const condition of conditions) {
      if (condition.feedId) {
        parts.push(`e."feedId" = '${(condition.feedId as any).in?.[0] || ''}'`);
      }
      if (condition.feed?.categoryId) {
        parts.push(`f."categoryId" = '${(condition.feed?.categoryId as any).in?.[0] || ''}'`);
      }
      if (condition.isRead !== undefined) {
        parts.push(`e."isRead" = ${condition.isRead}`);
      }
      if (condition.isStarred !== undefined) {
        parts.push(`e."isStarred" = ${condition.isStarred}`);
      }
      if ((condition.publishedAt as any)?.gte instanceof Date) {
        parts.push(`e.published_at >= '${(condition.publishedAt as any).gte.toISOString()}'`);
      }
      if ((condition.publishedAt as any)?.lte instanceof Date) {
        parts.push(`e.published_at <= '${(condition.publishedAt as any).lte.toISOString()}'`);
      }
      if (typeof (condition.aiImportanceScore as any)?.gte === 'number') {
        parts.push(`e.ai_importance_score >= ${(condition.aiImportanceScore as any).gte}`);
      }
    }

    return parts.length > 0 ? `AND ${parts.join(' AND ')}` : '';
  }

  /**
   * 计算相关性得分
   */
  private calculateRelevanceScore(query: string, entry: any): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // 标题匹配（权重最高）
    if (entry.title?.toLowerCase().includes(queryLower)) {
      score += 10;
      // 完全匹配额外加分
      if (entry.title.toLowerCase() === queryLower) {
        score += 20;
      }
    }

    // AI 关键词匹配
    if (entry.aiKeywords?.some((k: string) => k.toLowerCase().includes(queryLower))) {
      score += 8;
    }

    // AI 分类匹配
    if (entry.aiCategory?.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    // 摘要匹配
    if (entry.summary?.toLowerCase().includes(queryLower)) {
      score += 3;
    }

    // 内容匹配
    if (entry.content?.toLowerCase().includes(queryLower)) {
      score += 2;
    }

    // 重要性加权
    score *= (1 + entry.aiImportanceScore * 0.5);

    // 未读文章加权
    if (!entry.isRead) {
      score *= 1.2;
    }

    return score;
  }

  /**
   * 生成高亮片段
   */
  private generateHighlights(query: string, entry: any): {
    title: string[];
    content: string[];
  } {
    const highlights = {
      title: [] as string[],
      content: [] as string[],
    };

    const queryLower = query.toLowerCase();
    const highlightTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    // 标题高亮
    if (entry.title && highlightTerms.some((t) => entry.title.toLowerCase().includes(t))) {
      highlights.title.push(entry.title);
    }

    // 内容高亮（提取包含关键词的片段）
    if (entry.content || entry.summary) {
      const text = entry.content || entry.summary;
      const sentences = text.split(/[。！？.!?]/);
      const matchingSentences = sentences
        .filter((s: string) => highlightTerms.some((t) => s.toLowerCase().includes(t)))
        .slice(0, 3);

      highlights.content.push(...matchingSentences);
    }

    return highlights;
  }

  /**
   * 获取搜索建议
   */
  async getSuggestions(query: string, limit = 5): Promise<string[]> {
    if (query.length < 2) {
      return [];
    }

    // 从历史搜索中获取建议
    const searchHistory = await db.searchHistory.findMany({
      where: {
        query: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      distinct: ['query'],
    });

    const suggestions = searchHistory.map((h) => h.query);

    // 从 AI 关键词中获取建议
    const keywords = await db.entry
      .findMany({
        where: {
          aiKeywords: {
            has: query,
          },
        },
        select: {
          aiKeywords: true,
        },
        take: limit,
      })
      .then((entries) => {
        const allKeywords = entries.flatMap((e) => e.aiKeywords);
        return [...new Set(allKeywords)].filter((k) => k.toLowerCase().includes(query));
      });

    return [...new Set([...suggestions, ...keywords])].slice(0, limit);
  }

  /**
   * 保存搜索历史
   */
  async saveSearchHistory(
    userId: string,
    query: string,
    resultsCount: number,
    filters?: SearchFilters
  ): Promise<void> {
    await db.searchHistory.create({
      data: {
        userId,
        query,
        resultsCount,
        filters: filters as any,
      },
    });
  }

  /**
   * 获取热门搜索词
   */
  async getPopularSearches(userId: string, limit = 10): Promise<Array<{ query: string; count: number }>> {
    const searches = await db.searchHistory.groupBy({
      by: ['query'],
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 最近30天
        },
      },
      _count: {
        query: true,
      },
      orderBy: {
        _count: {
          query: 'desc',
        },
      },
      take: limit,
    });

    return searches.map((s) => ({
      query: s.query,
      count: s._count.query,
    }));
  }

  /**
   * 清理旧的搜索历史
   */
  async cleanupSearchHistory(userId: string, olderThanDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.searchHistory.deleteMany({
      where: {
        userId,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

// 导出单例实例
let searchServiceInstance: SearchService | null = null;

export function getSearchService(): SearchService {
  if (!searchServiceInstance) {
    searchServiceInstance = new SearchService();
  }
  return searchServiceInstance;
}
