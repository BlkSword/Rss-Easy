/**
 * 用户登录 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword, signToken, setSessionCookie } from '@/lib/auth';
import { loginRateLimiter, getClientIdentifier, rateLimitResponse } from '@/lib/security/rate-limit';
import { error } from '@/lib/logger';

// 登录请求验证 schema
const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

export async function POST(req: NextRequest) {
  try {
    // 速率限制检查
    const clientId = getClientIdentifier(req);
    const rateLimit = await loginRateLimiter.check(clientId);

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime);
    }

    const body = await req.json();

    // 验证请求数据
    const validatedData = loginSchema.parse(body);

    // 查找用户
    const user = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码
    const isValidPassword = await verifyPassword(
      validatedData.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    // 生成 JWT token
    const token = await signToken({
      userId: user.id,
      email: user.email,
    });

    // 设置会话 cookie
    await setSessionCookie(token);

    // 返回用户信息（不包含敏感数据）
    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: '请求数据无效',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('登录错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
