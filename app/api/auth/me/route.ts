/**
 * 获取当前用户信息 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'session';

export async function GET(req: NextRequest) {
  try {
    // 获取当前会话
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    // 查询用户信息
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        preferences: true,
        aiConfig: true,
        createdAt: true,
        updatedAt: true,
        // 统计信息
        _count: {
          select: {
            feeds: true,
            categories: true,
          },
        },
      },
    });

    // 用户不存在（可能已被注销），清除 session 并返回 401
    if (!user) {
      const response = NextResponse.json(
        { error: '用户不存在或已被注销' },
        { status: 401 }
      );

      // 清除 session cookie
      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE_NAME);

      return response;
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
