/**
 * 模型选择器
 *
 * 根据语言和阶段选择最优模型
 * 基于 BestBlogs 分层模型策略
 */

// =====================================================
// 类型定义
// =====================================================

export interface ModelConfig {
  /** 中文模型配置 */
  chinese: ModelTierConfig;
  /** 英文模型配置 */
  english: ModelTierConfig;
  /** 其他语言模型配置 */
  other: ModelTierConfig;
}

export interface ModelTierConfig {
  /** 初评阶段模型（性价比优先） */
  preliminary: string;
  /** 分析阶段模型（效果优先） */
  analysis: string;
  /** 反思阶段模型（质量优先） */
  reflection: string;
}

export type AnalysisStage = 'preliminary' | 'analysis' | 'reflection';
export type LanguageType = 'chinese' | 'english' | 'other';

// =====================================================
// 模型选择器类
// =====================================================

export class ModelSelector {
  constructor(private config: ModelConfig) {}

  /**
   * 选择模型
   *
   * @param language - 语言代码 ('zh', 'en', 'ja', 'ko', 'ru', etc.)
   * @param stage - 分析阶段
   * @returns 模型名称
   */
  selectModel(language: string, stage: AnalysisStage): string {
    const langKey = this.getLangKey(language);
    return this.config[langKey][stage];
  }

  /**
   * 批量选择模型
   *
   * @param languageStagePairs - 语言和阶段对
   * @returns 模型名称数组
   */
  selectModelsBatch(
    languageStagePairs: Array<{ language: string; stage: AnalysisStage }>
  ): string[] {
    return languageStagePairs.map(({ language, stage }) =>
      this.selectModel(language, stage)
    );
  }

  /**
   * 获取语言键
   *
   * @param language - 语言代码
   * @returns 语言类型键
   */
  private getLangKey(language: string): LanguageType {
    // 中文（含简繁体）
    if (language.startsWith('zh')) return 'chinese';

    // 英文
    if (language.startsWith('en')) return 'english';

    // 日文
    if (language.startsWith('ja')) return 'other';

    // 韩文
    if (language.startsWith('ko')) return 'other';

    // 拉丁语系（使用英文模型）
    if (['es', 'fr', 'de', 'pt', 'it'].some(l => language.startsWith(l))) {
      return 'english';
    }

    return 'other';
  }

