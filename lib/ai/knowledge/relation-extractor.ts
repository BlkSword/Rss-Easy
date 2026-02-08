/**
 * 文章关系抽取器
 *
 * 自动识别文章之间的语义关系，构建知识图谱
 */

import { db } from '@/lib/db';
import { getVectorStore } from '../embedding/vector-store';
import type { AIProvider } from '../client';

export type ArticleRelationType =
  | 'similar'        // 相似主题
  | 'prerequisite'   // 前置知识
  | 'extension'      // 扩展阅读
  | 'contradiction';  // 观点相反

export interface ArticleRelation {
  sourceId: string;
  targetId: string;
  relationType: ArticleRelationType;
  strength: number; // 0-1
  reason?: string;   // 关系原因
}

/**
 * 文章关系抽取器
 */
export class RelationExtractor {
  constructor(
    private llm: AIProvider,
    private vectorStore = getVectorStore()
  ) {}

  /**
   * 为文章寻找相关文章
   */
  async findRelatedArticles(
    entryId: string,
    options: {
      limit?: number;
      relationType?: ArticleRelationType;
      minSimilarity?: number;
    } = {}
  ): Promise<ArticleRelation[]> {
    const {
      limit = 5,
      relationType,
      minSimilarity = 0.7,
    } = options;

    // 1. 获取文章向量
    const vector = await this.vectorStore.get(entryId);
    if (!vector) {
      console.warn(`文章 ${entryId} 没有向量，无法查找相关文章`);
      return [];
    }

    // 2. 搜索相似文章
    const searchResults = await this.vectorStore.search(vector, limit * 2, minSimilarity);

    // 3. 过滤掉自身
    const filtered = searchResults.filter(r => r.entryId !== entryId);

    // 4. 如果指定了关系类型，使用 LLM 确认关系
    let relations: ArticleRelation[] = [];

    if (relationType) {
      // 获取文章信息用于 LLM 判断
      const sourceEntry = await db.entry.findUnique({
        where: { id: entryId },
        select: { id: true, title: true, summary: true, tags: true },
      });

      if (!sourceEntry) {
        return [];
      }

      // 逐个确认关系
      for (const result of filtered.slice(0, limit)) {
        const targetEntry = await db.entry.findUnique({
          where: { id: result.entryId },
          select: { id: true, title: true, summary: true, tags: true },
        });

        if (!targetEntry) {
          continue;
        }

        // 使用 LLM 判断关系类型
        const confirmed = await this.confirmRelation(
          sourceEntry,
          targetEntry,
          relationType,
          result.similarity
        );

        if (confirmed) {
          relations.push(confirmed);
        }
      }
    } else {
      // 不指定关系类型，直接返回相似文章
      relations = filtered.slice(0, limit).map(r => ({
        sourceId: entryId,
        targetId: r.entryId,
        relationType: 'similar' as ArticleRelationType,
        strength: r.similarity,
      }));
    }

    return relations;
  }

  /**
   * 使用 LLM 确认文章关系
   */
  private async confirmRelation(
    sourceEntry: any,
    targetEntry: any,
    relationType: ArticleRelationType,
    similarity: number
  ): Promise<ArticleRelation | null> {
    const prompts = {
      similar: `请判断以下两篇文章是否讨论相似的主题：

文章1：${sourceEntry.title}
${sourceEntry.summary?.slice(0, 200) || ''}

文章2：${targetEntry.title}
${targetEntry.summary?.slice(0, 200) || ''}

请只回复 true 或 false，表示两篇文章是否讨论相似主题。`,

      prerequisite: `请判断文章2是否是理解文章1的前置知识：

文章1：${sourceEntry.title}
${sourceEntry.summary?.slice(0, 200) || ''}

文章2：${targetEntry.title}
${targetEntry.summary?.slice(0, 200) || ''}

请只回复 true 或 false。`,

      extension: `请判断文章2是否是对文章1的扩展或深入探讨：

文章1：${sourceEntry.title}
${sourceEntry.summary?.slice(0, 200) || ''}

文章2：${targetEntry.title}
${targetEntry.summary?.slice(0, 200) || ''}

请只回复 true 或 false。`,

      contradiction: `请判断以下两篇文章是否表达相反或矛盾的观点：

文章1：${sourceEntry.title}
${sourceEntry.summary?.slice(0, 200) || ''}

文章2：${targetEntry.title}
${targetEntry.summary?.slice(0, 200) || ''}

请只回复 true 或 false。`,
    };

    const prompt = prompts[relationType];

    try {
      const response = await this.llm.chat({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
      });

      const confirmed = response.content?.toLowerCase().includes('true');

      if (confirmed) {
        return {
          sourceId: sourceEntry.id,
          targetId: targetEntry.id,
          relationType,
          strength: similarity,
          reason: `AI 确认为 ${relationType} 关系`,
        };
      }

      return null;
    } catch (error) {
      console.error('LLM 确认关系失败:', error);
      // 出错时，基于相似度直接判断
      if (similarity > 0.85) {
        return {
          sourceId: sourceEntry.id,
          targetId: targetEntry.id,
          relationType: 'similar',
          strength: similarity,
        };
      }
      return null;
    }
  }

