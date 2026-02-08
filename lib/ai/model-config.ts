/**
 * 模型配置管理
 *
 * 管理所有 AI 模型的配置、成本和性能参数
 * 基于 BestBlogs 的分层模型策略
 */

// =====================================================
// 类型定义
// =====================================================

export interface ModelTierConfig {
  /** 提供商 */
  provider: string;
  /** 模型名称 */
  model: string;
  /** 最大 token 数 */
  maxTokens: number;
  /** 每 1K token 成本（美元） */
  costPer1kTokens: number;
  /** 质量评分 1-10 */
  quality: number;
  /** 速度评分 1-10 */
  speed: number;
}

export type ModelProvider = 'openai' | 'anthropic' | 'deepseek' | 'gemini' | 'ollama' | 'custom';

// =====================================================
// 模型配置库
// =====================================================

/**
 * 所有支持的模型配置
 */
export const MODEL_REGISTRY: Record<string, ModelTierConfig> = {
  // OpenAI 模型
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 128000,
    costPer1kTokens: 0.005,
    quality: 9,
    speed: 8,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 128000,
    costPer1kTokens: 0.00015,
    quality: 7,
    speed: 9,
  },
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo',
    maxTokens: 128000,
    costPer1kTokens: 0.01,
    quality: 8,
    speed: 7,
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    maxTokens: 16385,
    costPer1kTokens: 0.0005,
    quality: 6,
    speed: 9,
  },

  // Anthropic 模型
  'claude-3-5-sonnet': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 200000,
    costPer1kTokens: 0.003,
    quality: 9,
    speed: 7,
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    maxTokens: 200000,
    costPer1kTokens: 0.00025,
    quality: 6,
    speed: 10,
  },
  'claude-3-opus': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    maxTokens: 200000,
    costPer1kTokens: 0.015,
    quality: 10,
    speed: 5,
  },

  // DeepSeek 模型
  'deepseek-chat': {
    provider: 'deepseek',
    model: 'deepseek-chat',
    maxTokens: 128000,
    costPer1kTokens: 0.00014, // ¥1/1M tokens ≈ $0.14/1M
    quality: 8,
    speed: 8,
  },
  'deepseek-coder': {
    provider: 'deepseek',
    model: 'deepseek-coder',
    maxTokens: 128000,
    costPer1kTokens: 0.00014,
    quality: 8,
    speed: 8,
  },

  // Gemini 模型
  'gemini-1.5-flash': {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    maxTokens: 1000000,
    costPer1kTokens: 0.000075,
    quality: 7,
    speed: 10,
  },
  'gemini-1.5-pro': {
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    maxTokens: 2000000,
    costPer1kTokens: 0.0035,
    quality: 9,
    speed: 7,
  },
  'gemini-pro': {
    provider: 'gemini',
    model: 'gemini-pro',
    maxTokens: 32000,
    costPer1kTokens: 0.00025,
    quality: 7,
    speed: 8,
  },

  // Ollama 本地模型
  'llama3': {
    provider: 'ollama',
    model: 'llama3',
    maxTokens: 8192,
    costPer1kTokens: 0, // 本地模型免费
    quality: 6,
    speed: 5,
  },
  'mistral': {
    provider: 'ollama',
    model: 'mistral',
    maxTokens: 8192,
    costPer1kTokens: 0,
    quality: 6,
    speed: 6,
  },
};

// =====================================================
// 配置管理类
// =====================================================

export class ModelConfigManager {
  private customModels: Record<string, ModelTierConfig> = {};

  /**
   * 获取模型配置
   */
  getModelConfig(modelKey: string): ModelTierConfig {
    return (
      this.customModels[modelKey] ||
      MODEL_REGISTRY[modelKey] ||
      MODEL_REGISTRY['gpt-4o-mini'] // 默认模型
    );
  }

  /**
   * 注册自定义模型
   */
  registerModel(key: string, config: ModelTierConfig): void {
    this.customModels[key] = config;
  }

  /**
   * 获取所有可用模型
   */
  getAvailableModels(): string[] {
    return [...Object.keys(MODEL_REGISTRY), ...Object.keys(this.customModels)];
  }

  /**
   * 按提供商筛选模型
   */
  getModelsByProvider(provider: ModelProvider): string[] {
    return this.getAvailableModels().filter(key => {
      const config = this.getModelConfig(key);
      return config.provider === provider;
    });
  }

  /**
   * 按质量筛选模型
   */
  getModelsByQuality(minQuality: number): string[] {
    return this.getAvailableModels().filter(key => {
      const config = this.getModelConfig(key);
      return config.quality >= minQuality;
    });
  }

  /**
   * 按成本筛选模型
   */
  getModelsByMaxCost(maxCost: number): string[] {
    return this.getAvailableModels().filter(key => {
      const config = this.getModelConfig(key);
      return config.costPer1kTokens <= maxCost;
    });
  }

  /**
   * 计算成本
   */
  calculateCost(
    modelKey: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const config = this.getModelConfig(modelKey);
    const totalTokens = inputTokens + outputTokens;
    return (totalTokens / 1000) * config.costPer1kTokens;
  }

  /**
   * 批量计算成本
   */
  calculateCostBatch(
    usage: Array<{ modelKey: string; inputTokens: number; outputTokens: number }>
  ): number {
    return usage.reduce((total, item) => {
      return total + this.calculateCost(item.modelKey, item.inputTokens, item.outputTokens);
    }, 0);
  }

