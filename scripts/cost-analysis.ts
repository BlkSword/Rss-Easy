/**
 * 成本分析脚本
 *
 * 分析 AI 分析的成本，生成报告和优化建议
 */

import { metricsCollector } from '../lib/ai/metrics';
import { performanceMonitor } from '../lib/ai/monitor';
import { getModelConfig } from '../lib/ai/model-config';
import { db } from '../lib/db';

// =====================================================
// 报告生成
// =====================================================

/**
 * 生成成本报告
 */
async function generateCostReport() {
  console.log('\n💰 成本分析报告\n');
  console.log('=' .repeat(50));

  // 获取所有指标
  const metrics = metricsCollector.getAllMetrics();

  if (metrics.length === 0) {
    console.log('暂无分析数据');
    console.log('\n提示: 运行一些分析任务后再查看成本报告');
    return;
  }

  // 总体统计
  const stats = metricsCollector.getStats();
  console.log('\n📊 总体统计:');
  console.log(`  总处理数: ${stats.total}`);
  console.log(`  成功: ${stats.success} | 失败: ${stats.failed}`);
  console.log(`  成功率: ${stats.successRate.toFixed(1)}%`);
  console.log(`  平均处理时间: ${Math.round(stats.avgProcessingTime / 1000)}秒`);
  console.log(`  平均成本: $${stats.avgCost.toFixed(6)}`);
  console.log(`  总成本: $${stats.totalCost.toFixed(4)}`);

  // 按模型分组
  console.log('\n📈 按模型统计:');
  const modelEntries = Object.entries(stats.byModel).sort((a, b) => b[1].totalCost - a[1].totalCost);

  for (const [model, data] of modelEntries) {
    const percentage = (data.totalCost / stats.totalCost * 100).toFixed(1);
    console.log(`  ${model}:`);
    console.log(`    数量: ${data.count}`);
    console.log(`    平均时间: ${Math.round(data.avgTime / 1000)}秒`);
    console.log(`    平均成本: $${data.avgCost.toFixed(6)}`);
    console.log(`    总成本: $${data.totalCost.toFixed(4)} (${percentage}%)`);
  }

  // 按语言分组
  console.log('\n🌍 按语言统计:');
  const langEntries = Object.entries(stats.byLanguage).sort((a, b) => b[1].count - a[1].count);

  for (const [lang, data] of langEntries) {
    console.log(`  ${lang}:`);
    console.log(`    数量: ${data.count}`);
    console.log(`    平均时间: ${Math.round(data.avgTime / 1000)}秒`);
    console.log(`    平均成本: $${data.avgCost.toFixed(6)}`);
  }

  // 按阶段分组
  console.log('\n⚙️ 按阶段统计:');
  const stageEntries = Object.entries(stats.byStage);

  for (const [stage, data] of stageEntries) {
    const percentage = (data.totalCost / stats.totalCost * 100).toFixed(1);
    console.log(`  ${stage}:`);
    console.log(`    数量: ${data.count}`);
    console.log(`    平均时间: ${Math.round(data.avgTime / 1000)}秒`);
    console.log(`    总成本: $${data.totalCost.toFixed(4)} (${percentage}%)`);
  }

  // 成本分析
  const costAnalysis = metricsCollector.analyzeCosts();

  console.log('\n💡 成本优化建议:');
  if (costAnalysis.suggestions.length === 0) {
    console.log('  成本表现良好，继续保持！');
  } else {
    for (const suggestion of costAnalysis.suggestions) {
      console.log(`  • ${suggestion}`);
    }
  }

  // 成本趋势
  if (costAnalysis.trend.length > 0) {
    console.log('\n📅 成本趋势 (最近7天):');
    for (const item of costAnalysis.trend.slice(-7)) {
      console.log(`  ${item.date}: $${item.cost.toFixed(4)} (${item.count} 篇)`);
    }
  }
}

/**
 * 生成性能报告
 */
