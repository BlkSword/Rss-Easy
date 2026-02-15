/**
 * 通用工具函数
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并Tailwind CSS类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化日期
 */
export function formatDate(date: Date | string | null, locale: string = 'zh-CN'): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(date: Date | string | null, locale: string = 'zh-CN'): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 31536000) {
    return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
  }
}

/**
 * 计算阅读时间
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * 截断文本
 */
export function truncate(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * 生成内容哈希
 */
export async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 安全的JSON解析
 */
export function safeJsonParse<T = unknown>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * 延迟函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        await sleep(delay * Math.pow(backoff, attempt));
      }
    }
  }

  throw lastError;
}

/**
 * 批量处理
 */
export async function batch<T, R>(
  items: T[],
  batchSize: number,
  fn: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await fn(batch)));
  }

  return results;
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * SSRF 防护：检查 URL 是否安全
 * 阻止访问内网地址和敏感端点
 */
export function isUrlSafe(urlString: string): { safe: boolean; reason?: string } {
  try {
    const url = new URL(urlString);

    // 只允许 http 和 https 协议
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { safe: false, reason: '只允许 HTTP 和 HTTPS 协议' };
    }

    const hostname = url.hostname.toLowerCase();

    // 阻止 localhost 和相关变体
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.startsWith('127.') ||
        hostname === '0:0:0:0:0:0:0:1') {
      return { safe: false, reason: '不允许访问本地地址' };
    }

    // 阻止内网 IP 地址
    // 10.0.0.0/8
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { safe: false, reason: '不允许访问内网地址 (10.x.x.x)' };
    }

    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { safe: false, reason: '不允许访问内网地址 (172.16-31.x.x)' };
    }

    // 192.168.0.0/16
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { safe: false, reason: '不允许访问内网地址 (192.168.x.x)' };
    }

    // 169.254.0.0/16 (链路本地地址，包括云元数据服务)
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { safe: false, reason: '不允许访问链路本地地址' };
    }

    // 224.0.0.0/4 (组播地址)
    if (/^2[2-3][4-9]\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { safe: false, reason: '不允许访问组播地址' };
    }

    // 240.0.0.0/4 (保留地址)
    if (/^2[4-5][0-5]\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { safe: false, reason: '不允许访问保留地址' };
    }

    // 阻止以 .internal, .local, .localhost 结尾的域名
    if (hostname.endsWith('.internal') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.localdomain')) {
      return { safe: false, reason: '不允许访问内部域名' };
    }

    // 阻止云元数据服务域名
    if (hostname === 'metadata.google.internal' ||
        hostname === 'metadata.azure.com' ||
        hostname === '169.254.169.254') {
      return { safe: false, reason: '不允许访问云元数据服务' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: '无效的 URL 格式' };
  }
}

/**
 * SSRF 防护：验证并返回安全的 URL
 * 如果 URL 不安全则抛出错误
 */
export function validateUrlForSsrf(url: string): void {
  const result = isUrlSafe(url);
  if (!result.safe) {
    throw new Error(`URL 安全验证失败: ${result.reason}`);
  }
}
