/**
 * 反思优化引擎
 *
 * 通过多轮自我反思，不断提升分析结果的质量
 */

import type { AIProvider } from '../client';
import type {
  ReflectionResult,
  ArticleAnalysisResult,
  AnalysisConfig,
} from './types';
import { DEFAULT_ANALYSIS_CONFIG } from './types';

export class ReflectionEngine {
  private readonly config: AnalysisConfig;

  constructor(
    private llm: AIProvider,
    config: Partial<AnalysisConfig> = {}
  ) {
    this.config = { ...DEFAULT_ANALYSIS_CONFIG, ...config };
  }

  /**
   * 执行反思优化流程
   */
  async refine(
    originalContent: string,
    analysis: ArticleAnalysisResult,
    maxRounds: number = this.config.maxReflectionRounds!
  ): Promise<ArticleAnalysisResult> {
    let currentAnalysis = analysis;
    let round = 0;

    while (round < maxRounds) {
      const reflection = await this.reflect(originalContent, currentAnalysis);

      // 质量达标或不需要改进则停止
      if (!reflection.needsRefinement || reflection.quality >= this.config.qualityThreshold!) {
        break;
      }

      // 基于反思建议优化
      currentAnalysis = await this.improve(currentAnalysis, reflection, originalContent);
      round++;
    }

    return {
      ...currentAnalysis,
      reflectionRounds: round,
    };
  }

  /**
   * 反思：评估分析质量
   */
  private async reflect(
    originalContent: string,
    analysis: ArticleAnalysisResult
  ): Promise<ReflectionResult> {
    const prompt = this.buildReflectionPrompt(originalContent, analysis);

    try {
      const response = await this.llm.chat({
        model: this.config.reflectionModel!,
        messages: [
          {
            role: 'system',
            content: '你是一位资深技术编辑，负责严格审查文章分析质量。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.content);

      return {
        quality: result.quality || 0,
        issues: result.issues || [],
        suggestions: result.suggestions || [],
        needsRefinement: result.quality < (this.config.qualityThreshold || 7),
        scores: result.scores,
      };
    } catch (error) {
      console.error('反思过程出错:', error);
      // 出错时默认不需要反思
      return {
        quality: 8,
        issues: [],
        suggestions: [],
        needsRefinement: false,
      };
    }
  }

  /**
   * 构建反思提示词
   */
  private buildReflectionPrompt(
    originalContent: string,
    analysis: ArticleAnalysisResult
  ): string {
    const contentPreview = originalContent.slice(0, 3000);

    return `请严格审查以下文章分析质量：

【原文节选】
${contentPreview}
${originalContent.length > 3000 ? '...(已截断)' : ''}

【分析结果】
- 一句话总结：${analysis.oneLineSummary}
- 摘要：${analysis.summary}
- 主要观点：${analysis.mainPoints.map(p => p.point).join('； ')}
- 标签：${analysis.tags.join(', ')}
- 分类：${analysis.domain} / ${analysis.subcategory}
- 评分：${analysis.aiScore}/10

【审查维度】（每项满分10分）
请对以下维度进行评分并给出具体意见：

1. **全面性**：是否遗漏核心论点或关键技术点？
2. **准确性**：摘要是否与原文一致，有无误解？
3. **深度性**：是否捕捉到文章的深层见解，而非表面描述？
4. **一致性**：标签、分类、评分之间是否逻辑一致？
5. **客观性**：评分是否受个人偏见影响？

【输出格式】
{
  "quality": 7.5,
  "scores": {
    "comprehensiveness": 8,
    "accuracy": 9,
    "depth": 7,
    "consistency": 8,
    "objectivity": 7
  },
  "issues": ["遗漏了XXX关键点", "标签与内容不匹配"],
  "suggestions": ["补充XXX内容", "调整标签为XXX"],
  "needsRefinement": true
}`;
  }

  /**
   * 改进：基于反思建议优化分析结果
   */
  private async improve(
    analysis: ArticleAnalysisResult,
    reflection: ReflectionResult,
    originalContent: string
  ): Promise<ArticleAnalysisResult> {
    const prompt = this.buildImprovementPrompt(analysis, reflection, originalContent);

    try {
      const response = await this.llm.chat({
        model: this.config.reflectionModel!,
        messages: [
          {
            role: 'system',
            content: '你是一位资深技术编辑，负责根据审查建议优化文章分析结果。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.content);

      // 合并结果
      return {
        ...analysis,
        oneLineSummary: result.oneLineSummary || analysis.oneLineSummary,
        summary: result.summary || analysis.summary,
        mainPoints: result.mainPoints || analysis.mainPoints,
        tags: result.tags || analysis.tags,
        domain: result.domain || analysis.domain,
        subcategory: result.subcategory || analysis.subcategory,
        aiScore: result.aiScore || analysis.aiScore,
        scoreDimensions: result.scoreDimensions || analysis.scoreDimensions,
      };
    } catch (error) {
      console.error('改进过程出错:', error);
      // 出错时返回原分析结果
      return analysis;
    }
  }

  /**
   * 构建改进提示词
   */
  private buildImprovementPrompt(
    analysis: ArticleAnalysisResult,
    reflection: ReflectionResult,
    originalContent: string
  ): string {
    const contentPreview = originalContent.slice(0, 2000);

    return `基于审查建议，优化文章分析结果。

【原文节选】
${contentPreview}
${originalContent.length > 2000 ? '...(已截断)' : ''}

【当前分析】
${JSON.stringify(analysis, null, 2)}

【审查问题】
${reflection.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

【优化建议】
${reflection.suggestions.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

【要求】
请输出优化后的完整分析结果，保持原有 JSON 格式：
{
  "oneLineSummary": "一句话总结",
  "summary": "详细摘要",
  "mainPoints": [{"point": "观点", "explanation": "解释", "importance": 0.8}],
  "tags": ["标签1", "标签2"],
  "domain": "领域",
  "subcategory": "子分类",
  "aiScore": 8.5,
  "scoreDimensions": {
    "depth": 8,
    "quality": 9,
    "practicality": 7,
    "novelty": 8
  }
}`;
  }

  /**
   * 快速质量检查（不进行完整反思）
   */
  async quickCheck(analysis: ArticleAnalysisResult): Promise<{
    passed: boolean;
    quality: number;
    issues: string[];
  }> {
    const quickReflection: ReflectionResult = {
      quality: this.estimateQuality(analysis),
      issues: [],
      suggestions: [],
      needsRefinement: false,
    };

    return {
      passed: quickReflection.quality >= (this.config.qualityThreshold || 7),
      quality: quickReflection.quality,
      issues: quickReflection.issues,
    };
  }

  /**
   * 估算质量（基于启发式规则）
   */
  private estimateQuality(analysis: ArticleAnalysisResult): number {
    let score = 5;

    // 一句话总结长度合理
    if (analysis.oneLineSummary.length >= 10 && analysis.oneLineSummary.length <= 50) {
      score += 1;
    }

    // 摘要长度合理
    if (analysis.summary.length >= 50) {
      score += 1;
    }

    // 有主要观点
    if (analysis.mainPoints.length >= 3) {
      score += 1;
    }

    // 有标签
    if (analysis.tags.length >= 2) {
      score += 0.5;
    }

    // 评分合理
    if (analysis.aiScore >= 4 && analysis.aiScore <= 10) {
      score += 0.5;
    }

    return Math.min(10, score);
  }
}
