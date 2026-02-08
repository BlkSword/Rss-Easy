/**
 * 初评队列 Worker 启动脚本
 *
 * 启动 BullMQ Worker 处理初评任务
 */

import { createPreliminaryWorker, setupQueueEvents } from '../lib/queue/preliminary-processor';

// =====================================================
// Worker 配置
// =====================================================

const WORKER_CONFIG = {
  concurrency: parseInt(process.env.PRELIMINARY_WORKER_CONCURRENCY || '5', 10),
};

// =====================================================
// 启动 Worker
// =====================================================

async function startWorker() {
  console.log('==========================================');
  console.log('  初评队列 Worker 启动中...');
  console.log('==========================================\n');

  console.log('📋 配置信息:');
  console.log(`  并发数: ${WORKER_CONFIG.concurrency}`);
  console.log(`  Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
  console.log(`  中文模型: ${process.env.PRELIMINARY_MODEL_ZH || 'deepseek-chat'}`);
  console.log(`  英文模型: ${process.env.PRELIMINARY_MODEL_EN || 'gemini-1.5-flash'}`);
  console.log(`  其他模型: ${process.env.PRELIMINARY_MODEL_OTHER || 'gpt-4o-mini'}`);
  console.log(`  最低分数: ${process.env.PRELIMINARY_MIN_VALUE || '3'}\n`);

  // 设置队列事件监听
  setupQueueEvents();

  // 创建 Worker
  const worker = createPreliminaryWorker();

  console.log('✅ Worker 已启动\n');

  // Worker 事件处理
  worker.on('ready', () => {
    console.log('🎯 Worker 已就绪，等待任务...\n');
  });

  worker.on('error', (error) => {
    console.error('❌ Worker 错误:', error);
  });

  // 优雅关闭
  const shutdown = async () => {
    console.log('\n🛑 正在关闭 Worker...');
    await worker.close();
    console.log('✅ Worker 已关闭');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// 启动
startWorker().catch((error) => {
  console.error('启动 Worker 失败:', error);
  process.exit(1);
});
