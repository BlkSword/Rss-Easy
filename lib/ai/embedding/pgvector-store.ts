/**
 * pgvector 向量存储
 *
 * 使用 PostgreSQL 的 pgvector 扩展进行向量存储和相似度搜索
 */

import { db } from '@/lib/db';
import { BaseVectorStore, type VectorSearchResult } from './vector-store';

export class PgVectorStore extends BaseVectorStore {
  /**
   * 初始化 pgvector 扩展
   */
  static async initialize(): Promise<void> {
    try {
      // 启用 pgvector 扩展
      await db.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('✓ pgvector 扩展已启用');
    } catch (error) {
      console.error('启用 pgvector 扩展失败:', error);
      throw error;
    }
  }

  /**
   * 存储向量（存储在 Entry 表的 contentEmbedding 字段）
   */
  async store(
    entryId: string,
    vector: number[],
    metadata?: Record<string, any>
  ): Promise<void> {
    // 将数组转换为字节流（pgvector 格式）
    const vectorBytes = this.arrayToBytes(vector);

    try {
      await db.entry.update({
        where: { id: entryId },
        data: {
          contentEmbedding: Buffer.from(vectorBytes),
        },
      });
    } catch (error) {
      console.error(`存储向量失败 (entryId: ${entryId}):`, error);
      throw error;
    }
  }

  /**
   * 批量存储向量
   */
  async storeBatch(
    items: Array<{
      entryId: string;
      vector: number[];
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    // pgvector 不支持批量更新，逐个处理
    for (const item of items) {
      await this.store(item.entryId, item.vector, item.metadata);
    }
  }

  /**
   * 获取向量
   */
  async get(entryId: string): Promise<number[] | null> {
    const entry = await db.entry.findUnique({
      where: { id: entryId },
      select: { contentEmbedding: true },
    });

    if (!entry?.contentEmbedding) {
      return null;
    }

    return this.bytesToArray(entry.contentEmbedding);
  }

  /**
   * 搜索相似向量
   *
   * 使用 pgvector 的 <=> 操作符进行相似度搜索
   */
  async search(
    vector: number[],
    limit: number,
    threshold?: number
  ): Promise<VectorSearchResult[]> {
    const vectorBytes = this.arrayToBytes(vector);

    try {
      // 构建查询：使用余弦距离搜索
      // 注意：pgvector 使用余弦距离（1 - 余弦相似度）
      const query = `
        SELECT
          id as "entryId",
          1 - (content_embedding <=> $1::vector) as similarity
        FROM entries
        WHERE content_embedding IS NOT NULL
        ORDER BY content_embedding <=> $1::vector
        LIMIT $2
      `;

      const results = await db.$queryRawUnsafe<Array<{ entryId: string; similarity: number }>>(
        query,
        Buffer.from(vectorBytes),
        limit
      );

      // 应用阈值过滤
      const filtered = threshold !== undefined
        ? results.filter(r => r.similarity >= threshold)
        : results;

      return filtered.map(r => ({
        entryId: r.entryId,
        similarity: r.similarity,
      }));
    } catch (error) {
      console.error('向量搜索失败:', error);
      return [];
    }
  }

  /**
   * 删除向量
   */
  async delete(entryId: string): Promise<void> {
    // 注意：这只是清除向量字段，不删除文章本身
    await db.entry.update({
      where: { id: entryId },
      data: {
        contentEmbedding: null,
      },
    });
  }

  /**
   * 将数字数组转换为 pgvector 字节格式
   */
  private arrayToBytes(vector: number[]): Uint8Array {
    const buffer = new Float32Array(vector);
    return new Uint8Array(buffer.buffer);
  }

  /**
   * 将 pgvector 字节格式转换为数字数组
   */
  private bytesToArray(bytes: Buffer | Uint8Array): number[] {
    const buffer = bytes instanceof Buffer ? bytes : Buffer.from(bytes);
    const float32Array = new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.length / Float32Array.BYTES_PER_ELEMENT
    );
    return Array.from(float32Array);
  }

  /**
   * 检查 pgvector 是否可用
   */
  static async checkAvailable(): Promise<boolean> {
    try {
      const result = await db.$queryRawUnsafe<Array<{ available: boolean }>>(
        `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') as available`
      );
      return result[0]?.available || false;
    } catch {
      return false;
    }
  }
}
