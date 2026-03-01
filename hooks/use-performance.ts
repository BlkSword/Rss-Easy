/**
 * 性能监控工具
 * 用于追踪和分析应用性能
 */

'use client';

import { useRef, useEffect, useCallback } from 'react';

// ========== 类型定义 ==========

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes';
  timestamp: number;
}

interface ComponentMetrics {
  renderCount: number;
  totalRenderTime: number;
  avgRenderTime: number;
  lastRenderTime: number;
}

// ========== 性能收集器 ==========

/** 性能指标存储 */
const metricsStore: PerformanceMetric[] = [];
const MAX_METRICS = 1000;

/**
 * 记录性能指标
 */
export function recordMetric(
  name: string,
  value: number,
  unit: 'ms' | 'count' | 'bytes' = 'ms'
): void {
  if (typeof window === 'undefined') return;

  metricsStore.push({
    name,
    value,
    unit,
    timestamp: Date.now(),
  });

  // 限制存储大小
  if (metricsStore.length > MAX_METRICS) {
    metricsStore.shift();
  }
}

/**
 * 获取性能指标
 */
export function getMetrics(name?: string): PerformanceMetric[] {
  if (name) {
    return metricsStore.filter(m => m.name === name);
  }
  return [...metricsStore];
}

/**
 * 获取性能统计
 */
export function getMetricStats(name: string): {
  min: number;
  max: number;
  avg: number;
  count: number;
  p50: number;
  p95: number;
  p99: number;
} | null {
  const metrics = metricsStore.filter(m => m.name === name);
  if (metrics.length === 0) return null;

  const values = metrics.map(m => m.value).sort((a, b) => a - b);
  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    min: values[0],
    max: values[count - 1],
    avg: sum / count,
    count,
    p50: values[Math.floor(count * 0.5)],
    p95: values[Math.floor(count * 0.95)],
    p99: values[Math.floor(count * 0.99)],
  };
}

/**
 * 清除性能指标
 */
export function clearMetrics(): void {
  metricsStore.length = 0;
}

// ========== 组件性能监控 Hook ==========

/**
 * 组件性能监控 Hook
 *
 * @example
 * function MyComponent() {
 *   const { renderCount, avgRenderTime } = usePerformanceMonitor('MyComponent');
 *   // ...
 * }
 */
export function usePerformanceMonitor(componentName: string): ComponentMetrics {
  const metricsRef = useRef<ComponentMetrics>({
    renderCount: 0,
    totalRenderTime: 0,
    avgRenderTime: 0,
    lastRenderTime: 0,
  });
  const startTimeRef = useRef<number>(0);

  // 记录渲染开始时间
  startTimeRef.current = performance.now();

  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;

    metricsRef.current.renderCount += 1;
    metricsRef.current.lastRenderTime = renderTime;
    metricsRef.current.totalRenderTime += renderTime;
    metricsRef.current.avgRenderTime =
      metricsRef.current.totalRenderTime / metricsRef.current.renderCount;

    // 记录到全局存储
    recordMetric(`render:${componentName}`, renderTime, 'ms');

    // 开发环境输出警告（渲染时间过长）
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(
        `[Performance] ${componentName} 渲染时间过长: ${renderTime.toFixed(2)}ms`
      );
    }
  });

  return metricsRef.current;
}

// ========== 函数执行时间测量 ==========

/**
 * 测量异步函数执行时间
 *
 * @example
 * const result = await measureAsync('fetchEntries', () => api.entries.list.query());
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    recordMetric(name, duration, 'ms');
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(`${name}:error`, duration, 'ms');
    throw error;
  }
}

/**
 * 测量同步函数执行时间
 *
 * @example
 * const result = measureSync('processData', () => processData(data));
 */
export function measureSync<T>(name: string, fn: () => T): T {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    recordMetric(name, duration, 'ms');
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(`${name}:error`, duration, 'ms');
    throw error;
  }
}

// ========== 防抖和节流（性能优化） ==========

/**
 * 防抖 Hook
 *
 * @example
 * const debouncedSearch = useDebounce(search, 300);
 */
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  // 清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

/**
 * 节流 Hook
 *
 * @example
 * const throttledScroll = useThrottle(handleScroll, 100);
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  limit: number
): T {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRunRef.current;

      if (timeSinceLastRun >= limit) {
        lastRunRef.current = now;
        callback(...args);
      } else {
        // 确保最后一次调用会被执行
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          lastRunRef.current = Date.now();
          callback(...args);
        }, limit - timeSinceLastRun);
      }
    },
    [callback, limit]
  ) as T;

  // 清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledFn;
}

// ========== Web Vitals 监控 ==========

/**
 * 初始化 Web Vitals 监控
 */
export function initWebVitalsMonitoring(): void {
  if (typeof window === 'undefined') return;

  // 使用 PerformanceObserver 监控性能指标
  try {
    // 监控长任务
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        recordMetric('longTask', entry.duration, 'ms');
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Performance] 长任务检测:', entry.duration.toFixed(2), 'ms');
        }
      }
    });
    longTaskObserver.observe({ type: 'longtask', buffered: true });

    // 监控布局偏移
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          recordMetric('layoutShift', (entry as any).value, 'count');
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    // 监控首次输入延迟
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        recordMetric('firstInputDelay', (entry as any).processingStart - entry.startTime, 'ms');
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });

  } catch (error) {
    // PerformanceObserver 可能不被支持
    console.warn('[Performance] PerformanceObserver not fully supported');
  }

  // 页面加载性能
  window.addEventListener('load', () => {
    setTimeout(() => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (timing) {
        recordMetric('pageLoad:domContentLoaded', timing.domContentLoadedEventEnd - timing.startTime, 'ms');
        recordMetric('pageLoad:load', timing.loadEventEnd - timing.startTime, 'ms');
        recordMetric('pageLoad:ttfb', timing.responseStart - timing.startTime, 'ms');
        recordMetric('pageLoad:fcu', timing.domInteractive - timing.startTime, 'ms');
      }
    }, 0);
  });
}

// ========== 导出性能报告 ==========

/**
 * 生成性能报告
 */
export function generatePerformanceReport(): {
  metrics: Record<string, ReturnType<typeof getMetricStats>>;
  summary: {
    totalMetrics: number;
    slowRenders: number;
    longTasks: number;
  };
} {
  const uniqueNames = [...new Set(metricsStore.map(m => m.name))];
  const metrics: Record<string, ReturnType<typeof getMetricStats>> = {};

  for (const name of uniqueNames) {
    metrics[name] = getMetricStats(name);
  }

  const slowRenders = metricsStore.filter(
    m => m.name.startsWith('render:') && m.value > 16
  ).length;

  const longTasks = metricsStore.filter(
    m => m.name === 'longTask'
  ).length;

  return {
    metrics,
    summary: {
      totalMetrics: metricsStore.length,
      slowRenders,
      longTasks,
    },
  };
}

// 自动初始化
if (typeof window !== 'undefined') {
  initWebVitalsMonitoring();
}
