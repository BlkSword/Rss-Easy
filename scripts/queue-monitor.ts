#!/usr/bin/env tsx
/**
 * BullMQ 队列监控和管理工具
 *
 * 统一管理所有三个 BullMQ 队列：
 * - Feed Discovery (订阅源发现)
 * - Preliminary (初评)
 * - Deep Analysis (深度分析)
 *
 * 用法:
 *   npm run queue:monitor          # 查看所有队列状态
 *   npm run queue:monitor -- watch # 持续监控（每5秒刷新）
 *   npm run queue:monitor -- clear # 清空所有队列
 *
 * 通过 npm run queue 的命令:
 *   npm run queue status           # 查看所有队列状态
 *   npm run queue add <entryId>    # 添加深度分析任务
 *   npm run queue add-batch 50     # 批量添加深度分析任务
 *   npm run queue retry 10         # 重试深度分析失败任务
 */

import { db } from '../lib/db';
import {
  getQueueStatus as getPreliminaryQueueStatus,
  clearQueue as clearPreliminaryQueue,
  addPreliminaryJob,
} from '@/lib/queue/preliminary-processor';
import {
  getQueueStatus as getDeepAnalysisQueueStatus,
  clearQueue as clearDeepAnalysisQueue,
  addDeepAnalysisJob,
  addDeepAnalysisJobsBatch,
  getJobState,
  retryFailedJobs,
} from '@/lib/queue/deep-analysis-processor';
import {
  getFeedDiscoveryQueueStatus,
  clearFeedDiscoveryQueue,
} from '@/lib/queue/feed-discovery-processor';

const args = process.argv.slice(2);
const command = args[0];
const isWatchMode = args.includes('watch');
const shouldClear = args.includes('clear');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return colors.green;
    case 'warning':
      return colors.yellow;
    case 'error':
      return colors.red;
    default:
      return colors.reset;
  }
}

function getQueueHealth(status: {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}): 'healthy' | 'warning' | 'error' {
  if (status.failed > 10) return 'error';
  if (status.failed > 0 || status.waiting > 100) return 'warning';
  return 'healthy';
}

async function getAllQueueStatus() {
  const [feedDiscovery, preliminary, deepAnalysis] = await Promise.all([
    getFeedDiscoveryQueueStatus().catch(() => null),
    getPreliminaryQueueStatus().catch(() => null),
    getDeepAnalysisQueueStatus().catch(() => null),
  ]);

  return { feedDiscovery, preliminary, deepAnalysis };
}

function printQueueStatus(
  name: string,
  status: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null
) {
  if (!status) {
    console.log(`  ${colors.red}✗ ${name}: 无法连接${colors.reset}`);
    return;
  }

  const health = getQueueHealth(status);
  const healthColor = getStatusColor(health);
  const total = status.waiting + status.active + status.completed + status.failed;

  console.log(`  ${healthColor}● ${name}${colors.reset}`);
  console.log(`    ├─ 等待中: ${formatNumber(status.waiting)}`);
  console.log(`    ├─ 处理中: ${formatNumber(status.active)}`);
  console.log(`    ├─ 已完成: ${formatNumber(status.completed)}`);
  console.log(`    ├─ 失败: ${formatNumber(status.failed)}`);
  console.log(`    ├─ 延迟: ${formatNumber(status.delayed)}`);
  console.log(`    └─ 总计: ${formatNumber(total)}`);
}

async function clearAllQueues() {
  console.log(`\n${colors.yellow}⚠ 清空所有队列...${colors.reset}\n`);

  try {
    await Promise.all([
      clearFeedDiscoveryQueue(),
      clearPreliminaryQueue(),
      clearDeepAnalysisQueue(),
    ]);
    console.log(`${colors.green}✓ 所有队列已清空${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}✗ 清空队列失败:${colors.reset}`, error);
  }
}

