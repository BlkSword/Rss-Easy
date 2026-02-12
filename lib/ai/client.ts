/**
 * AI服务客户端
 * 支持OpenAI、Anthropic、DeepSeek等多个提供商
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'custom';
  model: string;
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIAnalysisResult {
  summary?: string;
  keywords?: string[];
  category?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  importanceScore?: number;
  tokensUsed?: number;
  cost?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  tokensUsed?: number;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' | 'text' };
}

/**
 * AI服务基类
 */
export abstract class AIProvider {
  protected config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  abstract generateSummary(content: string): Promise<string>;
  abstract extractKeywords(content: string): Promise<string[]>;
  abstract categorize(content: string): Promise<string>;
  abstract analyzeSentiment(content: string): Promise<'positive' | 'neutral' | 'negative'>;
  abstract calculateImportance(content: string): Promise<number>;
  abstract generateEmbedding(text: string): Promise<EmbeddingResult>;
  abstract chat(options: ChatOptions): Promise<ChatResponse>;
}

/**
 * OpenAI提供商
 */
class OpenAIProvider extends AIProvider {
  private client: OpenAI;

  constructor(config: AIConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseURL,
    });
  }

  async generateSummary(content: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.config.model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `你是一个专业的文章摘要助手。请用中文生成简洁的文章摘要，要求：
1. 3-5句话概括文章核心内容
2. 突出文章的关键信息和观点
3. 语言简洁明了，避免冗余
4. 如果文章是技术类，突出技术要点`,
        },
        {
          role: 'user',
          content: `请为以下文章生成摘要：\n\n${content.slice(0, 8000)}`,
        },
      ],
      max_tokens: this.config.maxTokens || 500,
      temperature: this.config.temperature || 0.7,
    });

    return response.choices[0].message.content || '';
  }

  async extractKeywords(content: string): Promise<string[]> {
    const response = await this.client.chat.completions.create({
      model: this.config.model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '请从文章中提取5-10个最重要的关键词，用逗号分隔。',
        },
        {
          role: 'user',
          content: `请提取关键词：\n\n${content.slice(0, 4000)}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const text = response.choices[0].message.content || '';
    return text.split(/[,，]/).map(k => k.trim()).filter(k => k.length > 0);
  }

  async categorize(content: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.config.model || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `请将文章分类到以下类别之一：
AI/机器学习, 前端开发, 后端开发, 移动开发, 云计算/DevOps,
数据库, 网络安全, 区块链, 游戏, 产品设计, 创业/商业,
行业新闻, 技术趋势, 工具/资源, 教程/指南

只返回类别名称。文章内容：\n\n${content.slice(0, 2000)}`,
        },
      ],
      max_tokens: 50,
      temperature: 0.3,
    });

    return (response.choices[0].message.content || '').trim();
  }

  async analyzeSentiment(content: string): Promise<'positive' | 'neutral' | 'negative'> {
    const response = await this.client.chat.completions.create({
      model: this.config.model || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `分析文章的情感倾向，只返回以下三个词之一：positive、neutral、negative\n\n文章内容：\n${content.slice(0, 1000)}`,
        },
      ],
      max_tokens: 20,
      temperature: 0.1,
    });

    const sentiment = (response.choices[0].message.content || '').trim().toLowerCase();
    if (sentiment.includes('positive')) return 'positive';
    if (sentiment.includes('negative')) return 'negative';
    return 'neutral';
  }

  async calculateImportance(content: string): Promise<number> {
    try {
      // 使用 AI 评估内容重要性
      const response = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `你是一个内容价值评估专家。请根据以下标准评估文章的重要性（0-100分）：

1. 实用性（30分）：内容是否提供有用的信息、技能或见解
2. 独创性（25分）：内容是否独特、有新意，而非老生常谈
3. 深度（25分）：内容是否有深度分析，而非浅层描述
4. 时效性（20分）：内容是否具有时效价值或长期参考价值

请只返回一个0-100之间的数字分数，不要其他文字。`,
          },
          {
            role: 'user',
            content: `请评估以下文章的重要性：\n\n${content.slice(0, 3000)}`,
          },
        ],
        max_tokens: 10,
        temperature: 0.3,
      });

      const scoreText = response.choices[0]?.message?.content?.trim() || '50';
      const score = parseInt(scoreText, 10);

      // 确保分数在0-100之间
      if (isNaN(score)) {
        return 0.5; // 默认中等重要性
      }

      return Math.min(Math.max(score, 0), 100) / 100; // 转换为0-1范围
    } catch (error) {
      console.error('AI importance calculation failed, using fallback:', error);
      // 降级到简单算法
      const factors = {
        length: Math.min(content.length / 5000, 0.4), // 最高0.4分
        hasNumbers: /\d+/.test(content) ? 0.15 : 0,
        hasCode: /```|<code>/.test(content) ? 0.2 : 0,
        hasLinks: /\[.*?\]\(.*?\)/.test(content) ? 0.15 : 0,
      };

      let score = Object.values(factors).reduce((sum, val) => sum + val, 0);
      return Math.min(Math.max(score, 0.3), 0.9); // 最低0.3，最高0.9
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8191),
    });

    return {
      embedding: response.data[0].embedding,
      tokensUsed: response.usage.total_tokens,
    };
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages as any,
      max_tokens: options.max_tokens || this.config.maxTokens || 2000,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      response_format: options.response_format as any,
    });

    return {
      content: response.choices[0].message.content || '',
      tokensUsed: response.usage?.total_tokens,
    };
  }
}