  /**
   * 获取最优模型（性价比）
   */
  getBestValueModel(minQuality: number = 7): string {
    const candidates = this.getModelsByQuality(minQuality);

    // 计算性价比 (质量 / 成本)
    let bestModel = candidates[0];
    let bestRatio = 0;

    for (const model of candidates) {
      const config = this.getModelConfig(model);
      const ratio = config.quality / config.costPer1kTokens;

      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestModel = model;
      }
    }

    return bestModel;
  }

  /**
   * 获取最快模型
   */
  getFastestModel(minQuality: number = 6): string {
    const candidates = this.getModelsByQuality(minQuality);

    let fastestModel = candidates[0];
    let maxSpeed = 0;

    for (const model of candidates) {
      const config = this.getModelConfig(model);
      if (config.speed > maxSpeed) {
        maxSpeed = config.speed;
        fastestModel = model;
      }
    }

    return fastestModel;
  }

  /**
   * 比较模型
   */
  compareModels(modelKeys: string[]): Array<{
    model: string;
    config: ModelTierConfig;
    costRatio: number; // 相对于最便宜模型的成本倍数
  }> {
    const models = modelKeys.map(key => ({
      model: key,
      config: this.getModelConfig(key),
      costRatio: 0,
    }));

    // 找到最便宜的模型
    const minCost = Math.min(...models.map(m => m.config.costPer1kTokens));

    // 计算成本倍数
    models.forEach(m => {
      m.costRatio = m.config.costPer1kTokens / minCost;
    });

    // 按成本排序
    models.sort((a, b) => a.costRatio - b.costRatio);

    return models;
  }

  /**
   * 获取模型推荐
   */
  getModelRecommendation(requirements: {
    language?: string;
    stage?: 'preliminary' | 'analysis' | 'reflection';
    maxCost?: number;
    minQuality?: number;
    priority?: 'cost' | 'quality' | 'speed';
  }): string {
    const {
      language = 'en',
      stage = 'analysis',
      maxCost,
      minQuality = 7,
      priority = 'quality',
    } = requirements;

    let candidates: string[];

    // 根据语言筛选
    if (language.startsWith('zh')) {
      // 中文优先使用 DeepSeek
      candidates = ['deepseek-chat', 'deepseek-coder', 'gpt-4o-mini', 'claude-3-haiku'];
    } else if (language.startsWith('en')) {
      // 英文使用 Gemini 或 OpenAI
      candidates = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gpt-4o-mini', 'gpt-4o'];
    } else {
      // 其他语言
      candidates = ['gpt-4o-mini', 'gemini-1.5-flash', 'claude-3-haiku'];
    }

    // 根据阶段筛选
    if (stage === 'preliminary') {
      // 初评阶段：优先使用便宜快速的模型
      if (priority === 'cost') {
        return candidates[0]; // 最便宜的
      }
    } else if (stage === 'reflection') {
      // 反思阶段：优先使用高质量模型
      candidates = candidates.filter(m => {
        const config = this.getModelConfig(m);
        return config.quality >= 8;
      });
    }

    // 应用质量过滤
    candidates = candidates.filter(m => {
      const config = this.getModelConfig(m);
      return config.quality >= minQuality;
    });

    // 应用成本过滤
    if (maxCost !== undefined) {
      candidates = candidates.filter(m => {
        const config = this.getModelConfig(m);
        return config.costPer1kTokens <= maxCost;
      });
    }

    // 根据优先级排序
    if (priority === 'cost') {
      candidates.sort((a, b) => {
        const configA = this.getModelConfig(a);
        const configB = this.getModelConfig(b);
        return configA.costPer1kTokens - configB.costPer1kTokens;
      });
    } else if (priority === 'quality') {
      candidates.sort((a, b) => {
        const configA = this.getModelConfig(a);
        const configB = this.getModelConfig(b);
        return configB.quality - configA.quality;
      });
    } else if (priority === 'speed') {
      candidates.sort((a, b) => {
        const configA = this.getModelConfig(a);
        const configB = this.getModelConfig(b);
        return configB.speed - configA.speed;
      });
    }

    return candidates[0] || 'gpt-4o-mini';
  }
}

// =====================================================
// 默认实例
// =====================================================

export const modelConfigManager = new ModelConfigManager();

// =====================================================
// 辅助函数
// =====================================================

/**
 * 获取模型配置
 */
export function getModelConfig(modelKey: string): ModelTierConfig {
  return modelConfigManager.getModelConfig(modelKey);
}

/**
 * 计算成本
 */
export function calculateCost(
  modelKey: string,
  inputTokens: number,
  outputTokens: number
): number {
  return modelConfigManager.calculateCost(modelKey, inputTokens, outputTokens);
}

/**
 * 获取最优模型
 */
export function getBestValueModel(minQuality: number = 7): string {
  return modelConfigManager.getBestValueModel(minQuality);
}

/**
 * 获取模型推荐
 */
export function getModelRecommendation(requirements: {
  language?: string;
  stage?: 'preliminary' | 'analysis' | 'reflection';
  maxCost?: number;
  minQuality?: number;
  priority?: 'cost' | 'quality' | 'speed';
}): string {
  return modelConfigManager.getModelRecommendation(requirements);
}
