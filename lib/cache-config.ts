/**
 * 缓存配置
 * 为不同类型的数据定义不同的缓存策略
 */

/**
 * 缓存时间配置（毫秒）
 */
export const CACHE_TIMES = {
  // 非常短（实时性要求高）
  VERY_SHORT: 1000 * 10,        // 10秒

  // 短（默认）
  SHORT: 1000 * 60,             // 1分钟

  // 中等（列表数据）
  MEDIUM: 1000 * 60 * 5,        // 5分钟

  // 长（不常变化的数据）
  LONG: 1000 * 60 * 15,         // 15分钟

  // 非常长（几乎不变的数据）
  VERY_LONG: 1000 * 60 * 60,    // 1小时
} as const;

/**
 * 数据类型缓存配置
 */
export const QUERY_CACHE_CONFIG = {
  // 文章列表 - 变化频繁但可短时间缓存
  entries: {
    staleTime: CACHE_TIMES.SHORT,      // 1分钟
    gcTime: CACHE_TIMES.MEDIUM,        // 5分钟后清理
  },

  // 单篇文章 - 可缓存较长时间
  entry: {
    staleTime: CACHE_TIMES.MEDIUM,     // 5分钟
    gcTime: CACHE_TIMES.LONG,          // 15分钟后清理
  },

  // 订阅源列表 - 不常变化
  feeds: {
    staleTime: CACHE_TIMES.LONG,       // 15分钟
    gcTime: CACHE_TIMES.VERY_LONG,     // 1小时后清理
  },

  // 分类列表 - 很少变化
  categories: {
    staleTime: CACHE_TIMES.VERY_LONG,  // 1小时
    gcTime: CACHE_TIMES.VERY_LONG * 2, // 2小时后清理
  },

  // 用户设置 - 很少变化
  settings: {
    staleTime: CACHE_TIMES.VERY_LONG,  // 1小时
    gcTime: CACHE_TIMES.VERY_LONG * 2, // 2小时后清理
  },

  // 搜索结果 - 短时间缓存
  search: {
    staleTime: CACHE_TIMES.SHORT,      // 1分钟
    gcTime: CACHE_TIMES.MEDIUM,        // 5分钟后清理
  },

  // AI 分析结果 - 可缓存较长时间
  aiAnalysis: {
    staleTime: CACHE_TIMES.LONG,       // 15分钟
    gcTime: CACHE_TIMES.VERY_LONG,     // 1小时后清理
  },

  // 通知 - 变化频繁
  notifications: {
    staleTime: CACHE_TIMES.VERY_SHORT, // 10秒
    gcTime: CACHE_TIMES.SHORT,         // 1分钟后清理
  },

  // 报告 - 可缓存较长时间
  reports: {
    staleTime: CACHE_TIMES.LONG,       // 15分钟
    gcTime: CACHE_TIMES.VERY_LONG,     // 1小时后清理
  },

  // 队列状态 - 实时性要求高
  queueStatus: {
    staleTime: CACHE_TIMES.VERY_SHORT, // 10秒
    gcTime: CACHE_TIMES.SHORT,         // 1分钟后清理
  },

  // 统计数据 - 可缓存中等时间
  analytics: {
    staleTime: CACHE_TIMES.MEDIUM,     // 5分钟
    gcTime: CACHE_TIMES.LONG,          // 15分钟后清理
  },
} as const;

/**
 * 获取缓存配置
 */
export function getQueryConfig(type: keyof typeof QUERY_CACHE_CONFIG) {
  return QUERY_CACHE_CONFIG[type];
}

/**
 * 创建带有缓存配置的查询选项
 */
export function createQueryOptions<T>(
  type: keyof typeof QUERY_CACHE_CONFIG,
  options?: {
    enabled?: boolean;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
  }
) {
  const cacheConfig = QUERY_CACHE_CONFIG[type];
  return {
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
    ...options,
  };
}
