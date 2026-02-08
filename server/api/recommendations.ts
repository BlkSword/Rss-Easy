/**
 * Recommendations API Router
 *
 * 处理文章推荐和知识图谱相关 API
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { getRelationExtractor } from '@/lib/ai/knowledge/relation-extractor';

export const recommendationsRouter = router({
  /**
   * 获取相关文章
   */
  getRelated: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      limit: z.number().min(1).max(20).default(5),
      relationType: z.enum(['similar', 'prerequisite', 'extension', 'contradiction', 'all']).default('all'),
    }))
    .query(async ({ input, ctx }) => {
      const { entryId, limit, relationType } = input;

      // 检查文章是否存在
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: entryId,
          feed: { userId: ctx.userId },
        },
        select: { id: true },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      // 获取相关文章
      const extractor = getRelationExtractor();

      try {
        const relations = await extractor.findRelatedArticles(entryId, {
          limit,
          relationType: relationType === 'all' ? undefined : relationType,
          minSimilarity: 0.65,
        });

        // 获取相关文章的详细信息
        const relatedEntries = await ctx.db.entry.findMany({
          where: {
            id: { in: relations.map(r => r.targetId) },
            feed: { userId: ctx.userId },
          },
          select: {
            id: true,
            title: true,
            summary: true,
            url: true,
            publishedAt: true,
            feed: {
              select: {
                title: true,
                iconUrl: true,
              },
            },
          },
        });

        // 合并关系信息
        const results = relatedEntries.map(entry => {
          const relation = relations.find(r => r.targetId === entry.id);
          return {
            ...entry,
            relationType: relation?.relationType,
            strength: relation?.strength || 0,
            reason: relation?.reason,
          };
        });

        // 按强度排序
        results.sort((a, b) => b.strength - a.strength);

        return {
          items: results.slice(0, limit),
        };
      } catch (error) {
        console.error('获取相关文章失败:', error);
        return { items: [] };
      }
    }),

  /**
   * 获取知识图谱数据
   */
  getKnowledgeGraph: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      depth: z.number().min(1).max(3).default(2),
    }))
    .query(async ({ input, ctx }) => {
      const { entryId, depth } = input;

      // 检查文章是否存在
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: entryId,
          feed: { userId: ctx.userId },
        },
        select: { id: true },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      // 构建知识图谱
      const extractor = getRelationExtractor();

      try {
        const graph = await extractor.buildKnowledgeGraph(entryId, depth);

        // 过滤节点，只保留用户有权限访问的文章
        const userEntryIds = await ctx.db.entry.findMany({
          where: { feed: { userId: ctx.userId } },
          select: { id: true },
        });

        const userEntryIdSet = new Set(userEntryIds.map(e => e.id));

        const filteredNodes = graph.nodes.filter(node =>
          userEntryIdSet.has(node.id)
        );

        const filteredEdges = graph.edges.filter(edge =>
          userEntryIdSet.has(edge.source) && userEntryIdSet.has(edge.target)
        );

        return {
          nodes: filteredNodes,
          edges: filteredEdges,
          stats: {
            totalNodes: graph.nodes.length,
            totalEdges: graph.edges.length,
            filteredNodes: filteredNodes.length,
            filteredEdges: filteredEdges.length,
          },
        };
      } catch (error) {
        console.error('构建知识图谱失败:', error);
        return {
          nodes: [],
          edges: [],
          stats: {
            totalNodes: 0,
            totalEdges: 0,
            filteredNodes: 0,
            filteredEdges: 0,
          },
        };
      }
    }),

  /**
   * 批量提取文章关系
   */
  extractRelations: protectedProcedure
    .input(z.object({
      entryIds: z.array(z.string().uuid()),
      maxRelationsPerEntry: z.number().min(1).max(10).default(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const { entryIds, maxRelationsPerEntry } = input;

      // 检查所有文章是否属于当前用户
      const entries = await ctx.db.entry.findMany({
        where: {
          id: { in: entryIds },
          feed: { userId: ctx.userId },
        },
        select: { id: true },
      });

      if (entries.length !== entryIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '部分文章不存在或无权访问',
        });
      }

      // 提取关系
      const extractor = getRelationExtractor();

      try {
        const relationsMap = await extractor.extractRelationsBatch(entryIds, {
          maxRelationsPerEntry,
          minSimilarity: 0.7,
        });

        // 展平关系数组
        const allRelations = Array.from(relationsMap.values()).flat();

        // 保存到数据库
        await extractor.saveRelations(allRelations);

        return {
          success: true,
          totalRelations: allRelations.length,
          relationsPerEntry: Object.fromEntries(
            Array.from(relationsMap.entries()).map(([id, rels]) => [id, rels.length])
          ),
        };
      } catch (error) {
        console.error('提取文章关系失败:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '提取文章关系失败',
        });
      }
    }),

  /**
   * 获取推荐理由
   */
  getRecommendationReason: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const { entryId } = input;

      // 获取用户偏好
      const preference = await ctx.db.userPreference.findUnique({
        where: { userId: ctx.userId },
      });

      // 获取文章信息
      const entry = await ctx.db.entry.findFirst({
        where: {
          id: entryId,
          feed: { userId: ctx.userId },
        },
        select: {
          id: true,
          title: true,
          tags: true,
          aiCategory: true,
          aiScoreDimensions: true,
          feed: {
            select: {
              tags: true,
              title: true,
            },
          },
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文章不存在',
        });
      }

      // 生成推荐理由
      const reasons: string[] = [];

      // 基于主题匹配
      if (preference?.topicWeights) {
        const weights = preference.topicWeights as Record<string, number>;
        const entryTags = [
          ...(entry.tags || []),
          ...(entry.feed.tags || []),
          entry.aiCategory,
        ].filter(Boolean);

        const matchedTags = entryTags.filter((tag): tag is string => {
          if (!tag) return false;
          const weight = weights[tag.toLowerCase()];
          return typeof weight === 'number' && weight > 0.5;
        });

        if (matchedTags.length > 0) {
          reasons.push(
            `包含你关注的话题：${matchedTags.slice(0, 2).join('、')}`
          );
        }
      }

      // 基于评分维度
      const scoreDimensions = entry.aiScoreDimensions as any;
      if (scoreDimensions) {
        if (scoreDimensions.depth >= 8) {
          reasons.push('内容深度高，符合你的阅读偏好');
        }
        if (scoreDimensions.practicality >= 7) {
          reasons.push('实用性高，值得学习');
        }
        if (scoreDimensions.novelty >= 7) {
          reasons.push('内容新颖，有新见解');
        }
      }

      // 基于阅读历史
      const recentSessions = await ctx.db.readingSession.findMany({
        where: {
          userId: ctx.userId,
          entry: {
            feed: {
              tags: { hasSome: entry.feed.tags || [] },
            },
          },
        },
        select: { isCompleted: true },
        take: 5,
      });

      const completionRate = recentSessions.length > 0
        ? recentSessions.filter(s => s.isCompleted).length / recentSessions.length
        : 0;

      if (completionRate > 0.7 && entry.feed.tags?.length > 0) {
        reasons.push(`来自你常读的来源：${entry.feed.title}`);
      }

      // 默认理由
      if (reasons.length === 0) {
        reasons.push('系统推荐');
      }

      return {
        entryId: entry.id,
        title: entry.title,
        reasons,
        confidence: Math.min(1, reasons.length * 0.3),
      };
    }),
});
