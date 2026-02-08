/**
 * 反馈改进引擎
 *
 * 整合用户反馈优化分析结果
 * 基于 BestBlogs 的反馈改进机制
 */

import { ReflectionEngine } from '@/lib/ai/analysis/reflection-engine';
import { db } from '@/lib/db';
import type { AIProvider } from '@/lib/ai/client';
import type { ArticleAnalysisResult } from '@/lib/ai/analysis/types';

// =====================================================
// 类型定义
// =====================================================

export interface UserFeedback {
  entryId: string;
  userId: string;
  /** 摘要问题描述 */
  summaryIssue?: string;
  /** 标签建议 */
  tagSuggestions?: string[];
  /** 用户评分 1-5 */
  rating?: number;
  /** 是否有帮助 */
  isHelpful?: boolean;
  /** 其他意见 */
  comments?: string;
}

export interface FeedbackAnalysis {
  /** 反馈类型 */
  type: 'summary' | 'tags' | 'rating' | 'general';
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high';
  /** 需要优化 */
  needsImprovement: boolean;
  /** 优化建议 */
  suggestions: string[];
}

export interface ImprovedResult extends ArticleAnalysisResult {
  /** 应用的反馈数量 */
  feedbackApplied?: number;
  /** 反馈分析 */
  feedbackAnalysis?: FeedbackAnalysis;
}

// =====================================================
// 反馈引擎类
// =====================================================

export class FeedbackEngine {
  constructor(private llm: AIProvider) {}

  /**
   * 根据反馈优化分析
   *
   * @param entryId - 文章ID
   * @param currentAnalysis - 当前分析结果
   * @param userFeedback - 用户反馈
   * @param content - 文章内容
   * @returns 优化后的分析结果
   */
  async improveWithFeedback(
    entryId: string,
    currentAnalysis: ArticleAnalysisResult,
    userFeedback?: UserFeedback,
    content?: string
  ): Promise<ImprovedResult> {

    let improvedAnalysis = { ...currentAnalysis };
    let feedbackApplied = 0;

    // 1. 分析反馈
    const feedbackAnalysis = userFeedback
      ? this.analyzeFeedback(userFeedback, currentAnalysis)
      : null;

    // 2. 自我反思（始终执行）
    if (content) {
      try {
        const reflection = new ReflectionEngine(this.llm);
        const reflectionRounds = feedbackAnalysis?.needsImprovement ? 3 : 1;

        improvedAnalysis = await reflection.refine(
          content,
          improvedAnalysis,
          reflectionRounds
        );

        feedbackApplied++;
      } catch (error) {
        console.error('反思优化失败:', error);
        // 反思失败不影响主流程
      }
    }

    // 3. 应用用户反馈
    if (userFeedback && feedbackAnalysis?.needsImprovement) {
      try {
        improvedAnalysis = await this.applyUserFeedback(
          improvedAnalysis,
          userFeedback
        );
        feedbackApplied++;
      } catch (error) {
        console.error('应用用户反馈失败:', error);
        // 反馈应用失败不影响主流程
      }
    }

    return {
      ...improvedAnalysis,
      feedbackApplied,
      feedbackAnalysis: feedbackAnalysis || undefined,
    };
  }

  /**
   * 分析用户反馈
   */
  private analyzeFeedback(
    feedback: UserFeedback,
    currentAnalysis: ArticleAnalysisResult
  ): FeedbackAnalysis {

    const suggestions: string[] = [];
    let needsImprovement = false;
    let severity: 'low' | 'medium' | 'high' = 'low';

    // 分析评分
    if (feedback.rating !== undefined) {
      if (feedback.rating <= 2) {
        severity = 'high';
        needsImprovement = true;
        suggestions.push('用户评分很低，需要全面重新分析');
      } else if (feedback.rating <= 3) {
        severity = 'medium';
        needsImprovement = true;
        suggestions.push('用户评分偏低，需要改进分析质量');
      }
    }

    // 分析是否有帮助
    if (feedback.isHelpful === false) {
      severity = severity === 'high' ? 'high' : 'medium';
      needsImprovement = true;
      suggestions.push('用户认为分析没有帮助');
    }

    // 分析摘要问题
    if (feedback.summaryIssue) {
      severity = 'medium';
      needsImprovement = true;
      suggestions.push(`摘要问题: ${feedback.summaryIssue}`);
    }

    // 分析标签建议
    if (feedback.tagSuggestions && feedback.tagSuggestions.length > 0) {
      suggestions.push(`标签建议: ${feedback.tagSuggestions.join(', ')}`);
    }

    // 分析其他意见
    if (feedback.comments) {
      suggestions.push(`其他意见: ${feedback.comments}`);
    }

    return {
      type: feedback.summaryIssue ? 'summary' : feedback.tagSuggestions ? 'tags' : 'general',
      severity,
      needsImprovement,
      suggestions,
    };
  }

