/**
 * 内存向量存储
 *
 * 简单的内存实现，适合开发和测试
 */

import { BaseVectorStore, type VectorSearchResult } from './vector-store';

interface StoredVector {
  vector: number[];
  metadata?: Record<string, any>;
}

export class MemoryVectorStore extends BaseVectorStore {
  private vectors: Map<string, StoredVector> = new Map();

  async store(
    entryId: string,
    vector: number[],
    metadata?: Record<string, any>
  ): Promise<void> {
    // 验证维度
    if (vector.length !== this.config.dimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.config.dimension}, got ${vector.length}`
      );
    }

    this.vectors.set(entryId, { vector, metadata });
  }

  async storeBatch(
    items: Array<{
      entryId: string;
      vector: number[];
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    for (const item of items) {
      await this.store(item.entryId, item.vector, item.metadata);
    }
  }

  async get(entryId: string): Promise<number[] | null> {
    const stored = this.vectors.get(entryId);
    return stored?.vector || null;
  }

  async search(
    vector: number[],
    limit: number,
    threshold?: number
  ): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const [entryId, stored] of this.vectors.entries()) {
      const similarity = this.calculateSimilarity(vector, stored.vector);

      // 应用阈值过滤
      if (threshold !== undefined && similarity < threshold) {
        continue;
      }

      results.push({
        entryId,
        similarity,
        metadata: stored.metadata,
      });
    }

    // 按相似度降序排序
    results.sort((a, b) => b.similarity - a.similarity);

    // 返回前 N 个结果
    return results.slice(0, limit);
  }

  async delete(entryId: string): Promise<void> {
    this.vectors.delete(entryId);
  }

  /**
   * 获取存储的向量数量
   */
  size(): number {
    return this.vectors.size;
  }

  /**
   * 清空所有向量
   */
  clear(): void {
    this.vectors.clear();
  }
}
