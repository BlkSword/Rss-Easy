/**
 * 初评评估器
 *
 * 使用轻量级模型快速评估文章价值
 * 基于 BestBlogs 设计模式实现
 */

import { getDefaultAIService } from '@/lib/ai/client';

// =====================================================
// 类型定义
// =====================================================

export interface PreliminaryEvaluation {
  /** 是否忽略此文章（低质内容） */
  ignore: boolean;
  /** 主题描述 */
  reason: string;
  /** 价值评分 1-5 */
  value: number;
  /** 一句话总结（50字内） */
  summary: string;
  /** 语言类型 */
  language: string;
  /** 置信度 0-1 */
  confidence: number;
}

export interface PreliminaryEvaluatorConfig {
  /** 中文模型（推荐 deepseek-chat，性价比高） */
  chineseModel: string;
  /** 英文模型（推荐 gemini-1.5-flash） */
  englishModel: string;
  /** 其他语言模型（推荐 gpt-4o-mini） */
  otherModel: string;
  /** 最低价值分数（默认3分） */
  minValue: number;
  /** 是否启用语言检测 */
  enableLanguageDetection: boolean;
}

export interface EvaluateOptions {
  /** 内容截断长度（字符数） */
  truncateLength?: number;
  /** 是否强制分析 */
  forceAnalyze?: boolean;
}

// =====================================================
// 初评评估器类
// =====================================================

export class PreliminaryEvaluator {
  constructor(
    private config: PreliminaryEvaluatorConfig
  ) {}

  /**
   * 评估文章
   *
   * @param entry - 文章数据
   * @param options - 评估选项
   * @returns 初评结果
   */
  async evaluate(
    entry: {
      title: string;
      content: string;
      url?: string;
      author?: string;
    },
    options?: EvaluateOptions
  ): Promise<PreliminaryEvaluation> {

    const truncateLength = options?.truncateLength || 2000;
    const content = entry.content.slice(0, truncateLength);

    // 1. 语言检测
    const language = await this.detectLanguage(content);

    // 2. 选择对应模型
    const model = this.selectModel(language);

    // 3. 执行快速评估
    const evaluation = await this.performEvaluation(entry, content, language);

    return {
      ...evaluation,
      confidence: this.calculateConfidence(content.length, evaluation),
    };
  }

  /**
   * 批量评估文章
   */
  async evaluateBatch(
    entries: Array<{ title: string; content: string; url?: string }>,
    options?: EvaluateOptions
  ): Promise<PreliminaryEvaluation[]> {
    const evaluations = await Promise.all(
      entries.map(entry => this.evaluate(entry, options))
    );
    return evaluations;
  }