async function generatePerformanceReport() {
  console.log('\n⚡ 性能分析报告\n');
  console.log('=' .repeat(50));

  const metrics = metricsCollector.getAllMetrics();

  if (metrics.length === 0) {
    console.log('暂无分析数据');
    return;
  }

  // 使用 metricsCollector 获取性能数据
  const stats = metricsCollector.getStats();

  console.log('\n📊 性能指标:');
  console.log(`  平均处理时间: ${Math.round(stats.avgProcessingTime / 1000)}秒`);

  // 计算百分位数
  const times = metrics.map(m => m.processingTime).sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  console.log(`  P50 (中位数): ${Math.round(p50 / 1000)}秒`);
  console.log(`  P95 (95分位): ${Math.round(p95 / 1000)}秒`);
  console.log(`  P99 (99分位): ${Math.round(p99 / 1000)}秒`);

  console.log('\n🐌 最慢的 10 篇文章:');
  const slowest = metrics.sort((a, b) => b.processingTime - a.processingTime).slice(0, 10);
  for (let i = 0; i < slowest.length; i++) {
    const item = slowest[i];
    console.log(`  ${i + 1}. ${item.entryId} (${Math.round(item.processingTime / 1000)}秒)`);
    console.log(`     模型: ${item.model}, 语言: ${item.language}, 长度: ${item.contentLength} 字符`);
  }

  console.log('\n⚙️ 按模型的平均处理时间:');
  const byModel = stats.byModel;
  const modelEntries = Object.entries(byModel).sort((a, b) => a[1].avgTime - b[1].avgTime);

  for (const [model, data] of modelEntries) {
    console.log(`  ${model}: ${Math.round(data.avgTime / 1000)}秒`);
  }
}

/**
 * 生成对比分析
 */
async function generateComparisonReport() {
  console.log('\n🔍 模型对比分析\n');
  console.log('=' .repeat(50));

  const metrics = metricsCollector.getAllMetrics();

  if (metrics.length === 0) {
    console.log('暂无分析数据');
    return;
  }

  // 按模型分组
  const byModel: Record<string, typeof metrics> = {};
  for (const m of metrics) {
    if (!byModel[m.model]) {
      byModel[m.model] = [];
    }
    byModel[m.model].push(m);
  }

  // 对比模型
  const modelComparisons = Object.entries(byModel).map(([model, modelMetrics]) => {
    const config = getModelConfig(model);
    const avgTime = modelMetrics.reduce((sum, m) => sum + m.processingTime, 0) / modelMetrics.length;
    const avgCost = modelMetrics.reduce((sum, m) => sum + m.cost, 0) / modelMetrics.length;
    const totalTime = modelMetrics.reduce((sum, m) => sum + m.processingTime, 0);
    const totalCost = modelMetrics.reduce((sum, m) => sum + m.cost, 0);

    return {
      model,
      count: modelMetrics.length,
      config,
      avgTime,
      avgCost,
      totalTime,
      totalCost,
      quality: config.quality,
      speed: config.speed,
      costPer1k: config.costPer1kTokens,
    };
  });

  // 按总成本排序
  modelComparisons.sort((a, b) => b.totalCost - a.totalCost);

  console.log('\n📊 模型对比表:');
  console.log('');
  console.log(
    '模型'.padEnd(20) +
    '数量'.padEnd(8) +
    '质量'.padEnd(8) +
    '速度'.padEnd(8) +
    '均价($/1K)'.padEnd(12) +
    '总成本($)'.padEnd(12) +
    '总时间(秒)'
  );
  console.log('-'.repeat(100));

  for (const comp of modelComparisons) {
    console.log(
      comp.model.padEnd(20) +
      comp.count.toString().padEnd(8) +
      comp.quality.toString().padEnd(8) +
      comp.speed.toString().padEnd(8) +
      comp.costPer1k.toFixed(6).padEnd(12) +
      comp.totalCost.toFixed(4).padEnd(12) +
      Math.round(comp.totalTime / 1000).toString()
    );
  }

  // 性价比分析
  console.log('\n💰 性价比分析:');

  // 最佳性价比 (质量 / 成本)
  const bestValue = modelComparisons.map(m => ({
    model: m.model,
    ratio: m.quality / m.avgCost,
  })).sort((a, b) => b.ratio - a.ratio)[0];

  if (bestValue) {
    console.log(`  最佳性价比: ${bestValue.model} (质量/成本 = ${bestValue.ratio.toFixed(2)})`);
  }

  // 最快速度
  const fastest = modelComparisons.reduce((a, b) => a.avgTime < b.avgTime ? a : b);
  console.log(`  最快速度: ${fastest.model} (${Math.round(fastest.avgTime / 1000)}秒)`);

  // 最低成本
  const cheapest = modelComparisons.reduce((a, b) => a.avgCost < b.avgCost ? a : b);
  console.log(`  最低成本: ${cheapest.model} ($${cheapest.avgCost.toFixed(6)} per analysis)`);
}

