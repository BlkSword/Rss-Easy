/**
 * 系统初始化 API
 * 用于记录系统启动日志
 * 需要认证：API 密钥
 */

import { NextRequest, NextResponse } from 'next/server';
import { info } from '@/lib/logger';
import { validateApiKey, unauthorizedResponse } from '@/lib/auth/api-auth';
import { ensureAIWorkerStarted } from '@/lib/ai/worker-bootstrap';

export async function GET(request: NextRequest) {
  // 验证 API 密钥
  if (!validateApiKey(request)) {
    return unauthorizedResponse('Valid API key required');
  }

  try {
    // 启动AI分析队列（异步，不阻塞响应）
    ensureAIWorkerStarted().catch(err => {
      console.error('启动AI队列失败:', err);
    });

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
