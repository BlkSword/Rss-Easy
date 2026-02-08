/**
 * 队列管理工具
 *
 * 用于管理深度分析队列
 */

import { db } from '../lib/db';
import {
  addDeepAnalysisJob,
  addDeepAnalysisJobsBatch,
  getQueueStatus,
  getJobState,
  retryFailedJobs,
  type DeepAnalysisJobData,
} from '../lib/queue/deep-analysis-processor';

// 从命令行获取参数
const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  console.log('=== AI-Native 队列管理工具 ===\n');

  switch (command) {
    case 'status':
      await showStatus();
      break;

    case 'add':
      await addJob();
      break;

    case 'add-batch':
      await addBatch();
      break;

    case 'job':
      await showJob();
      break;

    case 'retry':
      await retryFailed();
      break;

    case 'help':
    default:
      showHelp();
      break;
  }
}

/**
 * 显示队列状态
 */
async function showStatus() {
  const status = await getQueueStatus();

  console.log('队列状态:');
  console.log(`  等待中: ${status.waiting}`);
  console.log(`  处理中: ${status.active}`);
  console.log(`  已完成: ${status.completed}`);
  console.log(`  失败: ${status.failed}`);
  console.log();
}

/**
 * 添加单个任务
 */
async function addJob() {
  const entryId = args[0];
  const priority = args[1] ? parseInt(args[1]) : 5;

  if (!entryId) {
    console.error('❌ 请提供文章ID');
    console.log('用法: npm run queue add <entryId> [priority]');
    process.exit(1);
  }

  // 检查文章是否存在
  const entry = await db.entry.findUnique({
    where: { id: entryId },
    select: { id: true, title: true },
  });

  if (!entry) {
    console.error(`❌ 文章不存在: ${entryId}`);
    process.exit(1);
  }

  const jobId = await addDeepAnalysisJob({
    entryId,
    priority,
  });

  console.log(`✓ 任务已添加`);
  console.log(`  任务ID: ${jobId}`);
  console.log(`  文章: ${entry.title}`);
  console.log(`  优先级: ${priority}`);
  console.log();
}

/**
 * 批量添加任务
 */
async function addBatch() {
  const limit = args[0] ? parseInt(args[0]) : 10;
  const priority = args[1] ? parseInt(args[1]) : 5;

  console.log(`查找未分析的文章（最多 ${limit} 篇）...`);

  const entries = await db.entry.findMany({
    where: {
      content: {
        not: null,
      },
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

  console.log(`✓ 已添加 ${jobIds.length} 个任务`);
  jobIds.forEach((jobId, i) => {
    console.log(`  ${i + 1}. ${jobId} - ${entries[i].title}`);
  });
  console.log();
}

/**
 * 显示任务状态
 */
async function showJob() {
  const jobId = args[0];

  if (!jobId) {
    console.error('❌ 请提供任务ID');
    console.log('用法: npm run queue job <jobId>');
    process.exit(1);
  }

  const jobState = await getJobState(jobId);

  if (!jobState) {
    console.error(`❌ 任务不存在: ${jobId}`);
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

/**
 * 重试失败任务
 */
async function retryFailed() {
  const limit = args[0] ? parseInt(args[0]) : 10;

  console.log(`重试失败任务（最多 ${limit} 个）...`);

  const retried = await retryFailedJobs(limit);

  console.log(`✓ 已重试 ${retried} 个任务`);
  console.log();
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('用法: npm run queue <command> [args]\n');
  console.log('命令:');
  console.log('  status              显示队列状态');
  console.log('  add <entryId> [prio] 添加单个分析任务');
  console.log('  add-batch [limit] [prio] 批量添加任务');
  console.log('  job <jobId>         显示任务状态');
  console.log('  retry [limit]       重试失败的任务');
  console.log('  help                显示此帮助信息\n');
  console.log('示例:');
  console.log('  npm run queue status');
  console.log('  npm run queue add entry-123 5');
  console.log('  npm run queue add-batch 20 3');
  console.log('  npm run queue job job-456');
  console.log('  npm run queue retry 5\n');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('错误:', error);
    process.exit(1);
  });
