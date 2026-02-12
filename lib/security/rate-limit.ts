/**
 * 速率限制器
 * 使用内存存储的简单速率限制实现
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * 速率限制器类
 */
export class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // 每 60 秒清理一次过期条目
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * 检查是否允许请求
   * @param identifier - 唯一标识符（如 IP 地址或用户 ID）
   * @returns 是否允许请求
   */
  async check(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    // 如果没有条目或已过期，创建新条目
    if (!entry || now > entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.windowMs,
      };

      this.requests.set(identifier, newEntry);

      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    // 检查是否超过限制
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // 增加计数
    entry.count++;
    this.requests.set(identifier, entry);

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * 重置特定标识符的限制
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * 清理过期的条目
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * 清除所有条目
   */
  clear(): void {
    this.requests.clear();
  }
}

/**
 * 预定义的速率限制器
 */

// 登录 API：10 次/10 分钟
export const loginRateLimiter = new RateLimiter(10, 10 * 60 * 1000);

// 注册 API：5 次/小时
export const registerRateLimiter = new RateLimiter(5, 60 * 60 * 1000);

// 密码重置 API：3 次/小时
export const passwordResetRateLimiter = new RateLimiter(3, 60 * 60 * 1000);

// 通用 API：100 次/分钟
export const generalApiRateLimiter = new RateLimiter(100, 60 * 1000);

/**
 * 从请求中获取客户端标识符
 */
export function getClientIdentifier(request: Request): string {
  // 尝试从各种头部获取真实 IP
  const headers = (request as any).headers;

  const forwardedFor = headers?.get('x-forwarded-for');
  const realIp = headers?.get('x-real-ip');
  const cfConnectingIp = headers?.get('cf-connecting-ip');

  const ip = forwardedFor?.split(',')[0]?.trim() ||
              realIp ||
              cfConnectingIp ||
              'unknown';

  return ip;
}

/**
 * 速率限制辅助函数
 * 返回速率限制错误响应
 */
export function rateLimitResponse(resetTime: number): Response {
  const resetDate = new Date(resetTime);
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: '请求过于频繁，请稍后再试',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': resetDate.toISOString(),
      },
    }
  );
}
