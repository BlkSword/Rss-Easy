/**
 * 个性化评分系统
 *
 * 基于用户阅读行为和偏好，为每篇文章生成个性化评分
 */

import type { AIProvider } from '../client';
import type { ArticleAnalysisResult } from '../analysis/types';
import type {
  ScoringDimensions,
  PersonalizedScore,
  UserPreferenceProfile,
  RecommendedAction,
} from './types';
import { DEFAULT_RECOMMENDATION_CONFIG, RecommendationConfig } from './types';

export class PersonalScorer {
  private readonly config: RecommendationConfig;

  constructor(
    private llm: AIProvider,
    config: Partial<RecommendationConfig> = {}
  ) {
    this.config = { ...DEFAULT_RECOMMENDATION_CONFIG, ...config };
  }

  /**
   * 计算个性化评分
   */
  async calculateScore(
    analysis: ArticleAnalysisResult,
    userPrefs: UserPreferenceProfile | null | undefined
  ): Promise<PersonalizedScore> {
    // 如果没有用户偏好，返回基础评分
    if (!userPrefs) {
      return this.getBaseScore(analysis);
    }

    // 1. 获取基础评分（AI 客观评分）
    const baseDimensions: ScoringDimensions = {
      depth: analysis.scoreDimensions.depth,
      quality: analysis.scoreDimensions.quality,
      practicality: analysis.scoreDimensions.practicality,
      novelty: analysis.scoreDimensions.novelty,
      relevance: 5, // 默认中等相关度
    };

    // 2. 计算个性化调整因子
    const personalization = await this.calculatePersonalization(analysis, userPrefs);

    // 3. 应用个性化调整
    const finalDimensions: ScoringDimensions = {
      depth: this.adjust(baseDimensions.depth, personalization.depthBoost),
      quality: baseDimensions.quality, // 质量较客观，少调整
      practicality: this.adjust(baseDimensions.practicality, personalization.practicalityBoost),
      novelty: this.applyNoveltyFactor(baseDimensions.novelty, personalization.noveltyFactor),
      relevance: personalization.relevanceScore, // 完全基于个人匹配
    };

    // 4. 计算总分
    const overall = this.calculateWeightedAverage(finalDimensions);

    // 5. 生成推荐理由
    const reasons = this.generateReasons(finalDimensions, personalization, analysis);

    // 6. 确定推荐动作
    const recommendedAction = this.getRecommendation(overall, finalDimensions.relevance);

    // 7. 计算置信度
    const confidence = this.calculateConfidence(personalization, userPrefs);

    return {
      overall: Math.round(overall * 10) / 10,
      dimensions: finalDimensions,
      reasons,
      recommendedAction,
      confidence,
      boostFactors: personalization,
    };
  }

  /**
   * 获取基础评分（无用户偏好时）
   */
  private getBaseScore(analysis: ArticleAnalysisResult): PersonalizedScore {
    const overall = this.calculateWeightedAverage({
      depth: analysis.scoreDimensions.depth,
      quality: analysis.scoreDimensions.quality,
      practicality: analysis.scoreDimensions.practicality,
      novelty: analysis.scoreDimensions.novelty,
      relevance: 5,
    });

    return {
      overall: Math.round(overall * 10) / 10,
      dimensions: {
        depth: analysis.scoreDimensions.depth,
        quality: analysis.scoreDimensions.quality,
        practicality: analysis.scoreDimensions.practicality,
        novelty: analysis.scoreDimensions.novelty,
        relevance: 5,
      },
      reasons: [
        `AI 内容质量评分：${analysis.aiScore}/10`,
        analysis.aiScore >= 7 ? '这是一篇高质量文章' : '内容质量一般',
      ],
      recommendedAction: this.getRecommendation(overall, 5),
      confidence: 0.7,
    };
  }

  /**
   * 计算个性化调整因子
   */
  private async calculatePersonalization(
    analysis: ArticleAnalysisResult,
    userPrefs: UserPreferenceProfile
  ): Promise<{
    depthBoost: number;
    practicalityBoost: number;
    noveltyFactor: number;
    relevanceBoost: number;
    relevanceScore: number;
    topicBoost: number;
  }> {
    // A. 主题匹配度
    const topicBoost = this.calculateTopicBoost(analysis.tags, userPrefs.topicWeights);

    // B. 深度偏好匹配
    const depthBoost = this.getDepthBoost(userPrefs.preferredDepth);

    // C. 实用性偏好（基于完成率和停留时间推断）
    const practicalityBoost = this.getPracticalityBoost(userPrefs);

    // D. 新颖性调整（暂时无法计算，使用默认值）
    const noveltyFactor = 1.0;

    // E. 综合相关度评分
    const relevanceScore = this.calculateRelevance(
      analysis.tags,
      analysis.domain,
      userPrefs
    );

    return {
      depthBoost,
      practicalityBoost,
      noveltyFactor,
      relevanceScore,
      topicBoost,
      relevanceBoost: relevanceScore, // 别名以匹配类型
    };
  }

  /**
   * 计算主题加权
   */
  private calculateTopicBoost(
    tags: string[],
    topicWeights: Record<string, number>
  ): number {
    if (tags.length === 0) return 0;

    let totalWeight = 0;
    let matchCount = 0;

    for (const tag of tags) {
      const weight = topicWeights[tag.toLowerCase()];
      if (weight !== undefined) {
        totalWeight += weight;
        matchCount++;
      }
    }

    return matchCount > 0 ? totalWeight / matchCount : 0;
  }

