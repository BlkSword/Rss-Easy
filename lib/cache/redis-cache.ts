/**
 * Redis 缓存服务
 *
 * 用于缓存热点数据，减轻数据库压力
 * - Feed 列表
 * - 分类列表
 * - 全局统计
 * - 用户会话数据
 */

import Redis from 'ioredis';

// 缓存配置
const CACHE_CONFIG = {
  // 默认 TTL（秒）
  defaultTTL: 300, // 5 分钟
  // 随机 TTL 偏移范围（防止缓存雪崩）
  ttlJitter: 30, // ±30 秒
  // 键前缀
  keyPrefix: 'rss-easy:',
};

// Redis 客户端实例（懒加载）
let redisClient: Redis | null = null;
let isConnecting = false;

/**
 * 获取 Redis 客户端
 */
async function getRedisClient(): Promise<Redis | null> {
  if (redisClient) {
    return redisClient;
  }

  if (isConnecting) {
    // 等待连接完成
    await new Promise(resolve => setTimeout(resolve, 100));
    return getRedisClient();
  }

  try {
    isConnecting = true;

    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('[Redis Cache] Max retries reached');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    redisClient.on('error', (err) => {
      console.error('[Redis Cache] Connection error:', err);
    });

    redisClient.on('close', () => {
      console.warn('[Redis Cache] Connection closed');
      redisClient = null;
    });

    console.log('[Redis Cache] Connected successfully');
    return redisClient;
  } catch (error) {
    console.error('[Redis Cache] Failed to connect:', error);
    redisClient = null;
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * 计算带随机偏移的 TTL
 */
function calculateTTL(baseTTL?: number): number {
  const ttl = baseTTL ?? CACHE_CONFIG.defaultTTL;
  const jitter = Math.floor(Math.random() * CACHE_CONFIG.ttlJitter * 2) - CACHE_CONFIG.ttlJitter;
  return Math.max(ttl + jitter, 60); // 最少 60 秒
}

/**
 * 构建缓存键
 */
function buildKey(key: string): string {
  return `${CACHE_CONFIG.keyPrefix}${key}`;
}

/**
 * 缓存服务
 */
export const CacheService = {
  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return null;
      }

      const fullKey = buildKey(key);
      const data = await client.get(fullKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`[Redis Cache] Get error for key "${key}":`, error);
      return null;
    }
  },

  /**
   * 设置缓存
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      const fullKey = buildKey(key);
      const data = JSON.stringify(value);
      const actualTTL = calculateTTL(ttl);

      await client.setex(fullKey, actualTTL, data);
      return true;
    } catch (error) {
      console.error(`[Redis Cache] Set error for key "${key}":`, error);
      return false;
    }
  },

  /**
   * 获取或设置缓存（缓存穿透保护）
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // 先尝试从缓存获取
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，执行工厂函数获取数据
    const value = await factory();

    // 异步设置缓存，不阻塞返回
    this.set(key, value, ttl).catch(err => {
      console.error(`[Redis Cache] Background set error for key "${key}":`, err);
    });

    return value;
  },

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      const fullKey = buildKey(key);
      await client.del(fullKey);
      return true;
    } catch (error) {
      console.error(`[Redis Cache] Delete error for key "${key}":`, error);
      return false;
    }
  },

  /**
   * 批量删除缓存（按模式）
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return 0;
      }

      const fullPattern = buildKey(pattern);
      const keys = await client.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      await client.del(keys);
      return keys.length;
    } catch (error) {
      console.error(`[Redis Cache] Delete pattern error for "${pattern}":`, error);
      return 0;
    }
  },

  /**
   * 使缓存失效（针对用户）
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await Promise.all([
      this.delete(`user:${userId}:feeds`),
      this.delete(`user:${userId}:categories`),
      this.delete(`user:${userId}:stats`),
      this.delete(`user:${userId}:preferences`),
    ]);
  },

  /**
   * 使全局缓存失效
   */
  async invalidateGlobalCache(): Promise<void> {
    await this.deletePattern('global:*');
  },

  /**
   * 检查 Redis 连接状态
   */
  async isConnected(): Promise<boolean> {
    const client = await getRedisClient();
    return client !== null;
  },

  /**
   * 关闭 Redis 连接
   */
  async disconnect(): Promise<void> {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
  },
};

/**
 * 缓存键生成器
 */
export const CacheKeys = {
  // 用户相关
  userFeeds: (userId: string) => `user:${userId}:feeds`,
  userCategories: (userId: string) => `user:${userId}:categories`,
  userStats: (userId: string) => `user:${userId}:stats`,
  userPreferences: (userId: string) => `user:${userId}:preferences`,

  // 全局统计
  globalStats: () => 'global:stats',
  feedStats: (feedId: string) => `feed:${feedId}:stats`,

  // 文章相关
  entryCache: (entryId: string) => `entry:${entryId}`,
  feedEntries: (feedId: string, page: number) => `feed:${feedId}:entries:${page}`,

  // AI 相关
  aiEmbedding: (contentHash: string) => `ai:embedding:${contentHash}`,
  aiAnalysis: (entryId: string) => `ai:analysis:${entryId}`,
};

/**
 * 缓存 TTL 常量（秒）
 */
export const CacheTTL = {
  SHORT: 60,         // 1 分钟
  MEDIUM: 300,       // 5 分钟
  LONG: 900,         // 15 分钟
  VERY_LONG: 3600,   // 1 小时
  DAY: 86400,        // 1 天
};

export default CacheService;
