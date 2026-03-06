/**
 * 全局请求控制器
 *
 * 解决问题：
 * 1. OPML 导入后大量并发请求导致网络过载
 * 2. 目标服务器触发反爬保护 (429/403)
 * 3. DNS 解析拥塞和连接池耗尽
 */

import { info, warn } from '@/lib/logger';

/**
 * 请求配置
 */
interface RequestControllerConfig {
  /** 最大并发数 */
  maxConcurrent: number;
  /** 每秒最大请求数 (0 表示不限制) */
  requestsPerSecond: number;
  /** 请求超时时间 (ms) */
  timeout: number;
  /** 失败重试次数 */
  maxRetries: number;
  /** 重试延迟基数 (ms) */
  retryDelayBase: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: RequestControllerConfig = {
  maxConcurrent: parseInt(process.env.RSS_MAX_CONCURRENT || '5', 10),
  requestsPerSecond: parseInt(process.env.RSS_REQUESTS_PER_SECOND || '3', 10),
  timeout: 30000,
  maxRetries: 2,
  retryDelayBase: 1000,
};

/**
 * 全局请求控制器
 */
class RequestController {
  private config: RequestControllerConfig;
  private activeRequests = 0;
  private queue: Array<() => void> = [];
  private requestTimestamps: number[] = [];
  private totalRequests = 0;
  private failedRequests = 0;
  private lastLogTime = 0;

  constructor(config: Partial<RequestControllerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RequestControllerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): RequestControllerConfig {
    return { ...this.config };
  }

  /**
   * 执行受控请求
   */
  async execute<T>(
    requestFn: () => Promise<T>,
    context?: { url?: string; feedId?: string }
  ): Promise<T> {
    // 等待获取执行槽
    await this.acquireSlot();

    try {
      this.activeRequests++;
      this.totalRequests++;

      // 速率限制
      await this.waitForRateLimit();

      // 执行请求（带重试）
      const result = await this.executeWithRetry(requestFn, context);

      return result;
    } finally {
      this.activeRequests--;
      this.releaseSlot();
      this.logStats();
    }
  }

  /**
   * 获取执行槽（并发控制）
   */
  private async acquireSlot(): Promise<void> {
    if (this.activeRequests < this.config.maxConcurrent) {
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * 释放执行槽
   */
  private releaseSlot(): void {
    const next = this.queue.shift();
    if (next) {
      // 延迟释放，避免瞬间并发
      setTimeout(next, 100);
    }
  }

  /**
   * 等待速率限制
   */
  private async waitForRateLimit(): Promise<void> {
    if (this.config.requestsPerSecond <= 0) {
      return;
    }

    const now = Date.now();
    const windowStart = now - 1000;

    // 清理过期的时间戳
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > windowStart);

    // 如果当前窗口内请求数已达上限，等待
    if (this.requestTimestamps.length >= this.config.requestsPerSecond) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitTime = oldestInWindow + 1000 - now + 50; // 额外 50ms 缓冲

      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }

    this.requestTimestamps.push(Date.now());
  }

  /**
   * 带重试的请求执行
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    context?: { url?: string; feedId?: string }
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;

        // 检查是否应该重试
        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }

        // 计算重试延迟（指数退避）
        const delay = this.config.retryDelayBase * Math.pow(2, attempt);
        const url = context?.url || 'unknown';

        await warn('rss', `请求失败，准备重试`, {
          url: url.slice(0, 100),
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries,
          delay,
          error: error.message?.slice(0, 200),
        });

        await this.sleep(delay);
      }
    }

    this.failedRequests++;
    throw lastError;
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    // 不重试的错误类型
    const noRetryCodes = [400, 401, 403, 404, 410];
    if (error.response?.status && noRetryCodes.includes(error.response.status)) {
      return false;
    }

    // 可重试的错误类型
    const retryCodes = [429, 500, 502, 503, 504];
    if (error.response?.status && retryCodes.includes(error.response.status)) {
      return true;
    }

    // 网络错误重试
    const retryErrors = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'];
    if (error.code && retryErrors.includes(error.code)) {
      return true;
    }

    // 超时错误重试
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      return true;
    }

    return false;
  }

  /**
   * 记录统计信息
   */
  private logStats(): void {
    const now = Date.now();
    // 每 30 秒记录一次
    if (now - this.lastLogTime < 30000) {
      return;
    }

    this.lastLogTime = now;

    if (this.totalRequests > 0) {
      info('rss', '请求控制器统计', {
        totalRequests: this.totalRequests,
        failedRequests: this.failedRequests,
        activeRequests: this.activeRequests,
        queuedRequests: this.queue.length,
        maxConcurrent: this.config.maxConcurrent,
        requestsPerSecond: this.config.requestsPerSecond,
      });
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      config: this.config,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.totalRequests = 0;
    this.failedRequests = 0;
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 全局单例
let globalController: RequestController | null = null;

/**
 * 获取全局请求控制器
 */
export function getRequestController(): RequestController {
  if (!globalController) {
    globalController = new RequestController();
  }
  return globalController;
}

/**
 * 更新全局请求控制器配置
 */
export function updateRequestControllerConfig(
  config: Partial<RequestControllerConfig>
): void {
  getRequestController().updateConfig(config);
}

/**
 * 执行受控请求的便捷方法
 */
export async function controlledRequest<T>(
  requestFn: () => Promise<T>,
  context?: { url?: string; feedId?: string }
): Promise<T> {
  return getRequestController().execute(requestFn, context);
}

export { RequestController, type RequestControllerConfig };
