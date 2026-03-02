/**
 * 系统初始化 API
 * POST /api/admin/init - 执行系统初始化
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initializeSystem, isSystemInitialized, clearInitializationCache } from '@/lib/system/init-check';
import { info, error } from '@/lib/logger';

const initSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(8).regex(/[a-zA-Z]/).regex(/\d/),
  systemName: z.string().min(1).max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 检查是否已初始化
    const alreadyInitialized = await isSystemInitialized();
    if (alreadyInitialized) {
      return NextResponse.json(
        { success: false, error: '系统已完成初始化' },
        { status: 400 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validated = initSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: '参数验证失败', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    // 执行初始化
    const result = await initializeSystem(validated.data);

    if (result.success) {
      await info('system', '系统初始化成功', { userId: result.userId });

      // 创建响应并设置 cookie 标记初始化完成
      const response = NextResponse.json({
        success: true,
        userId: result.userId,
      });

      // 设置一个长期 cookie 标记系统已初始化（用于 middleware 快速检查）
      response.cookies.set('sys_init', '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365 * 10, // 10 年
        path: '/',
      });

      return response;
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (err) {
    await error('system', '系统初始化 API 失败', err instanceof Error ? err : undefined);

    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 禁用 GET 请求
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
