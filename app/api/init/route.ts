/**
 * 系统初始化 API
 * 用于记录系统启动日志
 * 需要认证：API 密钥
 */

import { NextRequest, NextResponse } from 'next/server';
import { info } from '@/lib/logger';
import { validateApiKey, unauthorizedResponse } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  // 验证 API 密钥
  if (!validateApiKey(request)) {
    return unauthorizedResponse('Valid API key required');
  }

  try {
    // 注意：AI 分析队列现在通过独立的 Docker Worker 容器运行
    // preliminary-worker, deep-analysis-worker, feed-discovery-worker
    // 不再在主应用中启动队列处理器

    // 记录系统启动日志
    await info('system', '系统初始化完成', {
      version: process.env.npm_package_version || '1.0.0',
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: '系统初始化完成',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('系统初始化失败:', err);
    return NextResponse.json(
      { success: false, message: '初始化失败' },
      { status: 500 }
    );
  }
}