/**
 * 生成优化建议
 */
async function generateOptimizationSuggestions() {
  console.log('\n🎯 优化建议\n');
  console.log('=' .repeat(50));

  const metrics = metricsCollector.getAllMetrics();

  if (metrics.length === 0) {
    console.log('暂无分析数据，无法生成建议');
    return;
  }

  const suggestions: string[] = [];

  // 分析初评通过率
  const passed = metrics.filter(m => m.stage === 'preliminary' && m.success).length;
  const rejected = metrics.filter(m => m.stage === 'preliminary' && !m.success).length;

  if (passed + rejected > 0) {
    const passRate = (rejected / (passed + rejected)) * 100;
    console.log(`📌 初评过滤率: ${passRate.toFixed(1)}% (${rejected} / ${passed + rejected})`);

    if (passRate < 30) {
      suggestions.push('初评过滤率较低，可以降低 minValue 来过滤更多低质内容');
    } else if (passRate > 70) {
      suggestions.push('初评过滤率很高，考虑降低 minValue 以免过滤有价值内容');
    }
  }

  // 分析语言分布
  const byLanguage: Record<string, number> = {};
  for (const m of metrics) {
    byLanguage[m.language] = (byLanguage[m.language] || 0) + 1;
  }

  const total = Object.values(byLanguage).reduce((sum, count) => sum + count, 0);
  console.log('\n📌 语言分布:');
  for (const [lang, count] of Object.entries(byLanguage).sort((a, b) => b[1] - a[1])) {
    const percentage = (count / total * 100).toFixed(1);
    console.log(`  ${lang}: ${count} (${percentage}%)`);
  }

  // 分析短文处理
  const shortArticles = metrics.filter(m => m.contentLength <= 6000);
  const shortAvgTime = shortArticles.reduce((sum, m) => sum + m.processingTime, 0) / shortArticles.length;

  console.log(`\n📌 短文章 (≤6000字符): ${shortArticles.length} 篇`);
  console.log(`  平均处理时间: ${Math.round(shortAvgTime / 1000)}秒`);

  if (shortAvgTime > 20000) {
    suggestions.push('短文章处理时间较长，确保 SmartAnalyzer 正确处理短文');
  }

  // 输出建议
  if (suggestions.length > 0) {
    console.log('\n💡 优化建议:');
    for (let i = 0; i < suggestions.length; i++) {
      console.log(`  ${i + 1}. ${suggestions[i]}`);
    }
  } else {
    console.log('\n✅ 当前配置表现良好，暂无需要优化的地方');
  }
}

// =====================================================
// 主函数
// =====================================================

async function main() {
  console.log('==========================================');
  console.log('  AI 分析成本和性能分析');
  console.log('==========================================');

  try {
    // 成本报告
    await generateCostReport();

    // 性能报告
    await generatePerformanceReport();

    // 对比分析
    await generateComparisonReport();

    // 优化建议
    await generateOptimizationSuggestions();

    console.log('\n==========================================');
    console.log('  ✅ 分析完成');
    console.log('==========================================\n');
  } catch (error) {
    console.error('❌ 分析失败:', error);
    process.exit(1);
  }
}

// 运行分析
main();
