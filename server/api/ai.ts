/**
 * AI助手相关的 tRPC Router
 */

import { router, publicProcedure } from '../trpc/init';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getDefaultAIService } from '@/lib/ai/client';
import { TRPCError } from '@trpc/server';

export const aiRouter = router({
  /**
   * AI聊天
   */
  chat: publicProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '未登录',
        });
      }

      // 获取用户AI配置
      const user = await db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          aiConfig: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '用户不存在',
        });
      }

      // 准备AI配置
      const aiService = getDefaultAIService();

      // 构建对话上下文
      const recentEntries = await db.entry.findMany({
        where: {
          feed: {
            userId: ctx.userId,
          },
        },
        orderBy: {
          publishedAt: 'desc',
        },
        take: 50,
        select: {
          id: true,
          title: true,
          summary: true,
          content: true,
          url: true,
          publishedAt: true,
          aiSummary: true,
          aiKeywords: true,
          aiCategory: true,
          feed: {
            select: {
              title: true,
            },
          },
        },
      });

      // 获取用户的最后一条消息
      const lastMessage = input.messages[input.messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '无效的消息格式',
        });
      }

      const userQuery = lastMessage.content;

      // 根据用户查询生成响应
      let responseContent = '';

      try {
        // 简单的意图识别
        if (userQuery.includes('摘要') || userQuery.includes('总结')) {
          responseContent = await generateSummary(recentEntries);
        } else if (userQuery.includes('趋势') || userQuery.includes('分析')) {
          responseContent = await analyzeTrends(recentEntries);
        } else if (userQuery.includes('推荐') || userQuery.includes('建议')) {
          responseContent = await getRecommendations(recentEntries, userQuery);
        } else {
          // 通用问答 - 基于用户文章内容回答
          responseContent = await answerQuestion(recentEntries, userQuery);
        }
      } catch (error) {
        console.error('AI处理失败:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'AI处理失败，请稍后重试',
        });
      }

      return {
        role: 'assistant' as const,
        content: responseContent,
      };
    }),

  /**
   * 获取AI配置
   */
  getConfig: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '未登录',
      });
    }

    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        aiConfig: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: '用户不存在',
      });
    }

    return user.aiConfig;
  }),
});

/**
 * 生成文章摘要
 */
async function generateSummary(entries: any[]): Promise<string> {
  if (entries.length === 0) {
    return '目前还没有文章可以生成摘要。请先订阅一些RSS源。';
  }

  // 按分类分组
  const byCategory: Record<string, any[]> = {};
  for (const entry of entries) {
    const category = entry.aiCategory || '未分类';
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(entry);
  }

  let summary = `# 今日文章摘要\n\n`;
  summary += `共有 ${entries.length} 篇文章\n\n`;

  for (const [category, categoryEntries] of Object.entries(byCategory)) {
    summary += `## ${category}\n\n`;
    const topEntries = categoryEntries.slice(0, 5);
    for (const entry of topEntries) {
      summary += `### ${entry.title}\n`;
      if (entry.aiSummary) {
        summary += `${entry.aiSummary}\n`;
      } else if (entry.summary) {
        summary += `${entry.summary.slice(0, 100)}...\n`;
      }
      summary += `\n`;
    }
  }

  return summary;
}

/**
 * 分析趋势
 */
async function analyzeTrends(entries: any[]): Promise<string> {
  if (entries.length === 0) {
    return '目前还没有足够的数据来分析趋势。';
  }

  // 统计关键词
  const keywordCounts: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.aiKeywords) {
      for (const keyword of entry.aiKeywords) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      }
    }
  }

  // 获取热门关键词
  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => `${keyword} (${count}篇)`);

  // 统计分类
  const categoryCounts: Record<string, number> = {};
  for (const entry of entries) {
    const category = entry.aiCategory || '未分类';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }

  let analysis = `# 近期文章趋势分析\n\n`;
  analysis += `## 热门话题\n\n`;
  analysis += topKeywords.map((kw, i) => `${i + 1}. ${kw}`).join('\n');
  analysis += `\n\n## 分类分布\n\n`;
  for (const [category, count] of Object.entries(categoryCounts)) {
    analysis += `- ${category}: ${count}篇\n`;
  }

  return analysis;
}

/**
 * 获取推荐
 */
async function getRecommendations(entries: any[], query: string): Promise<string> {
  // 按重要性分数排序
  const sortedEntries = entries
    .filter((e) => e.aiImportanceScore !== null)
    .sort((a, b) => (b.aiImportanceScore || 0) - (a.aiImportanceScore || 0))
    .slice(0, 10);

  if (sortedEntries.length === 0) {
    return '暂时没有特别推荐的文章。继续阅读更多文章后，我可以为您推荐更合适的内容。';
  }

  let recommendations = `# 为您推荐的文章\n\n`;
  recommendations += `根据重要性和您的历史阅读，推荐以下文章：\n\n`;

  for (const entry of sortedEntries) {
    recommendations += `## ${entry.title}\n`;
    recommendations += `- 来源: ${entry.feed.title}\n`;
    if (entry.aiSummary) {
      recommendations += `- 摘要: ${entry.aiSummary}\n`;
    }
    recommendations += `- 重要性: ${(entry.aiImportanceScore * 100).toFixed(0)}%\n`;
    recommendations += `\n`;
  }

  return recommendations;
}

/**
 * 回答问题
 */
async function answerQuestion(entries: any[], question: string): Promise<string> {
  // 简单的关键词匹配搜索
  const questionLower = question.toLowerCase();
  const relevantEntries = entries.filter((entry) => {
    return (
      entry.title?.toLowerCase().includes(questionLower) ||
      entry.summary?.toLowerCase().includes(questionLower) ||
      entry.aiKeywords?.some((k: string) => k.toLowerCase().includes(questionLower))
    );
  }).slice(0, 5);

  if (relevantEntries.length === 0) {
    return `我在您的文章中没有找到关于"${question}"的相关内容。\n\n您可以询问：\n• 今天的文章摘要\n• 分析某个主题的趋势\n• 推荐值得阅读的文章\n• 整理特定分类的内容`;
  }

  let answer = `关于"${question}"，找到以下相关文章：\n\n`;
  for (const entry of relevantEntries) {
    answer += `## ${entry.title}\n`;
    answer += `- 来源: ${entry.feed.title}\n`;
    if (entry.aiSummary) {
      answer += `- 摘要: ${entry.aiSummary}\n`;
    }
    answer += `\n`;
  }

  return answer;
}
