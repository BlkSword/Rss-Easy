/**
 * 验证重置 Token REST API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

// 验证 token 请求验证 schema
const verifyTokenSchema = z.object({
  token: z.string().min(1, '重置令牌不能为空'),
});

/**
 * POST /api/auth/verify-reset-token
 * 验证密码重置 token 是否有效
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 验证请求数据
    const validatedData = verifyTokenSchema.parse(body);

    // 查找用户
    const user = await (db.user as any).findUnique({
      where: { passwordResetToken: validatedData.token } as any,
      select: {
        id: true,
        email: true,
        username: true,
        passwordResetExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '无效的重置链接' },
        { status: 404 }
      );
    }

    // 检查 token 是否过期
    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      return NextResponse.json(
        { success: false, message: '重置链接已过期，请重新申请' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      email: user.email,
      username: user.username,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: '请求数据无效',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('验证重置 Token 错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
