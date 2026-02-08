/**
 * 分段分析引擎
 *
 * 使用 Map-Reduce 模式处理长文章：
 * 1. Map: 将文章分段，并行分析每个段落
 * 2. Reduce: 聚合分析结果，生成整体摘要
 */

import { marked } from 'marked';
import type { AIProvider } from '../client';
import type {
  Segment,
  SegmentAnalysis,
  ArticleAnalysisResult,
  AnalysisConfig,
} from './types';
import { DEFAULT_ANALYSIS_CONFIG } from './types';

export class SegmentedAnalyzer {
  private readonly SEGMENT_SIZE: number;
  private readonly OVERLAP: number;
  private readonly config: AnalysisConfig;

  constructor(
    private llm: AIProvider,
    config: Partial<AnalysisConfig> = {}
  ) {
    this.config = { ...DEFAULT_ANALYSIS_CONFIG, ...config };
    this.SEGMENT_SIZE = this.config.segmentSize!;
    this.OVERLAP = this.config.segmentOverlap!;
  }

  /**
   * 完整分析流程：分段 -> 分析 -> 聚合
   */
  async analyze(content: string, metadata: { title: string; author?: string }): Promise<ArticleAnalysisResult> {
    const startTime = Date.now();

    // 1. 分段
    const segments = await this.segment(content);

    // 2. 并行分析所有分段
    const analyses = await this.analyzeSegments(segments);

    // 3. 聚合结果
    const result = await this.aggregate(analyses, metadata);

    return {
      ...result,
      analysisModel: this.config.analysisModel!,
      processingTime: Date.now() - startTime,
      reflectionRounds: 0,
    };
  }

  /**
   * 智能分段：保持语义完整性
   */
  async segment(content: string): Promise<Segment[]> {
    const tokens = this.lexer(content);
    const segments: Segment[] = [];
    let currentBlocks: string[] = [];
    let currentLength = 0;
    let segmentId = 0;
    let globalIndex = 0;

    for (const token of tokens) {
      const tokenText = token.raw!;
      const tokenLength = tokenText.length;

      // 如果当前段长度 + 新 token 超过限制
      if (currentLength + tokenLength > this.SEGMENT_SIZE && currentBlocks.length > 0) {
        // 保存当前段
        segments.push({
          id: segmentId++,
          content: currentBlocks.join('\n\n'),
          startIndex: globalIndex - currentLength,
          endIndex: globalIndex,
          type: this.detectSegmentType(currentBlocks),
        });

        // 保留重叠部分
        const overlapBlocks = this.getOverlapBlocks(currentBlocks);
        currentBlocks = [...overlapBlocks, tokenText];
        currentLength = overlapBlocks.reduce((sum, b) => sum + b.length, 0) + tokenLength;
      } else {
        currentBlocks.push(tokenText);
        currentLength += tokenLength;
      }

      globalIndex += tokenLength;
    }

    // 处理剩余内容
    if (currentBlocks.length > 0) {
      segments.push({
        id: segmentId,
        content: currentBlocks.join('\n\n'),
        startIndex: globalIndex - currentLength,
        endIndex: globalIndex,
        type: this.detectSegmentType(currentBlocks),
      });
    }

    return segments;
  }

  /**
   * Markdown 词法分析
   */
  private lexer(content: string): any[] {
    return marked.lexer(content) as any;
  }

  /**
   * 获取重叠的块（保持上下文）
   */
  private getOverlapBlocks(blocks: string[]): string[] {
    // 保留最后 2-3 个块作为重叠
    const overlapCount = Math.min(3, Math.floor(blocks.length / 3));
    return blocks.slice(-overlapCount);
  }

  /**
   * 检测段落类型
   */
  private detectSegmentType(blocks: string[]): 'text' | 'code' | 'quote' | 'heading' {
    const hasCode = blocks.some(b => b.includes('```'));
    if (hasCode) return 'code';

    const hasQuote = blocks.some(b => b.trim().startsWith('>'));
    if (hasQuote) return 'quote';

    const hasHeading = blocks.some(b => b.trim().startsWith('#'));
    if (hasHeading) return 'heading';

    return 'text';
  }

  /**
   * 并行分析所有分段
   */
  private async analyzeSegments(segments: Segment[]): Promise<SegmentAnalysis[]> {
    // 为了控制并发，使用 p-limit 或类似工具
    // 这里简化为串行，实际可以并行
    const analyses: SegmentAnalysis[] = [];

    for (const segment of segments) {
      const analysis = await this.analyzeSegment(segment);
      analyses.push(analysis);
    }

    return analyses;
  }