  /**
   * 语言检测
   *
   * 基于 Unicode 范围的快速检测
   */
  private async detectLanguage(content: string): Promise<string> {
    // 统计各语言字符数
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const japaneseChars = (content.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    const koreanChars = (content.match(/[\uac00-\ud7af]/g) || []).length;
    const latinChars = (content.match(/[a-zA-Z]/g) || []).length;
    const totalChars = content.length;

    // 计算比例
    const chineseRatio = chineseChars / totalChars;
    const japaneseRatio = japaneseChars / totalChars;
    const koreanRatio = koreanChars / totalChars;
    const latinRatio = latinChars / totalChars;

    // 判断主要语言
    if (chineseRatio > 0.2) return 'zh';
    if (japaneseRatio > 0.1) return 'ja';
    if (koreanRatio > 0.1) return 'ko';
    if (latinRatio > 0.5) {
      // 进一步检测拉丁语系语言
      return this.detectLatinLanguage(content);
    }

    return 'other';
  }

  /**
   * 检测拉丁语系语言
   */
  private detectLatinLanguage(content: string): string {
    const lowerText = content.toLowerCase();

    // 基于常见词的特征检测
    const patterns = {
      en: /\b(the|and|is|in|at|of|to|a|an|be|are)\b/g,
      es: /\b(el|la|de|que|y|a|en|un|una|es|son)\b/g,
      fr: /\b(le|la|de|et|à|un|une|en|une|est|son)\b/g,
      de: /\b(der|die|das|und|in|den|von|zu|ist|sind)\b/g,
      pt: /\b(o|a|de|e|em|um|uma|é|são)\b/g,
      it: /\b(il|la|di|e|in|un|una|è|sono)\b/g,
      ru: /[а-я]/g,
    };

    let maxCount = 0;
    let detectedLang = 'en';

    // 优先检测俄语（西里尔字母）
    const russianMatches = lowerText.match(patterns.ru);
    if (russianMatches && russianMatches.length > 10) {
      return 'ru';
    }

    // 检测其他拉丁语系
    for (const [lang, pattern] of Object.entries(patterns)) {
      if (lang === 'ru') continue;

      const matches = lowerText.match(pattern);
      const count = matches ? matches.length : 0;

      if (count > maxCount) {
        maxCount = count;
        detectedLang = lang;
      }
    }

    return detectedLang;
  }

  /**
   * 选择模型
   */
  private selectModel(language: string): string {
    switch (language) {
      case 'zh':
        return this.config.chineseModel;
      case 'en':
      case 'es':
      case 'fr':
      case 'de':
      case 'pt':
      case 'it':
        return this.config.englishModel;
      default:
        return this.config.otherModel;
    }
  }

  /**
   * 执行评估
   */
  private async performEvaluation(
    entry: { title: string; content: string; url?: string; author?: string },
    content: string,
    language: string
  ): Promise<Omit<PreliminaryEvaluation, 'confidence'>> {

    const isChinese = language === 'zh';

    // 使用 AI 服务进行分析
    const aiService = getDefaultAIService();

    try {
      const result = await aiService.analyzeArticle(
        `标题：${entry.title}\n\n内容：${content}`,
        {
          summary: true,
          category: true,
          importance: true,
          keywords: false,
          sentiment: false,
        }
      );

      // 解析结果
      const value = Math.round((result.importanceScore || 0.5) * 5);
      const summary = result.summary?.slice(0, 50) || '';

      return {
        ignore: value < this.config.minValue,
        reason: result.category || (isChinese ? '未分类' : 'Uncategorized'),
        value: Math.max(1, Math.min(5, value)),
        summary: summary + (summary.length >= 50 ? '' : '...'),
        language,
      };
    } catch (error) {
      console.error('初评失败:', error);
      // 失败时返回保守估计
      return {
        ignore: false,
        reason: isChinese ? '评估失败，需人工审核' : 'Evaluation failed',
        value: 3,
        summary: isChinese ? '内容待分析' : 'Content pending analysis',
        language,
      };
    }
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    contentLength: number,
    evaluation: Omit<PreliminaryEvaluation, 'confidence'>
  ): number {
    // 内容越长，置信度越高
    let confidence = Math.min(0.5 + (contentLength / 4000), 1);

    // 评分极端时降低置信度
    if (evaluation.value <= 1 || evaluation.value >= 5) {
      confidence *= 0.8;
    }

    return Math.round(confidence * 100) / 100;
  }

  /**
   * 获取配置
   */
  getConfig(): PreliminaryEvaluatorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<PreliminaryEvaluatorConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// =====================================================
// 默认实例工厂
// =====================================================

/**
 * 创建默认初评评估器
 *
 * 从环境变量读取配置
 */
export function createPreliminaryEvaluator(): PreliminaryEvaluator {
  return new PreliminaryEvaluator({
    chineseModel: process.env.PRELIMINARY_MODEL_ZH || 'deepseek-chat',
    englishModel: process.env.PRELIMINARY_MODEL_EN || 'gemini-1.5-flash',
    otherModel: process.env.PRELIMINARY_MODEL_OTHER || 'gpt-4o-mini',
    minValue: parseInt(process.env.PRELIMINARY_MIN_VALUE || '3', 10),
    enableLanguageDetection: process.env.ENABLE_LANGUAGE_DETECTION !== 'false',
  });
}

/**
 * 创建自定义初评评估器
 */
export function createCustomPreliminaryEvaluator(
  config: Partial<PreliminaryEvaluatorConfig>
): PreliminaryEvaluator {
  const defaultConfig = {
    chineseModel: 'deepseek-chat',
    englishModel: 'gemini-1.5-flash',
    otherModel: 'gpt-4o-mini',
    minValue: 3,
    enableLanguageDetection: true,
  };

  return new PreliminaryEvaluator({ ...defaultConfig, ...config });
}
