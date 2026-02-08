/**
 * 深度分析队列 Worker 启动脚本
 *
 * 启动 BullMQ Worker 处理深度分析任务
 */

import { createDeepAnalysisWorker } from '../lib/queue/deep-analysis-processor';

async function main() {
  console.log('=== AI-Native 深度分析队列处理器 ===\n');

  // 创建 Worker
  const worker = createDeepAnalysisWorker();

  console.log('✓ Worker 已启动');
  console.log('  队列: deep-analysis');
  console.log('  并发数: 3');
  console.log('  监听中...\n');

  // 监听事件
  worker.on('completed', (job: any, result: any) => {
    console.log(`✓ 任务完成: ${job.id}`);
    console.log(`  文章ID: ${job.data.entryId}`);
    if (result?.analysisResult) {
      console.log(`  分析评分: ${result.analysisResult.aiScore}/10`);
      console.log(`  处理时间: ${result.analysisResult.processingTime}ms`);
    }
    console.log();
  });

  worker.on('failed', (job: any, error: Error) => {
    console.error(`✗ 任务失败: ${job?.id}`);
    console.error(`  文章ID: ${job?.data?.entryId}`);
    console.error(`  错误: ${error.message}`);
    console.error();
  });

  worker.on('progress' as any, (job: { id: string }, progress: number) => {
    console.log(`→ 任务进度: ${job.id} - ${progress}%`);
  });

  // 优雅关闭
  const shutdown = async (signal: string) => {
    console.log(`\n收到 ${signal} 信号，正在关闭 Worker...`);
    await worker.close();
    console.log('✓ Worker 已关闭');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 保持运行
  console.log('按 Ctrl+C 停止\n');
}

main().catch(error => {
  console.error('启动失败:', error);
  process.exit(1);
});
