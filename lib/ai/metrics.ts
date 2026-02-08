/**
 * AI 分析指标收集器
 *
 * 收集和分析 AI 分析的各种指标
 * 用于性能监控和成本优化
 */

// =====================================================
// 类型定义
// =====================================================

export interface AnalysisMetrics {
  /** 文章ID */
  entryId: string;
  /** 分析阶段 */
  stage: 'preliminary' | 'analysis' | 'reflection' | 'full';
  /** 使用的模型 */
  model: string;
  /** 语言 */
  language: string;
  /** 内容长度（字符数） */
  contentLength: number;
  /** 处理时间（毫秒） */
  processingTime: number;
  /** 输入 token 数 */
  inputTokens: number;
  /** 输出 token 数 */
  outputTokens: number;
  /** 总 token 数 */
  totalTokens: number;
  /** 成本（美元） */
  cost: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  errorMessage?: string;
  /** 时间戳 */
  timestamp: Date;
}

export interface MetricsStats {
  /** 总处理数 */
  total: number;
  /** 成功数 */
  success: number;
  /** 失败数 */
  failed: number;
  /** 成功率 */
  successRate: number;
  /** 平均处理时间 */
  avgProcessingTime: number;
  /** 平均成本 */
  avgCost: number;
  /** 总成本 */
  totalCost: number;
  /** 按模型分组 */
  byModel: Record<string, {
    count: number;
    avgTime: number;
    avgCost: number;
    totalCost: number;
  }>;
  /** 按语言分组 */
  byLanguage: Record<string, {
    count: number;
    avgTime: number;
    avgCost: number;
  }>;
  /** 按阶段分组 */
  byStage: Record<string, {
    count: number;
    avgTime: number;
    avgCost: number;
    totalCost: number;
  }>;
}

export interface CostAnalysis {
  /** 总成本 */
  totalCost: number;
  /** 按模型的成本 */
  byModel: Record<string, number>;
  /** 按阶段的成本 */
  byStage: Record<string, number>;
  /** 成本趋势 */
  trend: Array<{
    date: string;
    cost: number;
    count: number;
  }>;
  /** 优化建议 */
  suggestions: string[];
}

// =====================================================
// 指标收集器类
// =====================================================

export class MetricsCollector {
  private metrics: Map<string, AnalysisMetrics> = new Map();

  /**
   * 记录指标
   */
  record(metric: AnalysisMetrics): void {
    const key = `${metric.entryId}-${metric.stage}-${metric.timestamp.getTime()}`;
    this.metrics.set(key, metric);
  }

  /**
   * 批量记录指标
   */
  recordBatch(metrics: AnalysisMetrics[]): void {
    for (const metric of metrics) {
      this.record(metric);
    }
  }

  /**
   * 获取所有指标
   */
  getAllMetrics(): AnalysisMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * 按时间范围获取指标
   */
  getMetricsByTimeRange(start: Date, end: Date): AnalysisMetrics[] {
    return this.getAllMetrics().filter(m => {
      return m.timestamp >= start && m.timestamp <= end;
    });
  }

  /**
   * 按文章获取指标
   */
  getMetricsByEntry(entryId: string): AnalysisMetrics[] {
    return this.getAllMetrics().filter(m => m.entryId === entryId);
  }

  /**
   * 获取统计
   */
  getStats(timeRange?: { start: Date; end: Date }): MetricsStats {
    let metrics = this.getAllMetrics();

    if (timeRange) {
      metrics = this.getMetricsByTimeRange(timeRange.start, timeRange.end);
    }

    if (metrics.length === 0) {
      return this.getEmptyStats();
    }

    const total = metrics.length;
    const success = metrics.filter(m => m.success).length;
    const failed = metrics.filter(m => !m.success).length;

    const processingTimes = metrics.map(m => m.processingTime);
    const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

    const costs = metrics.map(m => m.cost);
    const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
    const totalCost = costs.reduce((a, b) => a + b, 0);

    // 按模型分组
    const byModel = this.groupBy(metrics, 'model');
    const byLanguage = this.groupBy(metrics, 'language');
    const byStage = this.groupBy(metrics, 'stage');

    return {
      total,
      success,
      failed,
      successRate: (success / total) * 100,
      avgProcessingTime,
      avgCost,
      totalCost,
      byModel: this.calculateGroupStats(byModel),
      byLanguage: this.calculateGroupStats(byLanguage),
      byStage: this.calculateGroupStats(byStage),
    };
  }

  /**
   * 成本分析
   */
  analyzeCosts(timeRange?: { start: Date; end: Date }): CostAnalysis {
    let metrics = this.getAllMetrics();

    if (timeRange) {
      metrics = this.getMetricsByTimeRange(timeRange.start, timeRange.end);
    }

    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);

    // 按模型分组
    const byModel: Record<string, number> = {};
    for (const m of metrics) {
      byModel[m.model] = (byModel[m.model] || 0) + m.cost;
    }

    // 按阶段分组
    const byStage: Record<string, number> = {};
    for (const m of metrics) {
      byStage[m.stage] = (byStage[m.stage] || 0) + m.cost;
    }

    // 成本趋势（按天）
    const trend = this.calculateCostTrend(metrics);

    // 优化建议
    const suggestions = this.generateCostSuggestions(byModel, byStage);

