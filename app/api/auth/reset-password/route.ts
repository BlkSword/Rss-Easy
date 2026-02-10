/**
 * 重置密码 REST API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { info } from '@/lib/logger';

// 重置密码请求验证 schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, '重置令牌不能为空'),
  newPassword: z.string().min(6, '密码长度至少为6个字符'),
});

/**
 * POST /api/auth/reset-password
 * 使用 token 重置密码
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 验证请求数据
    const validatedData = resetPasswordSchema.parse(body);

    // 查找用户
    const user = await db.user.findUnique({
      where: { passwordResetToken: validatedData.token } as any,
    }) as any;

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

    // 哈希新密码
    const passwordHash = await hashPassword(validatedData.newPassword);

    // 更新密码并清除重置 token
    await (db.user as any).update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        passwordResetCount: 0,
      },
    });

    await info('auth', '密码已重置', { email: user.email });

    return NextResponse.json({
      success: true,
      message: '密码已成功重置，请使用新密码登录',
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

    console.error('重置密码错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
