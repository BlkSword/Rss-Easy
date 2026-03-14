/**
 * CSRF Token 获取 API
 * GET /api/auth/csrf
 *
 * 返回一个新的 CSRF Token，用于 mutation 操作
 * 安全性：CSRF Token 绑定到实际的 session token，而不是 userId
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth/session';
import { getOrCreateCSRFToken } from '@/lib/auth/csrf';

const SESSION_COOKIE_NAME = 'session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    // 从 Cookie 中获取实际的 session token
    // 这比使用 userId 更安全，因为 Token 是唯一的且可撤销
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: '会话无效' },
        { status: 401 }
      );
    }

    // 使用 session token 作为 CSRF Token 的绑定基础
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