  /**
   * 应用用户反馈
   */
  private async applyUserFeedback(
    analysis: ArticleAnalysisResult,
    feedback: UserFeedback
  ): Promise<ArticleAnalysisResult> {

    const improvements: string[] = [];

    // 构建反馈提示
    const feedbackPrompts = [];

    if (feedback.summaryIssue) {
      feedbackPrompts.push(`摘要问题: ${feedback.summaryIssue}`);
    }

    if (feedback.tagSuggestions && feedback.tagSuggestions.length > 0) {
      feedbackPrompts.push(`建议添加标签: ${feedback.tagSuggestions.join(', ')}`);
    }

    if (feedback.rating !== undefined) {
      feedbackPrompts.push(`用户评分: ${feedback.rating}/5`);
    }

    if (feedback.isHelpful !== undefined) {
      feedbackPrompts.push(`用户认为${feedback.isHelpful ? '有帮助' : '没有帮助'}`);
    }

    if (feedback.comments) {
      feedbackPrompts.push(`用户意见: ${feedback.comments}`);
    }

    // 如果没有具体反馈，直接返回原结果
    if (feedbackPrompts.length === 0) {
      return analysis;
    }

    const prompt = `
当前分析结果：
${JSON.stringify(analysis, null, 2)}

用户反馈：
${feedbackPrompts.map(f => `- ${f}`).join('\n')}

请根据用户反馈优化分析结果，返回 JSON 格式。
保持格式一致，只调整用户反馈的部分。
    `;

    try {
      const response = await this.llm.chat({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '你是分析优化助手，根据用户反馈改进分析结果。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const improved = JSON.parse(response.content);

      // 合并改进结果
      return {
        ...analysis,
        ...improved,
        // 保留原有的元数据
        analysisModel: analysis.analysisModel,
        processingTime: analysis.processingTime,
        reflectionRounds: (analysis.reflectionRounds || 0) + 1,
      };
    } catch (error) {
      console.error('LLM 反馈优化失败:', error);
      // 失败时返回原结果
      return analysis;
    }
  }

  /**
   * 批量处理反馈
   */
  async processFeedbackBatch(
    items: Array<{
      entryId: string;
      currentAnalysis: ArticleAnalysisResult;
      userFeedback?: UserFeedback;
      content?: string;
    }>
  ): Promise<ImprovedResult[]> {
    return Promise.all(
      items.map(item =>
        this.improveWithFeedback(
          item.entryId,
          item.currentAnalysis,
          item.userFeedback,
          item.content
        )
      )
    );
  }

  /**
   * 保存反馈
   */
  async saveFeedback(feedback: UserFeedback): Promise<void> {
    try {
      await db.analysisFeedback.upsert({
        where: {
          entryId_userId: {
            entryId: feedback.entryId,
            userId: feedback.userId,
          },
        },
        create: {
          entryId: feedback.entryId,
          userId: feedback.userId,
          summaryIssue: feedback.summaryIssue,
          tagSuggestions: feedback.tagSuggestions || [],
          rating: feedback.rating,
          isHelpful: feedback.isHelpful,
          comments: feedback.comments,
        },
        update: {
          summaryIssue: feedback.summaryIssue,
          tagSuggestions: feedback.tagSuggestions || [],
          rating: feedback.rating,
          isHelpful: feedback.isHelpful,
          comments: feedback.comments,
          isApplied: false, // 重置应用状态
          appliedAt: null,
        },
      });
    } catch (error) {
      console.error('保存反馈失败:', error);
      throw error;
    }
  }

  /**
   * 获取文章的所有反馈
   */
  async getFeedbackForEntry(entryId: string): Promise<UserFeedback[]> {
    const feedbacks = await db.analysisFeedback.findMany({
      where: { entryId },
      orderBy: { createdAt: 'desc' },
    });

    return feedbacks.map(f => ({
      entryId: f.entryId,
      userId: f.userId,
      summaryIssue: f.summaryIssue || undefined,
      tagSuggestions: f.tagSuggestions || undefined,
      rating: f.rating || undefined,
      isHelpful: f.isHelpful || undefined,
      comments: f.comments || undefined,
    }));
  }

  /**
   * 获取反馈统计
   */
  async getFeedbackStats(entryId: string): Promise<{
    total: number;
    helpful: number;
    notHelpful: number;
    avgRating: number;
    commonIssues: Array<{ issue: string; count: number }>;
  }> {
    const feedbacks = await db.analysisFeedback.findMany({
      where: { entryId },
    });

    const total = feedbacks.length;
    const helpful = feedbacks.filter(f => f.isHelpful === true).length;
    const notHelpful = feedbacks.filter(f => f.isHelpful === false).length;

    const ratings = feedbacks
      .map(f => f.rating)
      .filter((r): r is number => r !== undefined);
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

    // 统计常见问题
    const issueMap = new Map<string, number>();
    for (const f of feedbacks) {
      if (f.summaryIssue) {
        const key = f.summaryIssue.slice(0, 50); // 截断长问题
        issueMap.set(key, (issueMap.get(key) || 0) + 1);
      }
    }

    const commonIssues = Array.from(issueMap.entries())
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      helpful,
      notHelpful,
      avgRating: Math.round(avgRating * 10) / 10,
      commonIssues,
    };
  }

  /**
   * 标记反馈为已应用
   */
  async markFeedbackAsApplied(
    entryId: string,
    userId: string
  ): Promise<void> {
    await db.analysisFeedback.updateMany({
      where: {
        entryId,
        userId,
      },
      data: {
        isApplied: true,
        appliedAt: new Date(),
      },
    });
  }

  /**
   * 获取未应用的反馈
   */
  async getUnappliedFeedback(limit: number = 10): Promise<Array<UserFeedback & { id: string }>> {
    const feedbacks = await db.analysisFeedback.findMany({
      where: {
        isApplied: false,
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    return feedbacks.map(f => ({
      id: f.id,
      entryId: f.entryId,
      userId: f.userId,
      summaryIssue: f.summaryIssue || undefined,
      tagSuggestions: f.tagSuggestions || undefined,
      rating: f.rating || undefined,
      isHelpful: f.isHelpful || undefined,
      comments: f.comments || undefined,
    }));
  }
}

// =====================================================
// 工厂函数
// =====================================================

/**
 * 创建默认反馈引擎
 */
export function createFeedbackEngine(llm: AIProvider): FeedbackEngine {
  return new FeedbackEngine(llm);
}
