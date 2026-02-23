/**
 * 智能分析器
 *
 * 根据文章长度自动选择最优分析策略
 * 短文章直接分析，长文章分段分析
 * 基于 BestBlogs 的双路径设计
 */

import { SegmentedAnalyzer } from '@/lib/ai/analysis/segmented-analyzer';
import type { AIProvider } from '@/lib/ai/client';
import type { ArticleAnalysisResult, OpenSourceInfo } from '@/lib/ai/analysis/types';

// =====================================================
// 类型定义
// =====================================================

export interface SmartAnalyzerConfig {
  /** 短文章阈值（字符数） */
  shortThreshold: number;
  /** 分段阈值（字符数） */
  segmentThreshold: number;
  /** 分段最大长度 */
  segmentMaxLength: number;
  /** 相似度阈值（用于去重） */
  similarityThreshold: number;
}

export interface AnalyzeMetadata {
  title?: string;
  author?: string;
  url?: string;
  publishedAt?: Date;
}

// =====================================================
// 智能分析器类
// =====================================================

export class SmartAnalyzer {
  constructor(
    private llm: AIProvider,
    private config: SmartAnalyzerConfig = {
      shortThreshold: 6000,
      segmentThreshold: 12000,
      segmentMaxLength: 3000,
      similarityThreshold: 0.8,
    }
  ) {}

  /**
   * 智能分析
   *
   * 根据文章长度自动选择最优策略
   */
  async analyze(
    content: string,
    metadata?: AnalyzeMetadata
  ): Promise<ArticleAnalysisResult> {

    const contentLength = content.length;
    const startTime = Date.now();

    console.log(`文章长度: ${contentLength} 字符`);

    // 计算文章统计信息
    const stats = this.calculateContentStats(content);

    // 检测开源信息
    const openSourceInfo = this.detectOpenSource(content, metadata);

    // 路径 1: 短文直接分析
    if (contentLength <= this.config.shortThreshold) {
      console.log('使用短文直接分析路径');
      const result = await this.analyzeShort(content, metadata);
      return {
        ...result,
        contentLength: stats.contentLength,
        wordCount: stats.wordCount,
        readingTimeMinutes: stats.readingTimeMinutes,
        openSource: openSourceInfo,
        processingTime: Date.now() - startTime,
      };
    }

    // 路径 2: 中等文章分段分析
    if (contentLength <= this.config.segmentThreshold) {
      console.log('使用分段分析路径');
      const result = await this.analyzeSegmented(content, metadata);
      return {
        ...result,
        contentLength: stats.contentLength,
        wordCount: stats.wordCount,
        readingTimeMinutes: stats.readingTimeMinutes,
        openSource: openSourceInfo,
      };
    }

    // 路径 3: 长文章分段分析 + 合并
    console.log('使用长文分析路径（带合并）');
    const result = await this.analyzeLong(content, metadata);
    return {
      ...result,
      contentLength: stats.contentLength,
      wordCount: stats.wordCount,
      readingTimeMinutes: stats.readingTimeMinutes,
      openSource: openSourceInfo,
    };
  }

