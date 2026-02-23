/**
 * Redis 分布式速率限制器
 *
 * 用于防止 API 滥用和暴力破解攻击
 * - 登录/注册速率限制
 * - API 通用速率限制
 * - 支持 Redis 降级（Redis 故障时允许请求通过）
 */

import Redis from 'ioredis';

// 速率限制配置
interface RateLimitConfig {
  windowMs: number;      // 时间窗口（毫秒）
  maxRequests: number;   // 窗口内最大请求数
  keyPrefix: string;     // Redis 键前缀
  skipOnFailure: boolean; // Redis 故障时是否允许请求
}

// 预定义的速率限制器配置
const RATE_LIMIT_CONFIGS = {
  // 登录：每 15 分钟最多 30 次
  login: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'ratelimit:login:',
    skipOnFailure: true,
  },
  // 注册：每小时最多 20 次
  register: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'ratelimit:register:',
    skipOnFailure: true,
  },
  // 通用 API：每分钟最多 100 次
  general: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'ratelimit:general:',
    skipOnFailure: true,
  },
  // 密码重置：每小时最多 3 次
  passwordReset: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    keyPrefix: 'ratelimit:pwdreset:',
    skipOnFailure: true,
  },
} as const;

// Redis 客户端实例（复用）
let redisClient: Redis | null = null;
let isConnecting = false;

/**
 * 获取 Redis 客户端（懒加载单例）
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

    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.error('[RateLimiter] Max retries reached');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });
    } else {
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.error('[RateLimiter] Max retries reached');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });
    }

    redisClient.on('error', (err) => {
      console.error('[RateLimiter] Connection error:', err);
    });

    redisClient.on('close', () => {
      console.warn('[RateLimiter] Connection closed');
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    console.error('[RateLimiter] Failed to connect:', error);
    redisClient = null;
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * 速率限制结果
 */
export interface RateLimitResult {
  allowed: boolean;        // 是否允许请求
  remaining: number;       // 剩余请求数
  resetAt: Date;           // 重置时间
  retryAfter?: number;     // 重试等待秒数（如果不允许）
}

/**
 * 检查速率限制（滑动窗口算法）
 */
async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const client = await getRedisClient();

  // Redis 不可用时的降级处理
  if (!client) {
    if (config.skipOnFailure) {
      // 允许请求通过，避免服务完全不可用
      console.warn('[RateLimiter] Redis unavailable, allowing request');
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowMs),
      };
    }
    // 拒绝请求
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + config.windowMs),
      retryAfter: Math.ceil(config.windowMs / 1000),
    };
  }

  const key = `${config.keyPrefix}${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // 使用 Lua 脚本实现原子性操作
    const luaScript = `
      local key = KEYS[1]
      local window_start = tonumber(ARGV[1])
      local window_ms = tonumber(ARGV[2])
      local max_requests = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])

      -- 移除过期的请求记录
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

      -- 获取当前窗口内的请求数
      local current = redis.call('ZCARD', key)

      if current < max_requests then
        -- 添加当前请求
        redis.call('ZADD', key, now, now .. '-' .. math.random())
        -- 设置过期时间
        redis.call('PEXPIRE', key, window_ms)
        return {1, max_requests - current - 1, now + window_ms}
      else
        -- 获取最早请求的时间，计算重试等待时间
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local oldest_time = tonumber(oldest[2]) or now
        return {0, 0, oldest_time + window_ms}
      end
    `;

    const result = await client.eval(
      luaScript,
      1,
      key,
      windowStart.toString(),
      config.windowMs.toString(),
      config.maxRequests.toString(),
      now.toString()
    ) as [number, number, number];

    const allowed = result[0] === 1;
    const remaining = result[1];
    const resetAt = new Date(result[2]);

    return {
      allowed,
      remaining: Math.max(0, remaining),
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil((resetAt.getTime() - now) / 1000),
    };
  } catch (error) {
    console.error('[RateLimiter] Check error:', error);

    if (config.skipOnFailure) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowMs),
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + config.windowMs),
      retryAfter: Math.ceil(config.windowMs / 1000),
    };
  }
}

/**
 * 重置速率限制
 */
async function resetRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  const key = `${config.keyPrefix}${identifier}`;
  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error('[RateLimiter] Reset error:', error);
    return false;
  }
}

/**
 * 创建速率限制器
 */
function createRateLimiter(type: keyof typeof RATE_LIMIT_CONFIGS) {
  const config = RATE_LIMIT_CONFIGS[type];

  return {
    /**
     * 检查速率限制
     * @param identifier 唯一标识符（IP 地址或用户 ID）
     */
    check: (identifier: string): Promise<RateLimitResult> =>
      checkRateLimit(identifier, config),

    /**
     * 重置速率限制
     * @param identifier 唯一标识符
     */
    reset: (identifier: string): Promise<boolean> =>
      resetRateLimit(identifier, config),

    /**
     * 获取配置
     */
    getConfig: () => ({ ...config }),
  };
}

// 导出预定义的速率限制器
export const loginRateLimiter = createRateLimiter('login');
export const registerRateLimiter = createRateLimiter('register');
export const generalRateLimiter = createRateLimiter('general');
export const passwordResetRateLimiter = createRateLimiter('passwordReset');

/**
 * 获取客户端标识符
 * 优先使用用户 ID，其次使用 IP 地址
 */
export function getClientIdentifier(
  userId?: string | null,
  ip?: string | null
): string {
  if (userId) {
    return `user:${userId}`;
  }
  if (ip) {
    return `ip:${ip}`;
  }
  return 'anonymous';
}

/**
 * 关闭 Redis 连接
 */
export async function closeRateLimiterConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export type { RateLimitConfig };
