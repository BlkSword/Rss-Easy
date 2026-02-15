/**
 * AI 嵌入向量缓存服务
 *
 * 基于内容哈希缓存嵌入向量结果，避免重复调用 API
 */

import { createHash } from 'crypto';
import { CacheService, CacheKeys, CacheTTL } from '@/lib/cache/redis-cache';
import type { EmbeddingResult } from './client';

// 内存缓存（用于 Redis 不可用时的降级方案）
const memoryCache = new Map<string, { value: EmbeddingResult; expiresAt: number }>();

// 内存缓存最大条目数
const MAX_MEMORY_CACHE_SIZE = 1000;

// 内存缓存默认 TTL（毫秒）
const MEMORY_CACHE_TTL = 15 * 60 * 1000; // 15 分钟

/**
 * 生成内容哈希
 */
function generateContentHash(text: string): string {
  // 标准化文本：去除多余空格、统一换行符
  const normalizedText = text.trim().replace(/\s+/g, ' ').slice(0, 8191);
  return createHash('sha256').update(normalizedText).digest('hex').slice(0, 32);
}

/**
 * 清理过期的内存缓存
 */
function cleanupMemoryCache(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt < now) {
      memoryCache.delete(key);
    }
  }

  // 如果缓存过大，删除最旧的条目
  if (memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
    const entriesToDelete = memoryCache.size - MAX_MEMORY_CACHE_SIZE;
    const keys = Array.from(memoryCache.keys()).slice(0, entriesToDelete);
    for (const key of keys) {
      memoryCache.delete(key);
    }
  }
}

/**
 * 嵌入向量缓存服务
 */
export const EmbeddingCache = {
  /**
   * 获取缓存的嵌入向量
   */
  async get(text: string): Promise<EmbeddingResult | null> {
    const contentHash = generateContentHash(text);
    const cacheKey = CacheKeys.aiEmbedding(contentHash);

    try {
      // 先尝试从 Redis 获取
      const cached = await CacheService.get<EmbeddingResult>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn('[Embedding Cache] Redis get failed, falling back to memory cache:', error);
    }

    // Redis 不可用或缓存未命中，尝试从内存缓存获取
    const memoryEntry = memoryCache.get(cacheKey);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      return memoryEntry.value;
    }

    return null;
  },

  /**
   * 缓存嵌入向量
   */
  async set(text: string, result: EmbeddingResult): Promise<void> {
    const contentHash = generateContentHash(text);
    const cacheKey = CacheKeys.aiEmbedding(contentHash);

    try {
      // 尝试写入 Redis
      await CacheService.set(cacheKey, result, CacheTTL.LONG);
    } catch (error) {
      console.warn('[Embedding Cache] Redis set failed, falling back to memory cache:', error);
    }

    // 同时写入内存缓存（作为备份）
    memoryCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + MEMORY_CACHE_TTL,
    });

    // 定期清理内存缓存
    if (memoryCache.size % 100 === 0) {
      cleanupMemoryCache();
    }
  },

  /**
   * 获取或计算嵌入向量（自动缓存）
   */
  async getOrCompute(
    text: string,
    compute: () => Promise<EmbeddingResult>
  ): Promise<EmbeddingResult> {
    // 先尝试从缓存获取
    const cached = await this.get(text);
    if (cached) {
      return cached;
    }

    // 缓存未命中，执行计算
    const result = await compute();

    // 异步缓存结果
    this.set(text, result).catch(err => {
      console.error('[Embedding Cache] Background set error:', err);
    });

    return result;
  },

  /**
   * 删除缓存的嵌入向量
   */
  async delete(text: string): Promise<void> {
    const contentHash = generateContentHash(text);
    const cacheKey = CacheKeys.aiEmbedding(contentHash);

    await CacheService.delete(cacheKey);
    memoryCache.delete(cacheKey);
  },

  /**
   * 清除所有嵌入向量缓存
   */
  async clearAll(): Promise<void> {
    await CacheService.deletePattern('ai:embedding:*');
    memoryCache.clear();
  },

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    memoryCacheSize: number;
    maxMemoryCacheSize: number;
  } {
    return {
      memoryCacheSize: memoryCache.size,
      maxMemoryCacheSize: MAX_MEMORY_CACHE_SIZE,
    };
  },
};

export default EmbeddingCache;