  /**
   * 获取深度增强因子
   */
  private getDepthBoost(preferredDepth: UserPreferenceProfile['preferredDepth']): number {
    switch (preferredDepth) {
      case 'deep':
        return 1.3; // 深度内容加分
      case 'medium':
        return 1.0;
      case 'light':
        return 0.8; // 深度内容降分
      default:
        return 1.0;
    }
  }

  /**
   * 获取实用性增强因子
   */
  private getPracticalityBoost(userPrefs: UserPreferenceProfile): number {
    // 基于完成率推断：完成率高说明喜欢实用性内容
    if (userPrefs.completionRate > 0.7) {
      return 1.2;
    } else if (userPrefs.completionRate < 0.3) {
      return 0.9;
    }
    return 1.0;
  }

  /**
   * 计算相关性评分
   */
  private calculateRelevance(
    tags: string[],
    domain: string,
    userPrefs: UserPreferenceProfile
  ): number {
    let score = 5; // 基础分

    // 检查排除标签
    const hasExcludedTag = tags.some(tag =>
      userPrefs.excludedTags.some(excluded =>
        tag.toLowerCase().includes(excluded.toLowerCase())
      )
    );
    if (hasExcludedTag) {
      return 2; // 显著降分
    }

    // 主题匹配加分
    const topicBoost = this.calculateTopicBoost(tags, userPrefs.topicWeights);
    score += topicBoost * 3;

    // 域匹配加分
    const preferredDomains = Object.keys(userPrefs.topicWeights)
      .filter(k => userPrefs.topicWeights[k] > 0.7);

    if (preferredDomains.some(d => domain.toLowerCase().includes(d.toLowerCase()))) {
      score += 1.5;
    }

    return Math.min(10, Math.max(1, score));
  }

  /**
   * 应用新颖性因子
   */
  private applyNoveltyFactor(base: number, factor: number): number {
    return Math.min(10, Math.max(1, base * factor));
  }

  /**
   * 调整评分
   */
  private adjust(base: number, factor: number): number {
    return Math.min(10, Math.max(1, base * factor));
  }

  /**
   * 计算加权平均
   */
  private calculateWeightedAverage(dimensions: ScoringDimensions): number {
    const weights = this.config.weights;
    return (
      dimensions.depth * weights.contentQuality +
      dimensions.quality * weights.contentQuality * 0.3 +
      dimensions.practicality * weights.personalRelevance * 0.5 +
      dimensions.novelty * weights.novelty +
      dimensions.relevance * weights.personalRelevance
    ) / (
      weights.contentQuality * 1.3 +
      weights.personalRelevance * 1.5 +
      weights.novelty
    );
  }

  /**
   * 生成推荐理由
   */
  private generateReasons(
    dimensions: ScoringDimensions,
    personalization: any,
    analysis: ArticleAnalysisResult
  ): string[] {
    const reasons: string[] = [];

    // 相关度理由
    if (dimensions.relevance >= 8) {
      reasons.push(`与你关注的高度相关（匹配度 ${personalization.topicBoost.toFixed(1)}）`);
    } else if (dimensions.relevance >= 6) {
      reasons.push('与你的兴趣有一定关联');
    }

    // 质量理由
    if (dimensions.quality >= 8) {
      reasons.push('内容质量优秀，值得精读');
    } else if (dimensions.quality >= 6) {
      reasons.push('内容质量良好');
    }

    // 深度理由
    if (dimensions.depth >= 8) {
      reasons.push('内容深度高，符合你的阅读偏好');
    }

    // 实用性理由
    if (dimensions.practicality >= 7) {
      reasons.push('实用性高，可以学到东西');
    }

    // 新颖性理由
    if (personalization.noveltyFactor < 0.8) {
      reasons.push('与你近期阅读内容相似，可能缺乏新意');
    }

    // 标签匹配理由
    if (personalization.topicBoost > 0.5) {
      const matchedTags = analysis.tags.filter(tag =>
        Object.keys(personalization).some(k => k.toLowerCase() === tag.toLowerCase())
      );
      if (matchedTags.length > 0) {
        reasons.push(`包含你关注的标签：${matchedTags.slice(0, 2).join(', ')}`);
      }
    }

    return reasons.length > 0 ? reasons : ['系统推荐'];
  }

  /**
   * 获取推荐动作
   */
  private getRecommendation(overall: number, relevance: number): RecommendedAction {
    if (overall >= 8 && relevance >= 7) return 'read_now';
    if (overall >= 6) return 'read_later';
    if (overall >= 4) return 'archive';
    return 'skip';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    personalization: any,
    userPrefs: UserPreferenceProfile
  ): number {
    // 基于用户数据量计算置信度
    let confidence = 0.5;

    // 阅读数量增加置信度
    if (userPrefs.updatedAt) {
      const daysSinceUpdate = (Date.now() - userPrefs.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) {
        confidence += 0.2;
      }
    }

    // 主题权重分布增加置信度
    const topicCount = Object.keys(userPrefs.topicWeights).length;
    if (topicCount > 5) {
      confidence += 0.2;
    }

    return Math.min(1, confidence);
  }

  /**
   * 批量计算评分
   */
  async calculateScoresBatch(
    analyses: ArticleAnalysisResult[],
    userPrefs: UserPreferenceProfile | null | undefined
  ): Promise<PersonalizedScore[]> {
    return Promise.all(
      analyses.map(analysis => this.calculateScore(analysis, userPrefs))
    );
  }
}
