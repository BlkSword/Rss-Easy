/**
 * 调度器状态 API
 * 需要认证：API 密钥或用户登录
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/lib/jobs/scheduler';
import { validateApiKeyOrUser, unauthorizedResponse } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  // 验证认证
  const auth = await validateApiKeyOrUser(request);
  if (!auth.valid) {
    return unauthorizedResponse('API key or user authentication required');
  }

  try {
    const scheduler = getScheduler();
    const status = scheduler.getStatus();

    return NextResponse.json({
      success: true,
      ...status,
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
