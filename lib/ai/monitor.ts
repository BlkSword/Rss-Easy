/**
 * 性能监控器
 *
 * 监控 AI 分析性能，生成告警和建议
 */

import { metricsCollector, type AnalysisMetrics } from './metrics';

// =====================================================
// 类型定义
// =====================================================

export interface PerformanceAlert {
  /** 告警类型 */
  type: 'slow_processing' | 'high_cost' | 'low_quality' | 'error_spike' | 'queue_backlog';
  /** 严重程度 */
  severity: 'info' | 'warning' | 'critical';
  /** 告警消息 */
  message: string;
  /** 详细数据 */
  data: any;
  /** 时间戳 */
  timestamp: Date;
}

export interface PerformanceThresholds {
  /** 最大处理时间（毫秒） */
  maxProcessingTime: number;
  /** 最大单次成本（美元） */
  maxCostPerAnalysis: number;
  /** 最大错误率 */
  maxErrorRate: number;
  /** 最大队列积压 */
  maxQueueBacklog: number;
}

export interface MonitoringReport {
  /** 告警列表 */
  alerts: PerformanceAlert[];
  /** 性能指标 */
  metrics: {
    avgProcessingTime: number;
    avgCost: number;
    errorRate: number;
    queueBacklog: number;
  };
  /** 趋势 */
  trends: {
    processingTime: 'improving' | 'stable' | 'degrading';
    cost: 'under' | 'normal' | 'over';
    errors: 'low' | 'normal' | 'high';
  };
  /** 建议 */
  recommendations: string[];
}

// =====================================================
// 性能监控器类
// =====================================================

