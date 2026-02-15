/**
 * CSRF Token 获取 API
 * GET /api/auth/csrf
 *
 * 返回一个新的 CSRF Token，用于 mutation 操作
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getOrCreateCSRFToken } from '@/lib/auth/csrf';

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    // 获取或创建 CSRF Token
    // 使用 session token 作为基础
    const sessionToken = session.userId; // 简化：使用 userId 作为标识
    const csrfToken = await getOrCreateCSRFToken(sessionToken);

    return NextResponse.json({
      csrfToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1小时后过期
    });
  } catch (error) {
    console.error('[CSRF API] Error:', error);
    return NextResponse.json(
      { error: '获取 CSRF Token 失败' },
      { status: 500 }
    );
  }
}