/**
 * Anthropic提供商
 */
class AnthropicProvider extends AIProvider {
  private client: Anthropic;

  constructor(config: AIConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config.baseURL,
    });
  }

  async generateSummary(content: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: this.config.maxTokens || 500,
      temperature: this.config.temperature || 0.7,
      system: `你是一个专业的文章摘要助手。请用中文生成简洁的文章摘要，要求：
1. 3-5句话概括文章核心内容
2. 突出文章的关键信息和观点
3. 语言简洁明了，避免冗余
4. 如果文章是技术类，突出技术要点`,
      messages: [
        {
          role: 'user',
          content: `请为以下文章生成摘要：\n\n${content.slice(0, 8000)}`,
        },
      ],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  async extractKeywords(content: string): Promise<string[]> {
    const response = await this.client.messages.create({
      model: this.config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      temperature: 0.3,
      system: `请从文章中提取5-10个最重要的关键词，用逗号分隔。`,
      messages: [
        {
          role: 'user',
          content: `请提取关键词：\n\n${content.slice(0, 4000)}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return text.split(/[,，]/).map(k => k.trim()).filter(k => k.length > 0);
  }

  async categorize(content: string): Promise<string> {
    const categories = `AI/机器学习, 前端开发, 后端开发, 移动开发, 云计算/DevOps,
数据库, 网络安全, 区块链, 游戏, 产品设计, 创业/商业,
行业新闻, 技术趋势, 工具/资源, 教程/指南`;

    const response = await this.client.messages.create({
      model: this.config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 50,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `请将文章分类到以下类别之一：\n${categories}\n\n文章内容：\n${content.slice(0, 2000)}\n\n只返回类别名称。`,
        },
      ],
    });

    return response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  }

  async analyzeSentiment(content: string): Promise<'positive' | 'neutral' | 'negative'> {
    const response = await this.client.messages.create({
      model: this.config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 20,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: `分析文章的情感倾向，只返回以下三个词之一：positive、neutral、negative\n\n文章内容：\n${content.slice(0, 1000)}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim().toLowerCase() : '';
    if (text.includes('positive')) return 'positive';
    if (text.includes('negative')) return 'negative';
    return 'neutral';
  }

  async calculateImportance(content: string): Promise<number> {
    try {
      // 使用 AI 评估内容重要性（Anthropic API）
      const response = await this.client.messages.create({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        temperature: 0.3,
        system: `你是一个内容价值评估专家。请根据以下标准评估文章的重要性（0-100分）：

1. 实用性（30分）：内容是否提供有用的信息、技能或见解
2. 独创性（25分）：内容是否独特、有新意，而非老生常谈
3. 深度（25分）：内容是否有深度分析，而非浅层描述
4. 时效性（20分）：内容是否具有时效价值或长期参考价值

请只返回一个0-100之间的数字分数，不要其他文字。`,
        messages: [
          {
            role: 'user',
            content: `请评估以下文章的重要性：\n\n${content.slice(0, 3000)}`,
          },
        ],
      });

      const scoreText = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '50';
      const score = parseInt(scoreText, 10);

      // 确保分数在0-100之间
      if (isNaN(score)) {
        return 0.5; // 默认中等重要性
      }

      return Math.min(Math.max(score, 0), 100) / 100; // 转换为0-1范围
    } catch (error) {
      console.error('AI importance calculation failed, using fallback:', error);
      // 降级到简单算法
      const factors = {
        length: Math.min(content.length / 5000, 0.4), // 最高0.4分
        hasNumbers: /\d+/.test(content) ? 0.15 : 0,
        hasCode: /```|<code>/.test(content) ? 0.2 : 0,
        hasLinks: /\[.*?\]\(.*?\)/.test(content) ? 0.15 : 0,
      };

      let score = Object.values(factors).reduce((sum, val) => sum + val, 0);
      return Math.min(Math.max(score, 0.3), 0.9); // 最低0.3，最高0.9
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8191),
    });

    return {
      embedding: response.data[0].embedding,
      tokensUsed: response.usage.total_tokens,
    };
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await this.client.messages.create({
      model: options.model,
      max_tokens: options.max_tokens || this.config.maxTokens || 2000,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      system: options.messages.find(m => m.role === 'system')?.content,
      messages: options.messages.filter(m => m.role !== 'system') as any,
    });

    const content = response.content[0];
    return {
      content: content.type === 'text' ? content.text : '',
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
    };
  }
}

/**
 * DeepSeek提供商
 */
class DeepSeekProvider extends AIProvider {
  private client: OpenAI;

  constructor(config: AIConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.DEEPSEEK_API_KEY,
      baseURL: config.baseURL || 'https://api.deepseek.com',
    });
  }

  async generateSummary(content: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.config.model || 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的文章摘要助手。请用中文生成简洁的文章摘要，3-5句话概括核心内容。',
        },
        {
          role: 'user',
          content: `请为以下文章生成摘要：\n\n${content.slice(0, 8000)}`,
        },
      ],
      max_tokens: this.config.maxTokens || 500,
      temperature: this.config.temperature || 0.7,
    });

    return response.choices[0].message.content || '';
  }

  async extractKeywords(content: string): Promise<string[]> {
    const response = await this.client.chat.completions.create({
      model: this.config.model || 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '请从文章中提取5-10个最重要的关键词，用逗号分隔。',
        },
        {
          role: 'user',
          content: `请提取关键词：\n\n${content.slice(0, 4000)}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const text = response.choices[0].message.content || '';
    return text.split(/[,，]/).map(k => k.trim()).filter(k => k.length > 0);
  }

  async categorize(content: string): Promise<string> {
    const categories = `AI/机器学习, 前端开发, 后端开发, 移动开发, 云计算/DevOps, 数据库, 网络安全, 区块链, 游戏, 产品设计, 创业/商业, 行业新闻, 技术趋势, 工具/资源, 教程/指南`;

    const response = await this.client.chat.completions.create({
      model: this.config.model || 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: `请将文章分类到以下类别之一：${categories}\n\n文章内容：\n${content.slice(0, 2000)}`,
        },
      ],
      max_tokens: 50,
      temperature: 0.3,
    });

    return (response.choices[0].message.content || '').trim();
  }

  async analyzeSentiment(content: string): Promise<'positive' | 'neutral' | 'negative'> {
    const response = await this.client.chat.completions.create({
      model: this.config.model || 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: `分析文章的情感倾向，只返回以下三个词之一：positive、neutral、negative\n\n文章内容：\n${content.slice(0, 1000)}`,
        },
      ],
      max_tokens: 20,
      temperature: 0.1,
    });

    const sentiment = (response.choices[0].message.content || '').trim().toLowerCase();
    if (sentiment.includes('positive')) return 'positive';
    if (sentiment.includes('negative')) return 'negative';
    return 'neutral';
  }

  async calculateImportance(content: string): Promise<number> {
    try {
      // 使用 AI 评估内容重要性
      const response = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `你是一个内容价值评估专家。请根据以下标准评估文章的重要性（0-100分）：

1. 实用性（30分）：内容是否提供有用的信息、技能或见解
2. 独创性（25分）：内容是否独特、有新意，而非老生常谈
3. 深度（25分）：内容是否有深度分析，而非浅层描述
4. 时效性（20分）：内容是否具有时效价值或长期参考价值

请只返回一个0-100之间的数字分数，不要其他文字。`,
          },
          {
            role: 'user',
            content: `请评估以下文章的重要性：\n\n${content.slice(0, 3000)}`,
          },
        ],
        max_tokens: 10,
        temperature: 0.3,
      });

      const scoreText = response.choices[0]?.message?.content?.trim() || '50';
      const score = parseInt(scoreText, 10);

      // 确保分数在0-100之间
      if (isNaN(score)) {
        return 0.5; // 默认中等重要性
      }

      return Math.min(Math.max(score, 0), 100) / 100; // 转换为0-1范围
    } catch (error) {
      console.error('AI importance calculation failed, using fallback:', error);
      // 降级到简单算法
      const factors = {
        length: Math.min(content.length / 5000, 0.4), // 最高0.4分
        hasNumbers: /\d+/.test(content) ? 0.15 : 0,
        hasCode: /```|<code>/.test(content) ? 0.2 : 0,
        hasLinks: /\[.*?\]\(.*?\)/.test(content) ? 0.15 : 0,
      };

      let score = Object.values(factors).reduce((sum, val) => sum + val, 0);
      return Math.min(Math.max(score, 0.3), 0.9); // 最低0.3，最高0.9
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8191),
    });

    return {
      embedding: response.data[0].embedding,
      tokensUsed: response.usage.total_tokens,
    };
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages as any,
      max_tokens: options.max_tokens || this.config.maxTokens || 2000,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      response_format: options.response_format as any,
    });

    return {
      content: response.choices[0].message.content || '',
      tokensUsed: response.usage?.total_tokens,
    };
  }
}

/**
 * 验证 AI 配置
 */
function validateAIConfig(config: AIConfig): void {
  const getEnvKey = (provider: string): string | undefined => {
    switch (provider) {
      case 'openai': return process.env.OPENAI_API_KEY;
      case 'anthropic': return process.env.ANTHROPIC_API_KEY;
      case 'deepseek': return process.env.DEEPSEEK_API_KEY;
      case 'gemini': return process.env.GEMINI_API_KEY;
      default: return undefined;
    }
  };

  const envKey = getEnvKey(config.provider);
  const hasConfigKey = config.apiKey || envKey;

  // 对于需要 API key 的提供商，检查是否配置
  if (['openai', 'anthropic', 'deepseek', 'gemini', 'custom'].includes(config.provider)) {
    if (!hasConfigKey) {
      throw new Error(
        `AI provider '${config.provider}' requires an API key. ` +
        `Please set ${config.provider.toUpperCase()}_API_KEY environment variable ` +
        `or configure it in your user settings.`
      );
    }
  }
}

/**
 * AI服务工厂
 */
export function createAIProvider(config: AIConfig): AIProvider {
  // 验证配置
  validateAIConfig(config);

  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'deepseek':
      return new DeepSeekProvider(config);
    case 'ollama':
      return new OpenAIProvider({
        ...config,
        baseURL: config.baseURL || 'http://localhost:11434/v1',
        apiKey: 'ollama',
      });
    case 'custom':
      // 自定义 API（OpenAI 兼容格式）
      return new OpenAIProvider({
        ...config,
        baseURL: config.baseURL,
        apiKey: config.apiKey || 'custom',
      });
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

/**
 * AI服务便捷类
 */
export class AIService {
  private provider: AIProvider;

  constructor(config: AIConfig) {
    this.provider = createAIProvider(config);
  }

  async analyzeArticle(content: string, options: {
    summary?: boolean;
    keywords?: boolean;
    category?: boolean;
    sentiment?: boolean;
    importance?: boolean;
  } = {}): Promise<AIAnalysisResult> {
    const {
      summary = true,
      keywords = true,
      category = true,
      sentiment = false,
      importance = true,
    } = options;

    const result: AIAnalysisResult = {};
    const errors: string[] = [];

    try {
      if (summary) {
        result.summary = await this.provider.generateSummary(content);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Summary: ${message}`);
    }

    try {
      if (keywords) {
        result.keywords = await this.provider.extractKeywords(content);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Keywords: ${message}`);
    }

    try {
      if (category) {
        result.category = await this.provider.categorize(content);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Category: ${message}`);
    }

    try {
      if (sentiment) {
        result.sentiment = await this.provider.analyzeSentiment(content);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Sentiment: ${message}`);
    }

    try {
      if (importance) {
        result.importanceScore = await this.provider.calculateImportance(content);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Importance: ${message}`);
    }

    // 如果所有请求的分析都失败了，抛出错误
    const hasSuccessfulResult = Object.keys(result).length > 0;
    if (!hasSuccessfulResult) {
      throw new Error(`AI analysis failed: ${errors.join('; ')}`);
    }

    // 将错误信息附加到结果中
    if (errors.length > 0) {
      (result as any).partialErrors = errors;
    }

    return result;
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    return this.provider.generateEmbedding(text);
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    return this.provider.chat(options);
  }
}

/**
 * 默认AI服务实例
 */
export function getDefaultAIService(): AIService {
  const provider = (process.env.AI_PROVIDER || 'openai') as AIConfig['provider'];

  // 根据提供商获取默认模型
  const defaultModel = process.env.AI_MODEL || (
    provider === 'openai' ? 'gpt-4o' :
    provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' :
    provider === 'deepseek' ? 'deepseek-chat' :
    provider === 'ollama' ? 'llama3' :
    provider === 'custom' ? process.env.CUSTOM_API_MODEL || 'gpt-3.5-turbo' :
    'gpt-4o'
  );

  // 自定义 API 配置
  if (provider === 'custom') {
    const config: AIConfig = {
      provider: 'custom',
      model: process.env.CUSTOM_API_MODEL || defaultModel,
      apiKey: process.env.CUSTOM_API_KEY,
      baseURL: process.env.CUSTOM_API_BASE_URL,
      maxTokens: 2000,
      temperature: 0.7,
    };
    // 验证配置会在这里自动执行
    return new AIService(config);
  }

  const config: AIConfig = {
    provider,
    model: defaultModel,
    maxTokens: 2000,
    temperature: 0.7,
  };

  // 验证配置会在这里自动执行
  return new AIService(config);
}

export * from './client';