    return {
      totalCost,
      byModel,
      byStage,
      trend,
      suggestions,
    };
  }

  /**
   * 性能分析
   */
  analyzePerformance(): {
    avgProcessingTime: number;
    p50: number;
    p95: number;
    p99: number;
    slowest: AnalysisMetrics[];
    byModel: Record<string, number>;
  } {
    const metrics = this.getAllMetrics();
    const times = metrics.map(m => m.processingTime).sort((a, b) => a - b);

    if (times.length === 0) {
      return {
        avgProcessingTime: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        slowest: [],
        byModel: {},
      };
    }

    const avgProcessingTime = times.reduce((a, b) => a + b, 0) / times.length;
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];

    // 找出最慢的 10 个
    const slowest = metrics
      .sort((a, b) => b.processingTime - a.processingTime)
      .slice(0, 10);

    // 按模型平均时间
    const byModelGroup = this.groupBy(metrics, 'model');
    const byModel: Record<string, number> = {};
    for (const [model, group] of Object.entries(byModelGroup)) {
      const avgTime = group.reduce((sum, m) => sum + m.processingTime, 0) / group.length;
      byModel[model] = avgTime;
    }

    return {
      avgProcessingTime,
      p50,
      p95,
      p99,
      slowest,
      byModel,
    };
  }

  /**
   * 清空指标
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * 删除过期指标
   */
  deleteOlderThan(days: number): number {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let deleted = 0;

    for (const [key, metric] of this.metrics.entries()) {
      if (metric.timestamp < cutoff) {
        this.metrics.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  // =====================================================
  // 私有方法
  // =====================================================

  private getEmptyStats(): MetricsStats {
    return {
      total: 0,
      success: 0,
      failed: 0,
      successRate: 0,
      avgProcessingTime: 0,
      avgCost: 0,
      totalCost: 0,
      byModel: {},
      byLanguage: {},
      byStage: {},
    };
  }

  private groupBy(metrics: AnalysisMetrics[], key: keyof AnalysisMetrics): Record<string, AnalysisMetrics[]> {
    const groups: Record<string, AnalysisMetrics[]> = {};

    for (const m of metrics) {
      const k = String(m[key]);
      if (!groups[k]) {
        groups[k] = [];
      }
      groups[k].push(m);
    }

    return groups;
  }

  private calculateGroupStats(
    groups: Record<string, AnalysisMetrics[]>
  ): Record<string, { count: number; avgTime: number; avgCost: number; totalCost: number }> {
    const stats: Record<string, { count: number; avgTime: number; avgCost: number; totalCost: number }> = {};

    for (const [key, group] of Object.entries(groups)) {
      const count = group.length;
      const avgTime = group.reduce((sum, m) => sum + m.processingTime, 0) / count;
      const avgCost = group.reduce((sum, m) => sum + m.cost, 0) / count;
      const totalCost = group.reduce((sum, m) => sum + m.cost, 0);

      stats[key] = {
        count,
        avgTime,
        avgCost,
        totalCost,
      };
    }

    return stats;
  }

  private calculateCostTrend(metrics: AnalysisMetrics[]): Array<{
    date: string;
    cost: number;
    count: number;
  }> {
    // 按天分组
    const byDay: Record<string, { cost: number; count: number }> = {};

    for (const m of metrics) {
      const date = m.timestamp.toISOString().split('T')[0];
      if (!byDay[date]) {
        byDay[date] = { cost: 0, count: 0 };
      }
      byDay[date].cost += m.cost;
      byDay[date].count++;
    }

    return Object.entries(byDay)
      .map(([date, data]) => ({
        date,
        cost: data.cost,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private generateCostSuggestions(
    byModel: Record<string, number>,
    byStage: Record<string, number>
  ): string[] {
    const suggestions: string[] = [];

    // 找出成本最高的模型
    const sortedModels = Object.entries(byModel).sort((a, b) => b[1] - a[1]);
    if (sortedModels.length > 0) {
      const [model, cost] = sortedModels[0];
      suggestions.push(`最昂贵的模型是 ${model}（$${cost.toFixed(4)}），考虑使用更便宜的替代方案`);
    }

    // 找出成本最高的阶段
    const sortedStages = Object.entries(byStage).sort((a, b) => b[1] - a[1]);
    if (sortedStages.length > 0) {
      const [stage, cost] = sortedStages[0];
      suggestions.push(`${stage} 阶段成本最高（$${cost.toFixed(4)}），可以优化此阶段的模型选择`);
    }

    // 检查是否有明显的高成本
    const totalCost = Object.values(byModel).reduce((sum, cost) => sum + cost, 0);
    if (totalCost > 1) {
      suggestions.push(`总成本 $${totalCost.toFixed(2)} 较高，建议启用初评过滤减少不必要的分析`);
    }

    return suggestions;
  }
}

// =====================================================
// 默认实例
// =====================================================

export const metricsCollector = new MetricsCollector();

// =====================================================
// 辅助函数
// =====================================================

/**
 * 创建指标对象
 */
export function createMetric(
  data: Omit<AnalysisMetrics, 'timestamp'>
): AnalysisMetrics {
  return {
    ...data,
    timestamp: new Date(),
  };
}

/**
 * 计算预估成本
 */
export function estimateCost(
  model: string,
  contentLength: number
): number {
  // 简化的成本估算
  const estimatedTokens = Math.ceil(contentLength / 4); // 约 4 字符 = 1 token
  const pricePer1kTokens = getModelPrice(model);

  return (estimatedTokens / 1000) * pricePer1kTokens;
}

/**
 * 获取模型价格
 */
function getModelPrice(model: string): number {
  const prices: Record<string, number> = {
    'gpt-4o': 0.005,
    'gpt-4o-mini': 0.00015,
    'claude-3-5-sonnet': 0.003,
    'claude-3-haiku': 0.00025,
    'deepseek-chat': 0.00014,
    'gemini-1.5-flash': 0.000075,
    'gemini-1.5-pro': 0.0035,
  };

  return prices[model] || 0.001; // 默认价格
}