  /**
   * 计算文章统计信息
   */
  private calculateContentStats(content: string): {
    contentLength: number;
    wordCount: number;
    readingTimeMinutes: number;
  } {
    const contentLength = content.length;

    // 计算字数（中英文混合）
    // 中文按字符数，英文按单词数
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    const wordCount = chineseChars + englishWords;

    // 计算阅读时间（中文 300 字/分钟，英文 200 词/分钟）
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 300));

    return { contentLength, wordCount, readingTimeMinutes };
  }

  /**
   * 检测开源信息
   */
  private detectOpenSource(
    content: string,
    metadata?: AnalyzeMetadata
  ): OpenSourceInfo | undefined {
    const url = metadata?.url || '';

    // GitHub 仓库检测
    const githubPatterns = [
      /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/g,
      /repository[:\s]+([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/gi,
    ];

    for (const pattern of githubPatterns) {
      const match = pattern.exec(url) || pattern.exec(content);
      if (match) {
        return {
          isOpenSource: true,
          repo: match[1] ? `https://github.com/${match[1]}` : undefined,
        };
      }
    }

    // 许可证检测
    const licensePatterns = [
      { pattern: /MIT\s+License/i, license: 'MIT' },
      { pattern: /Apache\s+License.*2\.0/i, license: 'Apache-2.0' },
      { pattern: /GNU\s+General\s+Public\s+License/i, license: 'GPL' },
      { pattern: /BSD\s+3[-\s]Clause/i, license: 'BSD-3-Clause' },
      { pattern: /ISC\s+License/i, license: 'ISC' },
      { pattern: /Mozilla\s+Public\s+License/i, license: 'MPL-2.0' },
    ];

    for (const { pattern, license } of licensePatterns) {
      if (pattern.test(content)) {
        return {
          isOpenSource: true,
          license,
        };
      }
    }

    // 编程语言检测（基于代码块）
    const codeBlockPattern = /```(\w+)\n/g;
    const languages: string[] = [];
    let codeMatch;
    while ((codeMatch = codeBlockPattern.exec(content)) !== null) {
      if (codeMatch[1] && !languages.includes(codeMatch[1])) {
        languages.push(codeMatch[1]);
      }
    }

    // 如果有多个代码块，可能是技术文章
    if (languages.length > 0) {
      return {
        isOpenSource: false,
        language: languages[0], // 主要语言
      };
    }

    return undefined;
  }

  /**
   * 短文直接分析
   */
  private async analyzeShort(
    content: string,
    metadata?: AnalyzeMetadata
  ): Promise<ArticleAnalysisResult> {

    const prompt = this.buildDirectPrompt(content, metadata);

    try {
      const response = await this.llm.chat({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      return this.parseResult(response.content, {
        analysisModel: 'direct-analysis',
        processingTime: Date.now() - Date.now(),
      });
    } catch (error) {
      console.error('短文分析失败:', error);
      throw new Error(`短文分析失败: ${error}`);
    }
  }

  /**
   * 分段分析
   */
  private async analyzeSegmented(
    content: string,
    metadata?: AnalyzeMetadata
  ): Promise<ArticleAnalysisResult> {

    const segmentedAnalyzer = new SegmentedAnalyzer(this.llm);
    return await segmentedAnalyzer.analyze(content, {
      title: metadata?.title || '',
      author: metadata?.author,
    });
  }

  /**
   * 长文分析（带合并）
   */
  private async analyzeLong(
    content: string,
    metadata?: AnalyzeMetadata
  ): Promise<ArticleAnalysisResult> {

    // 分段
    const segments = this.splitIntoSegments(content, this.config.segmentMaxLength);
    console.log(`文章分为 ${segments.length} 段`);

    // 并行分析各段
    const results = await Promise.all(
      segments.map((segment, index) =>
        this.analyzeSegment(segment, metadata, index)
      )
    );

    // 合并结果
    return this.mergeResults(results, content);
  }

  /**
   * 分析单个段落
   */
  private async analyzeSegment(
    segment: string,
    metadata?: AnalyzeMetadata,
    index?: number
  ): Promise<ArticleAnalysisResult> {

    const prompt = this.buildSegmentPrompt(segment, metadata, index);

    try {
      const response = await this.llm.chat({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getSegmentSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      return this.parseResult(response.content, {});
    } catch (error) {
      console.error(`段落 ${index} 分析失败:`, error);
      // 返回空结果，不影响整体
      return this.getEmptyResult();
    }
  }

  /**
   * 分割成段落
   */
  private splitIntoSegments(content: string, maxLength: number): string[] {
    const segments: string[] = [];
    let current = '';

    // 按段落分割
    const paragraphs = content.split(/\n\n+/);

    for (const para of paragraphs) {
      const trimmedPara = para.trim();

      // 如果单个段落超过最大长度，需要进一步分割
      if (trimmedPara.length > maxLength) {
        // 保存当前内容
        if (current.length > 0) {
          segments.push(current.trim());
          current = '';
        }

        // 分割长段落
        const subSegments = this.splitLongParagraph(trimmedPara, maxLength);
        segments.push(...subSegments);
      } else {
        // 检查是否需要开始新段落
        if (current.length + trimmedPara.length > maxLength && current.length > 0) {
          segments.push(current.trim());
          current = trimmedPara;
        } else {
          current += (current.length > 0 ? '\n\n' : '') + trimmedPara;
        }
      }
    }

    // 添加最后一段
    if (current.length > 0) {
      segments.push(current.trim());
    }

    return segments.filter(s => s.length > 0);
  }

  /**
   * 分割长段落
   */
  private splitLongParagraph(paragraph: string, maxLength: number): string[] {
    const segments: string[] = [];
    let current = '';

    // 按句子分割
    const sentences = paragraph.match(/[^.!?。！？]+[.!?。！？]*/g) || [paragraph];

    for (const sentence of sentences) {
      if (current.length + sentence.length > maxLength && current.length > 0) {
        segments.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }

    if (current.length > 0) {
      segments.push(current.trim());
    }

    return segments;
  }

  /**
   * 合并结果
   */
  private mergeResults(
    results: ArticleAnalysisResult[],
    originalContent: string
  ): ArticleAnalysisResult {

    // 过滤掉空结果
    const validResults = results.filter(r => r.summary);

    if (validResults.length === 0) {
      return this.getEmptyResult();
    }

    // 收集所有要点
    const allPoints = validResults.flatMap(r => r.mainPoints || []);

    // 去重（基于相似度）
    const uniquePoints = this.deduplicatePoints(
      allPoints.map(p => typeof p === 'string' ? p : p.point)
    );

    // 合并标签
    const allTags = validResults.flatMap(r => r.tags || []);
    const uniqueTags = this.removeDuplicates(allTags);

    // 合并摘要
    const combinedSummary = validResults
      .map(r => r.summary)
      .filter(Boolean)
      .join('\n\n');

    // 计算平均评分
    const avgScore = this.calculateAverageScore(validResults);

    // 合并评分维度
    const scoreDimensions = this.mergeScoreDimensions(validResults);

    return {
      oneLineSummary: validResults[0]?.oneLineSummary || '',
      summary: combinedSummary,
      mainPoints: uniquePoints.slice(0, 10).map(point => ({
        point,
        explanation: '',
        importance: 0.5,
      })), // 最多10个要点
      tags: uniqueTags.slice(0, 8),
      domain: validResults[0]?.domain,
      subcategory: validResults[0]?.subcategory,
      aiScore: avgScore,
      scoreDimensions,
      keyQuotes: validResults[0]?.keyQuotes,
      analysisModel: 'smart-analyzer-merged',
      processingTime: validResults.reduce((sum, r) => sum + (r.processingTime || 0), 0),
      reflectionRounds: 0,
    };
  }

  /**
   * 要点去重
   */
  private deduplicatePoints(points: string[]): string[] {
    const unique: string[] = [];

    for (const point of points) {
      // 检查是否与已有要点相似
      const isDuplicate = unique.some(existing =>
        this.calculateSimilarity(existing, point) > this.config.similarityThreshold
      );

      if (!isDuplicate) {
        unique.push(point);
      }
    }

    return unique;
  }

  /**
   * 计算文本相似度（简化的词袋模型）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // 简单的词袋模型相似度
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set(
      [...words1].filter(x => words2.has(x))
    );

    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 移除重复项
   */
  private removeDuplicates<T>(items: T[]): T[] {
    return Array.from(new Set(items));
  }

  /**
   * 计算平均评分
   */
  private calculateAverageScore(results: ArticleAnalysisResult[]): number {
    const scores = results
      .map(r => r.aiScore)
      .filter((score): score is number => score !== undefined);

    if (scores.length === 0) return 5;

    return Math.round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    );
  }

  /**
   * 合并评分维度
   */
  private mergeScoreDimensions(results: ArticleAnalysisResult[]): any {
    const dimensions = results
      .map(r => r.scoreDimensions)
      .filter(Boolean);

    if (dimensions.length === 0) return undefined;

    // 计算各维度平均值
    const merged: any = {};
    const keys = ['depth', 'quality', 'practicality', 'novelty'];

    for (const key of keys) {
      const values = dimensions
        .map(d => d?.[key as keyof typeof d])
        .filter((v): v is number => v !== undefined);

      if (values.length > 0) {
        merged[key] = Math.round(
          values.reduce((sum, v) => sum + v, 0) / values.length
        );
      }
    }

    return merged;
  }

  /**
   * 构建直接分析提示词
   */
  private buildDirectPrompt(content: string, metadata?: AnalyzeMetadata): string {
    return `
请分析以下文章：

标题：${metadata?.title || '未知'}
作者：${metadata?.author || '未知'}
发布时间：${metadata?.publishedAt?.toLocaleString() || '未知'}

${content}

请返回 JSON 格式：
{
  "oneLineSummary": "一句话总结（20字内）",
  "summary": "详细摘要（3-5句话）",
  "mainPoints": ["要点1", "要点2", "要点3"],
  "tags": ["标签1", "标签2", "标签3"],
  "domain": "领域",
  "subcategory": "子领域",
  "aiScore": 8,
  "scoreDimensions": {
    "depth": 8,
    "quality": 7,
    "practicality": 9,
    "novelty": 6
  }
}
    `.trim();
  }

  /**
   * 构建段落分析提示词
   */
  private buildSegmentPrompt(
    segment: string,
    metadata?: AnalyzeMetadata,
    index?: number
  ): string {
    const prefix = index !== undefined ? `[段落 ${index + 1}] ` : '';

    return `
${prefix}请分析以下文章段落（这是长文章的一部分）：

标题：${metadata?.title || '未知'}

${segment}

请返回 JSON 格式：
{
  "summary": "本段落摘要",
  "mainPoints": ["段落要点1", "段落要点2"],
  "tags": ["段落标签"]
}
    `.trim();
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `你是专业的文章分析助手。

请分析文章并返回：
1. 一句话总结（20字内）
2. 详细摘要（3-5句话）
3. 主要观点（3-5个，按重要性排序）
4. 相关标签（3-5个）
5. 文章领域
6. 质量评分（1-10分）
7. 评分维度（深度、质量、实用性、新颖性）

返回格式必须是 JSON。`;
  }

  /**
   * 获取段落分析系统提示词
   */
  private getSegmentSystemPrompt(): string {
    return `你是文章段落分析助手。

请分析给定的文章段落，提取：
1. 段落摘要
2. 段落要点
3. 段落标签

返回格式必须是 JSON。`;
  }

  /**
   * 解析结果
   */
  private parseResult(
    content: string,
    extras: Record<string, any>
  ): ArticleAnalysisResult {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          oneLineSummary: parsed.oneLineSummary || '',
          summary: parsed.summary || '',
          mainPoints: parsed.mainPoints || [],
          tags: parsed.tags || [],
          domain: parsed.domain,
          subcategory: parsed.subcategory,
          aiScore: parsed.aiScore || 5,
          scoreDimensions: parsed.scoreDimensions,
          keyQuotes: parsed.keyQuotes,
          analysisModel: extras.analysisModel || 'smart-analyzer',
          processingTime: extras.processingTime,
          reflectionRounds: 0,
        };
      }
    } catch (error) {
      console.error('解析 JSON 失败:', error);
    }

    // 如果解析失败，返回默认结构
    return {
      oneLineSummary: content.slice(0, 50),
      summary: content,
      mainPoints: [],
      tags: [],
      aiScore: 5,
      domain: 'unknown',
      subcategory: 'unknown',
      scoreDimensions: { depth: 5, quality: 5, practicality: 5, novelty: 5 },
      analysisModel: extras.analysisModel || 'smart-analyzer',
      processingTime: extras.processingTime,
      reflectionRounds: 0,
    };
  }

  /**
   * 获取空结果
   */
  private getEmptyResult(): ArticleAnalysisResult {
    return {
      oneLineSummary: '',
      summary: '',
      mainPoints: [],
      tags: [],
      aiScore: 0,
      domain: 'unknown',
      subcategory: 'unknown',
      scoreDimensions: { depth: 0, quality: 0, practicality: 0, novelty: 0 },
      analysisModel: 'smart-analyzer',
      processingTime: 0,
      reflectionRounds: 0,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<SmartAnalyzerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 获取配置
   */
  getConfig(): SmartAnalyzerConfig {
    return { ...this.config };
  }
}

// =====================================================
// 工厂函数
// =====================================================

/**
 * 创建默认智能分析器
 */
export function createSmartAnalyzer(llm: AIProvider): SmartAnalyzer {
  return new SmartAnalyzer(llm, {
    shortThreshold: parseInt(process.env.SHORT_ARTICLE_THRESHOLD || '6000', 10),
    segmentThreshold: parseInt(process.env.SEGMENT_ARTICLE_THRESHOLD || '12000', 10),
    segmentMaxLength: 3000,
    similarityThreshold: 0.8,
  });
}

/**
 * 创建自定义智能分析器
 */
export function createCustomSmartAnalyzer(
  llm: AIProvider,
  config: Partial<SmartAnalyzerConfig>
): SmartAnalyzer {
  const defaultConfig: SmartAnalyzerConfig = {
    shortThreshold: 6000,
    segmentThreshold: 12000,
    segmentMaxLength: 3000,
    similarityThreshold: 0.8,
  };

  return new SmartAnalyzer(llm, { ...defaultConfig, ...config });
}