  /**
   * 分析单个分段
   */
  private async analyzeSegment(segment: Segment): Promise<SegmentAnalysis> {
    const prompt = this.buildAnalysisPrompt(segment);

    try {
      const response = await this.llm.chat({
        model: this.config.analysisModel!,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的技术文章分析助手。请仔细分析给定的文章段落，提取关键信息。',
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
        segmentId: segment.id,
        keyPoints: result.keyPoints || [],
        technicalDetails: result.technicalDetails,
        sentiment: result.sentiment || 'neutral',
        importance: result.importance || 0.5,
        entities: result.entities,
      };
    } catch (error) {
      // 出错时返回默认分析结果
      return {
        segmentId: segment.id,
        keyPoints: [],
        importance: 0.5,
        sentiment: 'neutral',
      };
    }
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(segment: Segment): string {
    const contentPreview = segment.content.slice(0, 2000);

    return `请分析以下文章段落（类型：${segment.type}）：

${contentPreview}

请以 JSON 格式输出：
{
  "keyPoints": ["要点1", "要点2"],
  "technicalDetails": ["技术细节1"],
  "sentiment": "positive|neutral|negative",
  "importance": 0.8,
  "entities": ["实体1", "实体2"]
}

要求：
- keyPoints: 提取 2-5 个关键要点
- technicalDetails: 如果是代码段，提取技术细节
- sentiment: 判断段落情感倾向
- importance: 0-1 之间，评估该段对全文的重要性`;
  }

  /**
   * 聚合分析结果（Reduce 阶段）
   */
  private async aggregate(
    analyses: SegmentAnalysis[],
    metadata: { title: string; author?: string }
  ): Promise<Omit<ArticleAnalysisResult, 'analysisModel' | 'processingTime' | 'reflectionRounds'>> {
    // 按重要性排序
    const sortedAnalyses = analyses.sort((a, b) => b.importance - a.importance);

    // 提取并去重要点
    const uniquePoints = await this.deduplicatePoints(
      sortedAnalyses.flatMap(a => a.keyPoints)
    );

    // 生成摘要
    const summary = await this.generateSummary(sortedAnalyses, metadata);

    // 提取标签
    const tags = await this.extractTags(sortedAnalyses);

    // 计算评分
    const { aiScore, scoreDimensions } = this.calculateScore(sortedAnalyses);

    // 确定分类
    const { domain, subcategory } = await this.categorize(sortedAnalyses);

    return {
      oneLineSummary: summary.oneLine,
      summary: summary.full,
      mainPoints: uniquePoints.map((point, i) => ({
        point,
        explanation: '',
        importance: sortedAnalyses[i]?.importance || 0.5,
      })),
      tags,
      domain,
      subcategory,
      aiScore,
      scoreDimensions,
    };
  }

  /**
   * 去重相似要点
   */
  private async deduplicatePoints(points: string[]): Promise<string[]> {
    // TODO: 使用 Embedding 相似度去重
    // 简化版本：直接返回，不做去重
    return points;
  }

  /**
   * 生成摘要
   */
  private async generateSummary(
    analyses: SegmentAnalysis[],
    metadata: { title: string; author?: string }
  ): Promise<{ oneLine: string; full: string }> {
    const topAnalyses = analyses.slice(0, 5);
    const allPoints = topAnalyses.flatMap(a => a.keyPoints);

    const prompt = `基于以下分段分析结果，生成文章摘要：

原文标题：${metadata.title}
原文作者：${metadata.author || '未知'}

各段要点：
${allPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

请输出 JSON 格式：
{
  "oneLine": "一句话总结（不超过50字）",
  "full": "详细摘要（3-5句话，100-200字）"
}`;

    try {
      const response = await this.llm.chat({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.content);
      return {
        oneLine: result.oneLine || metadata.title,
        full: result.full || '',
      };
    } catch {
      return {
        oneLine: metadata.title,
        full: allPoints.join(' '),
      };
    }
  }

  /**
   * 提取标签
   */
  private async extractTags(analyses: SegmentAnalysis[]): Promise<string[]> {
    const allEntities = analyses.flatMap(a => a.entities || []);
    // 简化：直接返回去重的实体
    return Array.from(new Set(allEntities)).slice(0, 10);
  }

  /**
   * 计算评分
   */
  private calculateScore(analyses: SegmentAnalysis[]): {
    aiScore: number;
    scoreDimensions: {
      depth: number;
      quality: number;
      practicality: number;
      novelty: number;
    };
  } {
    const avgImportance = analyses.reduce((sum, a) => sum + a.importance, 0) / analyses.length;

    const technicalCount = analyses.filter(a => a.technicalDetails?.length).length;
    const depth = Math.min(10, 5 + technicalCount * 1.5);

    const positiveCount = analyses.filter(a => a.sentiment === 'positive').length;
    const quality = Math.min(10, 5 + (positiveCount / analyses.length) * 5);

    return {
      aiScore: Math.round((avgImportance * 10) * 10) / 10,
      scoreDimensions: {
        depth: Math.round(depth * 10) / 10,
        quality: Math.round(quality * 10) / 10,
        practicality: Math.round((depth * 0.7 + quality * 0.3) * 10) / 10,
        novelty: Math.round((quality * 0.5 + avgImportance * 10 * 0.5) * 10) / 10,
      },
    };
  }

  /**
   * 确定分类
   */
  private async categorize(analyses: SegmentAnalysis[]): Promise<{
    domain: string;
    subcategory: string;
  }> {
    // 简化版本：根据实体推断
    const allEntities = analyses.flatMap(a => a.entities || []).join(' ').toLowerCase();

    if (allEntities.includes('ai') || allEntities.includes('machine learning')) {
      return { domain: '技术', subcategory: 'AI/机器学习' };
    }

    if (allEntities.includes('rust') || allEntities.includes('javascript')) {
      return { domain: '技术', subcategory: '编程语言' };
    }

    return { domain: '技术', subcategory: '通用' };
  }
}