async function showStatus() {
  // 清屏（仅在 watch 模式下）
  if (isWatchMode) {
    console.clear();
  }

  console.log(`\n${colors.bright}${colors.cyan}=== BullMQ 队列监控 ===${colors.reset}\n`);
  console.log(`时间: ${new Date().toLocaleString()}\n`);

  try {
    const status = await getAllQueueStatus();

    console.log(`${colors.bright}队列状态:${colors.reset}\n`);
    printQueueStatus('Feed Discovery (订阅源发现)', status.feedDiscovery);
    console.log();
    printQueueStatus('Preliminary (初评)', status.preliminary);
    console.log();
    printQueueStatus('Deep Analysis (深度分析)', status.deepAnalysis);

    // 计算汇总
    const totalWaiting =
      (status.feedDiscovery?.waiting || 0) +
      (status.preliminary?.waiting || 0) +
      (status.deepAnalysis?.waiting || 0);
    const totalActive =
      (status.feedDiscovery?.active || 0) +
      (status.preliminary?.active || 0) +
      (status.deepAnalysis?.active || 0);
    const totalFailed =
      (status.feedDiscovery?.failed || 0) +
      (status.preliminary?.failed || 0) +
      (status.deepAnalysis?.failed || 0);

    console.log(`\n${colors.bright}汇总:${colors.reset}`);
    console.log(`  ├─ 总等待: ${formatNumber(totalWaiting)}`);
    console.log(`  ├─ 总处理中: ${formatNumber(totalActive)}`);
    console.log(`  └─ 总失败: ${formatNumber(totalFailed)}`);

    // 系统健康状态
    const overallHealth =
      totalFailed > 30 ? 'error' : totalFailed > 10 || totalWaiting > 500 ? 'warning' : 'healthy';
    const healthColor = getStatusColor(overallHealth);

    console.log(`\n${colors.bright}系统状态:${colors.reset} ${healthColor}${overallHealth.toUpperCase()}${colors.reset}`);

    if (overallHealth === 'healthy') {
      console.log('  所有队列运行正常');
    } else if (overallHealth === 'warning') {
      console.log('  存在一些问题，请关注');
    } else {
      console.log('  存在严重问题，请立即处理');
    }

    if (isWatchMode) {
      console.log(`\n${colors.cyan}按 Ctrl+C 退出${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}✗ 获取队列状态失败:${colors.reset}`, error);
    console.log('\n请确保 Redis 正在运行且连接配置正确。');
  }
}

// =====================================================
// 深度分析队列管理命令（兼容原有 queue-manager）
// =====================================================

async function addDeepAnalysisTask() {
  const entryId = args[1];
  const priority = args[2] ? parseInt(args[2]) : 5;

  if (!entryId) {
    console.error(`${colors.red}❌ 请提供文章ID${colors.reset}`);
    console.log('用法: npm run queue add <entryId> [priority]');
    process.exit(1);
  }

  // 检查文章是否存在
  const entry = await db.entry.findUnique({
    where: { id: entryId },
    select: { id: true, title: true },
  });

  if (!entry) {
    console.error(`${colors.red}❌ 文章不存在: ${entryId}${colors.reset}`);
    process.exit(1);
  }

  const jobId = await addDeepAnalysisJob({
    entryId,
    priority,
  });

  console.log(`${colors.green}✓ 任务已添加${colors.reset}`);
  console.log(`  任务ID: ${jobId}`);
  console.log(`  文章: ${entry.title}`);
  console.log(`  优先级: ${priority}`);
  console.log();
}

async function addDeepAnalysisBatch() {
  const limit = args[1] ? parseInt(args[1]) : 10;
  const priority = args[2] ? parseInt(args[2]) : 5;

  console.log(`查找未分析的文章（最多 ${limit} 篇）...`);

  const entries = await db.entry.findMany({
    where: {
      content: { not: null },
      OR: [
        { aiAnalyzedAt: null },
        { aiReflectionRounds: 0 },
      ],
    },
    select: {
      id: true,
      title: true,
    },
    take: limit,
  });

  if (entries.length === 0) {
    console.log('没有找到需要分析的文章');
    return;
  }

  console.log(`找到 ${entries.length} 篇文章\n`);

  const jobIds = await addDeepAnalysisJobsBatch(
    entries.map(entry => ({
      entryId: entry.id,
      priority,
    }))
  );

  console.log(`${colors.green}✓ 已添加 ${jobIds.length} 个任务${colors.reset}`);
  jobIds.forEach((jobId, i) => {
    console.log(`  ${i + 1}. ${jobId} - ${entries[i].title}`);
  });
  console.log();
}

async function showJobStatus() {
  const jobId = args[1];

  if (!jobId) {
    console.error(`${colors.red}❌ 请提供任务ID${colors.reset}`);
    console.log('用法: npm run queue job <jobId>');
    process.exit(1);
  }

  const jobState = await getJobState(jobId);

  if (!jobState) {
    console.error(`${colors.red}❌ 任务不存在: ${jobId}${colors.reset}`);
    process.exit(1);
  }

  console.log('任务状态:');
  console.log(`  ID: ${jobState.id}`);
  console.log(`  状态: ${jobState.state}`);
  console.log(`  进度: ${jobState.progress}%`);
  console.log(`  数据: ${JSON.stringify(jobState.data)}`);
  if (jobState.processedOn) {
    console.log(`  开始时间: ${new Date(jobState.processedOn).toLocaleString()}`);
  }
  if (jobState.finishedOn) {
    console.log(`  完成时间: ${new Date(jobState.finishedOn).toLocaleString()}`);
  }
  if (jobState.failedReason) {
    console.log(`  失败原因: ${jobState.failedReason}`);
  }
  console.log();
}

async function retryDeepAnalysisJobs() {
  const limit = args[1] ? parseInt(args[1]) : 10;

  console.log(`重试深度分析失败任务（最多 ${limit} 个）...`);

  const retried = await retryFailedJobs(limit);

  console.log(`${colors.green}✓ 已重试 ${retried} 个任务${colors.reset}`);
  console.log();
}

function showHelp() {
  console.log(`\n${colors.bright}${colors.cyan}=== BullMQ 队列管理工具 ===${colors.reset}\n`);
  console.log('用法: npm run queue <command> [args]\n');
  console.log(`${colors.bright}监控命令:${colors.reset}`);
  console.log('  status              显示所有队列状态');
  console.log('  monitor             显示所有队列状态（同 status）');
  console.log('  monitor watch       持续监控（每5秒刷新）');
  console.log('  monitor clear       清空所有队列');
  console.log();
  console.log(`${colors.bright}深度分析队列管理:${colors.reset}`);
  console.log('  add <entryId> [prio] 添加单个分析任务');
  console.log('  add-batch [limit] [prio] 批量添加任务');
  console.log('  job <jobId>         显示任务状态');
  console.log('  retry [limit]       重试失败的任务');
  console.log();
  console.log(`${colors.bright}示例:${colors.reset}`);
  console.log('  npm run queue status');
  console.log('  npm run queue monitor watch');
  console.log('  npm run queue add entry-123 5');
  console.log('  npm run queue add-batch 20 3');
  console.log('  npm run queue retry 10\n');
}

async function main() {
  // 监控模式
  if (isWatchMode || shouldClear) {
    if (shouldClear) {
      await clearAllQueues();
      return;
    }

    if (isWatchMode) {
      await showStatus();
      setInterval(showStatus, 5000);
    }
    return;
  }

  // 命令模式
  switch (command) {
    case 'status':
    case 'monitor':
      await showStatus();
      break;

    case 'add':
      await addDeepAnalysisTask();
      break;

    case 'add-batch':
      await addDeepAnalysisBatch();
      break;

    case 'job':
      await showJobStatus();
      break;

    case 'retry':
      await retryDeepAnalysisJobs();
      break;

    case 'clear':
      await clearAllQueues();
      break;

    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch(console.error);