  /**
   * 获取完整配置
   */
  getConfig(): ModelConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 获取特定语言的配置
   */
  getLanguageConfig(language: string): ModelTierConfig {
    const langKey = this.getLangKey(language);
    return { ...this.config[langKey] };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 更新特定语言的模型
   */
  updateLanguageModel(
    language: LanguageType,
    stage: AnalysisStage,
    model: string
  ): void {
    this.config[language][stage] = model;
  }

  /**
   * 验证模型配置
   *
   * @returns 验证结果
   */
  validateConfig(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const languages: LanguageType[] = ['chinese', 'english', 'other'];
    const stages: AnalysisStage[] = ['preliminary', 'analysis', 'reflection'];

    for (const lang of languages) {
      for (const stage of stages) {
        const model = this.config[lang][stage];
        if (!model || model.trim() === '') {
          errors.push(`Missing model for ${lang} - ${stage}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取模型使用统计
   *
   * 用于成本分析
   */
  getModelStats(): Record<string, { languages: string[]; stages: AnalysisStage[] }> {
    const stats: Record<string, { languages: string[]; stages: AnalysisStage[] }> = {};

    const languages: LanguageType[] = ['chinese', 'english', 'other'];
    const stages: AnalysisStage[] = ['preliminary', 'analysis', 'reflection'];

    for (const lang of languages) {
      for (const stage of stages) {
        const model = this.config[lang][stage];

        if (!stats[model]) {
          stats[model] = { languages: [], stages: [] };
        }

        if (!stats[model].languages.includes(lang)) {
          stats[model].languages.push(lang);
        }

        if (!stats[model].stages.includes(stage)) {
          stats[model].stages.push(stage);
        }
      }
    }

    return stats;
  }
}

// =====================================================
// 默认配置
// =====================================================

/**
 * 默认模型配置
 *
 * 成本优化策略：
 * - 初评：使用性价比高的轻量模型
 * - 分析：使用中等质量模型
 * - 反思：使用高质量模型
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  chinese: {
    preliminary: 'deepseek-chat',      // ¥0.14/1M tokens
    analysis: 'deepseek-chat',         // ¥0.14/1M tokens
    reflection: 'deepseek-chat',       // ¥0.14/1M tokens
  },
  english: {
    preliminary: 'gemini-1.5-flash',   // $0.075/1M tokens
    analysis: 'gemini-1.5-pro',        // $3.5/1M tokens
    reflection: 'gpt-4o',              // $5/1M tokens
  },
  other: {
    preliminary: 'gpt-4o-mini',        // $0.15/1M tokens
    analysis: 'gpt-4o',                // $5/1M tokens
    reflection: 'gpt-4o',              // $5/1M tokens
  },
};

// =====================================================
// 工厂函数
// =====================================================

/**
 * 创建默认模型选择器
 *
 * 从环境变量读取配置，如果没有则使用默认配置
 */
export function createModelSelector(): ModelSelector {
  const config: ModelConfig = {
    chinese: {
      preliminary: process.env.PRELIMINARY_MODEL_ZH || DEFAULT_MODEL_CONFIG.chinese.preliminary,
      analysis: process.env.ANALYSIS_MODEL_ZH || DEFAULT_MODEL_CONFIG.chinese.analysis,
      reflection: process.env.REFLECTION_MODEL_ZH || DEFAULT_MODEL_CONFIG.chinese.reflection,
    },
    english: {
      preliminary: process.env.PRELIMINARY_MODEL_EN || DEFAULT_MODEL_CONFIG.english.preliminary,
      analysis: process.env.ANALYSIS_MODEL_EN || DEFAULT_MODEL_CONFIG.english.analysis,
      reflection: process.env.REFLECTION_MODEL_EN || DEFAULT_MODEL_CONFIG.english.reflection,
    },
    other: {
      preliminary: process.env.PRELIMINARY_MODEL_OTHER || DEFAULT_MODEL_CONFIG.other.preliminary,
      analysis: process.env.ANALYSIS_MODEL_OTHER || DEFAULT_MODEL_CONFIG.other.analysis,
      reflection: process.env.REFLECTION_MODEL_OTHER || DEFAULT_MODEL_CONFIG.other.reflection,
    },
  };

  return new ModelSelector(config);
}

/**
 * 创建自定义模型选择器
 */
export function createCustomModelSelector(
  config: Partial<ModelConfig>
): ModelSelector {
  const mergedConfig: ModelConfig = {
    chinese: { ...DEFAULT_MODEL_CONFIG.chinese },
    english: { ...DEFAULT_MODEL_CONFIG.english },
    other: { ...DEFAULT_MODEL_CONFIG.other },
    ...config,
  };

  return new ModelSelector(mergedConfig);
}

/**
 * 创建极简模型选择器（全部使用同一模型）
 *
 * 用于测试或不需要模型分层的场景
 */
export function createSimpleModelSelector(model: string): ModelSelector {
  const config: ModelConfig = {
    chinese: { preliminary: model, analysis: model, reflection: model },
    english: { preliminary: model, analysis: model, reflection: model },
    other: { preliminary: model, analysis: model, reflection: model },
  };

  return new ModelSelector(config);
}

// =====================================================
// 辅助函数
// =====================================================

/**
 * 获取模型的提供商
 *
 * @param model - 模型名称
 * @returns 提供商名称
 */
export function getModelProvider(model: string): string {
  if (model.startsWith('gpt') || model.startsWith('o1')) return 'openai';
  if (model.startsWith('claude') || model.startsWith('gemini')) {
    // 区分 Anthropic 和 Gemini
    if (model.includes('gemini')) return 'gemini';
    return 'anthropic';
  }
  if (model.startsWith('deepseek')) return 'deepseek';
  if (model.includes('llama') || model.includes('mistral')) return 'ollama';

  return 'custom';
}

/**
 * 检查模型是否可用
 *
 * @param model - 模型名称
 * @returns 是否可用
 */
export function isModelAvailable(model: string): boolean {
  const provider = getModelProvider(model);
  const apiKey = getProviderApiKey(provider);

  return !!apiKey;
}

/**
 * 获取提供商的 API Key
 */
function getProviderApiKey(provider: string): string | undefined {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY;
    case 'gemini':
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    default:
      return process.env.CUSTOM_API_KEY;
  }
}