export class PerformanceMonitor {
  private thresholds: PerformanceThresholds;
  private alerts: PerformanceAlert[] = [];
  private historicalData: Array<{
    timestamp: Date;
    avgProcessingTime: number;
    avgCost: number;
    errorRate: number;
  }> = [];

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      maxProcessingTime: 60000, // 1 分钟
      maxCostPerAnalysis: 0.02,   // $0.02
      maxErrorRate: 0.1,          // 10%
      maxQueueBacklog: 100,
      ...thresholds,
    };
  }

  /**
   * 检查性能指标
   */
  check(
    metrics: AnalysisMetrics[],
    queueStatus?: {
      waiting: number;
      active: number;
      failed: number;
    }
  ): PerformanceAlert[] {
    this.alerts = [];

    if (metrics.length === 0) {
      return this.alerts;
    }

    // 1. 检查处理时间
    this.checkProcessingTime(metrics);

    // 2. 检查成本
    this.checkCost(metrics);

    // 3. 检查错误率
    this.checkErrors(metrics);

    // 4. 检查队列积压
    if (queueStatus) {
      this.checkQueue(queueStatus);
    }

    return this.alerts;
  }

  /**
   * 生成监控报告
   */
  generateReport(
    metrics: AnalysisMetrics[],
    queueStatus?: {
      waiting: number;
      active: number;
      failed: number;
    }
  ): MonitoringReport {
    // 检查告警
    const alerts = this.check(metrics, queueStatus);

    // 计算指标
    const avgProcessingTime = this.calculateAverage(metrics, 'processingTime');
    const avgCost = this.calculateAverage(metrics, 'cost');
    const errorRate = this.calculateErrorRate(metrics);
    const queueBacklog = queueStatus?.waiting || 0;

    // 分析趋势
    const trends = this.analyzeTrends(avgProcessingTime, avgCost, errorRate);

    // 生成建议
    const recommendations = this.generateRecommendations(alerts, trends);

    return {
      alerts,
      metrics: {
        avgProcessingTime,
        avgCost,
        errorRate,
        queueBacklog,
      },
      trends,
      recommendations,
    };
  }

  /**
   * 获取最近的告警
   */
  getRecentAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 清空告警
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * 更新阈值
   */
  updateThresholds(updates: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
  }

  /**
   * 获取阈值
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  // =====================================================
  // 私有方法
  // =====================================================

  private checkProcessingTime(metrics: AnalysisMetrics[]): void {
    const avgTime = this.calculateAverage(metrics, 'processingTime');
    const maxTime = Math.max(...metrics.map(m => m.processingTime));

    // 检查平均时间
    if (avgTime > this.thresholds.maxProcessingTime) {
      this.addAlert({
        type: 'slow_processing',
        severity: avgTime > this.thresholds.maxProcessingTime * 2 ? 'critical' : 'warning',
        message: `平均处理时间过长: ${Math.round(avgTime / 1000)}秒`,
        data: { avgTime, maxTime, threshold: this.thresholds.maxProcessingTime },
      });
    }

    // 检查最大时间
    const slowMetrics = metrics.filter(m => m.processingTime > this.thresholds.maxProcessingTime);
    if (slowMetrics.length > 0) {
      this.addAlert({
        type: 'slow_processing',
        severity: 'info',
        message: `${slowMetrics.length} 篇文章处理超时`,
        data: {
          count: slowMetrics.length,
          entries: slowMetrics.map(m => m.entryId),
        },
      });
    }
  }

  private checkCost(metrics: AnalysisMetrics[]): void {
    const avgCost = this.calculateAverage(metrics, 'cost');
    const maxCost = Math.max(...metrics.map(m => m.cost));

    // 检查平均成本
    if (avgCost > this.thresholds.maxCostPerAnalysis) {
      this.addAlert({
        type: 'high_cost',
        severity: avgCost > this.thresholds.maxCostPerAnalysis * 2 ? 'critical' : 'warning',
        message: `平均成本偏高: $${avgCost.toFixed(4)}`,
        data: { avgCost, maxCost, threshold: this.thresholds.maxCostPerAnalysis },
      });
    }

    // 检查最高成本
    const expensiveMetrics = metrics.filter(m => m.cost > this.thresholds.maxCostPerAnalysis);
    if (expensiveMetrics.length > 0) {
      this.addAlert({
        type: 'high_cost',
        severity: 'info',
        message: `${expensiveMetrics.length} 篇文章成本过高`,
        data: {
          count: expensiveMetrics.length,
          avgCost: expensiveMetrics.reduce((sum, m) => sum + m.cost, 0) / expensiveMetrics.length,
        },
      });
    }
  }

  private checkErrors(metrics: AnalysisMetrics[]): void {
    const errorRate = this.calculateErrorRate(metrics);

    if (errorRate > this.thresholds.maxErrorRate) {
      this.addAlert({
        type: 'error_spike',
        severity: errorRate > this.thresholds.maxErrorRate * 2 ? 'critical' : 'warning',
        message: `错误率过高: ${(errorRate * 100).toFixed(1)}%`,
        data: { errorRate, threshold: this.thresholds.maxErrorRate },
      });
    }
  }

  private checkQueue(queueStatus: {
    waiting: number;
    active: number;
    failed: number;
  }): void {
    const { waiting, failed } = queueStatus;

    // 检查积压
    if (waiting > this.thresholds.maxQueueBacklog) {
      this.addAlert({
        type: 'queue_backlog',
        severity: waiting > this.thresholds.maxQueueBacklog * 2 ? 'critical' : 'warning',
        message: `队列积压严重: ${waiting} 个任务等待`,
        data: { waiting, active: queueStatus.active, failed },
      });
    }

    // 检查失败任务
    if (failed > 10) {
      this.addAlert({
        type: 'error_spike',
        severity: 'warning',
        message: `${failed} 个任务失败`,
        data: { failed },
      });
    }
  }

  private analyzeTrends(
    avgProcessingTime: number,
    avgCost: number,
    errorRate: number
  ): MonitoringReport['trends'] {
    // 比较历史数据
    if (this.historicalData.length < 2) {
      return {
        processingTime: 'stable',
        cost: 'normal',
        errors: 'low',
      };
    }

    const recent = this.historicalData[this.historicalData.length - 1];
    const older = this.historicalData[0];

    return {
      processingTime: this.getTimeTrend(avgProcessingTime, older.avgProcessingTime, recent.avgProcessingTime),
      cost: this.getCostTrend(avgCost, this.thresholds.maxCostPerAnalysis),
      errors: this.getErrorTrend(errorRate),
    };
  }

  private getTimeTrend(
    current: number,
    older: number,
    recent: number
  ): 'improving' | 'stable' | 'degrading' {
    const change = ((current - older) / older) * 100;

    if (Math.abs(change) < 5) return 'stable';
    if (change < 0) return 'improving';
    return 'degrading';
  }

  private getCostTrend(current: number, threshold: number): 'under' | 'normal' | 'over' {
    if (current < threshold * 0.8) return 'under';
    if (current > threshold * 1.2) return 'over';
    return 'normal';
  }

  private getErrorTrend(current: number): 'low' | 'normal' | 'high' {
    if (current < 0.05) return 'low';
    if (current > 0.1) return 'high';
    return 'normal';
  }

  private generateRecommendations(
    alerts: PerformanceAlert[],
    trends: MonitoringReport['trends']
  ): string[] {
    const recommendations: string[] = [];

    // 基于告警的建议
    for (const alert of alerts) {
      switch (alert.type) {
        case 'slow_processing':
          if (alert.severity === 'critical') {
            recommendations.push('处理时间过长，考虑：1) 使用更快的模型 2) 启用短文快速路径 3) 增加并发数');
          } else {
            recommendations.push('处理时间偏长，可以考虑优化模型选择或启用短文快速分析');
          }
          break;

        case 'high_cost':
          if (alert.severity === 'critical') {
            recommendations.push('成本过高，建议：1) 启用初评过滤 2) 使用更便宜的模型 3) 优化提示词减少 token 使用');
          } else {
            recommendations.push('成本偏高，可以考虑使用性价比更高的模型');
          }
          break;

        case 'error_spike':
          recommendations.push('错误率过高，请检查：1) API 配置 2) 模型可用性 3) 内容格式');
          break;

        case 'queue_backlog':
          recommendations.push(`队列积压 ${alert.data?.waiting || 0} 个任务，建议：1) 增加并发数 2) 启用更多 Worker 3) 优化处理逻辑`);
          break;
      }
    }

    // 基于趋势的建议
    if (trends.processingTime === 'degrading') {
      recommendations.push('处理时间呈恶化趋势，建议检查系统负载和模型响应时间');
    }

    if (trends.cost === 'over') {
      recommendations.push('成本呈上升趋势，建议定期审查模型使用情况');
    }

    if (trends.errors === 'high') {
      recommendations.push('错误率呈上升趋势，建议加强错误处理和重试机制');
    }

    return recommendations;
  }

  private calculateAverage(metrics: AnalysisMetrics[], key: keyof AnalysisMetrics): number {
    const values = metrics.map(m => m[key]).filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  private calculateErrorRate(metrics: AnalysisMetrics[]): number {
    const failed = metrics.filter(m => !m.success).length;
    return metrics.length > 0 ? failed / metrics.length : 0;
  }

  private addAlert(alert: Omit<PerformanceAlert, 'timestamp'>): void {
    this.alerts.push({
      ...alert,
      timestamp: new Date(),
    });
  }

  /**
   * 保存历史数据点
   */
  saveHistoryPoint(metrics: AnalysisMetrics[]): void {
    if (metrics.length === 0) return;

    const avgProcessingTime = this.calculateAverage(metrics, 'processingTime');
    const avgCost = this.calculateAverage(metrics, 'cost');
    const errorRate = this.calculateErrorRate(metrics);

    this.historicalData.push({
      timestamp: new Date(),
      avgProcessingTime,
      avgCost,
      errorRate,
    });

    // 只保留最近 30 个数据点
    if (this.historicalData.length > 30) {
      this.historicalData.shift();
    }
  }

  /**
   * 清空历史数据
   */
  clearHistory(): void {
    this.historicalData = [];
  }
}

// =====================================================
// 默认实例
// =====================================================

export const performanceMonitor = new PerformanceMonitor();

// =====================================================
// 辅助函数
// =====================================================

/**
 * 创建性能告警
 */
export function createAlert(
  type: PerformanceAlert['type'],
  message: string,
  severity: PerformanceAlert['severity'] = 'warning',
  data?: any
): PerformanceAlert {
  return {
    type,
    severity,
    message,
    data: data || {},
    timestamp: new Date(),
  };
}

/**
 * 检查是否需要告警
 */
export function shouldAlert(
  value: number,
  threshold: number,
  severity: 'warning' | 'critical' = 'warning'
): boolean {
  if (severity === 'critical') {
    return value > threshold * 2;
  }
  return value > threshold;
}
