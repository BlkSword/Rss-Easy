/**
 * AI分析队列启动器
 * 在应用启动时自动启动队列处理器
 */

import { AIAnalysisQueue } from './queue';

let workerInstance: AIAnalysisQueue | null = null;

export async function ensureAIWorkerStarted(): Promise<void> {
  if (workerInstance) {
    console.log('✅ AI分析队列已在运行');
    return; // 已经启动
  }

  try {
    console.log('🔧 [AI Worker] 正在启动AI分析队列...');

    // 检查环境变量 - 队列使用数据库，不需要Redis
    // const hasRedis = process.env.REDIS_URL || process.env.REDIS_HOST;
    // if (!hasRedis) {
    //   console.warn('⚠️  Redis未配置，AI分析队列不会启动');
    //   return;
    // }

    // 创建并启动队列处理器
    workerInstance = new AIAnalysisQueue({
      concurrency: parseInt(process.env.AI_QUEUE_CONCURRENCY || '3', 10),
    });

    console.log('🔧 [AI Worker] 队列实例已创建，正在启动处理器...');

    // 异步启动，不阻塞
    workerInstance.start().catch(err => {
      console.error('❌ AI队列处理错误:', err);
    });

    console.log('✅ AI分析队列已启动');
  } catch (error) {
    console.error('❌ AI分析队列启动失败:', error);
    // 不抛出错误，避免影响应用启动
  }
}