  /**
   * 批量提取文章关系
   */
  async extractRelationsBatch(
    entryIds: string[],
    options: {
      maxRelationsPerEntry?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<Map<string, ArticleRelation[]>> {
    const {
      maxRelationsPerEntry = 5,
      minSimilarity = 0.75,
    } = options;

    const relationsMap = new Map<string, ArticleRelation[]>();

    for (const entryId of entryIds) {
      const relations = await this.findRelatedArticles(entryId, {
        limit: maxRelationsPerEntry,
        minSimilarity,
      });

      relationsMap.set(entryId, relations);
    }

    return relationsMap;
  }

  /**
   * 保存文章关系到数据库
   */
  async saveRelations(relations: ArticleRelation[]): Promise<void> {
    const promises = relations.map(relation =>
      db.articleRelation.upsert({
        where: {
          sourceId_targetId_relationType: {
            sourceId: relation.sourceId,
            targetId: relation.targetId,
            relationType: relation.relationType,
          },
        },
        create: {
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          relationType: relation.relationType,
          strength: relation.strength,
        },
        update: {
          strength: relation.strength,
        },
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * 构建知识图谱
   */
  async buildKnowledgeGraph(
    entryId: string,
    depth: number = 2
  ): Promise<{
    nodes: Array<{ id: string; title: string; layer: number }>;
    edges: Array<{ source: string; target: string; label: string; strength: number }>;
  }> {
    const nodes = new Map<string, { id: string; title: string; layer: number }>();
    const edges: Array<{ source: string; target: string; label: string; strength: number }> = [];
    const visited = new Set<string>([entryId]);

    // 获取起始文章
    const rootEntry = await db.entry.findUnique({
      where: { id: entryId },
      select: { id: true, title: true },
    });

    if (!rootEntry) {
      return { nodes: [], edges: [] };
    }

    nodes.set(entryId, {
      id: entryId,
      title: rootEntry.title,
      layer: 0,
    });

    // BFS 扩展图谱
    const queue: Array<{ entryId: string; layer: number }> = [
      { entryId, layer: 0 },
    ];

    while (queue.length > 0) {
      const { entryId: currentId, layer } = queue.shift()!;

      if (layer >= depth) {
        continue;
      }

      // 查找相关文章
      const relations = await this.findRelatedArticles(currentId, {
        limit: 3,
        minSimilarity: 0.7,
      });

      for (const relation of relations) {
        // 避免重复访问
        if (visited.has(relation.targetId)) {
          continue;
        }
        visited.add(relation.targetId);

        // 获取目标文章信息
        const targetEntry = await db.entry.findUnique({
          where: { id: relation.targetId },
          select: { id: true, title: true },
        });

        if (targetEntry) {
          nodes.set(relation.targetId, {
            id: relation.targetId,
            title: targetEntry.title,
            layer: layer + 1,
          });

          queue.push({
            entryId: relation.targetId,
            layer: layer + 1,
          });
        }

        // 添加边
        edges.push({
          source: relation.sourceId,
          target: relation.targetId,
          label: relation.relationType,
          strength: relation.strength,
        });
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }
}

/**
 * 获取关系抽取器实例
 */
export function getRelationExtractor(): RelationExtractor {
  // 延迟导入避免循环依赖
  const { getDefaultAIService } = require('../client');

  const aiService = getDefaultAIService();
  const llm = {
    chat: async (params: any) => {
      const result = await aiService.analyzeArticle(params.messages[1].content, {
        summary: true,
      });
      return { content: result.summary || '' };
    },
  } as any;

  return new RelationExtractor(llm);
}
