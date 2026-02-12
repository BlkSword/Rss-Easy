/**
 * 手动触发调度器 API
 * 需要认证：API 密钥或用户登录
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/lib/jobs/scheduler';
import { validateApiKeyOrUser, unauthorizedResponse } from '@/lib/auth/api-auth';

export async function POST(request: NextRequest) {
  // 验证认证
  const auth = await validateApiKeyOrUser(request);
  if (!auth.valid) {
    return unauthorizedResponse('API key or user authentication required');
  }

  try {
    const body = await request.json();
    const { type = 'fetch' } = body;

    const scheduler = getScheduler();

    if (type === 'fetch') {
      await scheduler.triggerFetch();
    } else if (type === 'ai') {
      await scheduler.triggerAIProcess();
    } else if (type === 'both') {
      await scheduler.triggerFetch();
      await scheduler.triggerAIProcess();
    }

    return NextResponse.json({
      success: true,
      message: `Triggered ${type} cycle`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
