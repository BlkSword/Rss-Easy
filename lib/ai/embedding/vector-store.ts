/**
 * 向量存储接口
 *
 * 用于存储和检索文章向量，支持相似度搜索
 */

import type { WorkflowContext } from '../workflow/types';

export interface VectorStoreConfig {
  dimension: number;
  metric: 'cosine' | 'l2' | 'innerproduct';
}

export interface VectorSearchResult {
  entryId: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export interface VectorStore {
  /**
   * 存储向量
   */
  store(
    entryId: string,
    vector: number[],
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * 批量存储向量
   */
  storeBatch(items: Array<{
    entryId: string;
    vector: number[];
    metadata?: Record<string, any>;
  }>): Promise<void>;

  /**
   * 获取向量
   */
  get(entryId: string): Promise<number[] | null>;

  /**
   * 搜索相似向量
   */
  search(
    vector: number[],
    limit: number,
    threshold?: number
  ): Promise<VectorSearchResult[]>;

  /**
   * 删除向量
   */
  delete(entryId: string): Promise<void>;

  /**
   * 获取配置
   */
  getConfig(): VectorStoreConfig;
}

/**
 * 向量存储基类
 */
export abstract class BaseVectorStore implements VectorStore {
  protected config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  abstract store(
    entryId: string,
    vector: number[],
    metadata?: Record<string, any>
  ): Promise<void>;

  abstract storeBatch(
    items: Array<{
      entryId: string;
      vector: number[];
      metadata?: Record<string, any>;
    }>
  ): Promise<void>;

  abstract get(entryId: string): Promise<number[] | null>;

  abstract search(
    vector: number[],
    limit: number,
    threshold?: number
  ): Promise<VectorSearchResult[]>;

  abstract delete(entryId: string): Promise<void>;

  getConfig(): VectorStoreConfig {
    return this.config;
  }

  /**
   * 计算余弦相似度
   */
  protected cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 计算 L2 距离
   */
  protected l2Distance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * 计算内积
   */
  protected innerProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let product = 0;
    for (let i = 0; i < a.length; i++) {
      product += a[i] * b[i];
    }

    return product;
  }

  /**
   * 根据配置计算相似度/距离
   */
  protected calculateSimilarity(a: number[], b: number[]): number {
    switch (this.config.metric) {
      case 'cosine':
        return this.cosineSimilarity(a, b);
      case 'l2':
        // L2 距离转换为相似度：1 / (1 + distance)
        return 1 / (1 + this.l2Distance(a, b));
      case 'innerproduct':
        return this.innerProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }
}

/**
 * 向量存储工厂
 */
export function createVectorStore(type: 'memory' | 'pgvector', config?: any): VectorStore {
  switch (type) {
    case 'memory':
      const { MemoryVectorStore } = require('./memory-vector-store');
      return new MemoryVectorStore(config);
    case 'pgvector':
      const { PgVectorStore } = require('./pgvector-store');
      return new PgVectorStore(config);
    default:
      throw new Error(`Unknown vector store type: ${type}`);
  }
}

/**
 * 默认向量存储实例
 */
let defaultVectorStore: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!defaultVectorStore) {
    // 根据环境变量选择存储类型
    const type = (process.env.VECTOR_STORE_TYPE || 'memory') as 'memory' | 'pgvector';
    defaultVectorStore = createVectorStore(type, {
      dimension: 1536, // OpenAI text-embedding-3-small 维度
      metric: 'cosine',
    });
  }

  return defaultVectorStore;
}

export function setVectorStore(store: VectorStore): void {
  defaultVectorStore = store;
}
