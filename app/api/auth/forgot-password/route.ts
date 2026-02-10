/**
 * 忘记密码 REST API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createEmailServiceFromUser, createSystemEmailService } from '@/lib/email/service';
import { info, warn, error } from '@/lib/logger';
import { randomBytes } from 'crypto';

// 请求验证 schema
const forgotPasswordSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

/**
 * POST /api/auth/forgot-password
 * 请求密码重置
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 验证请求数据
    const validatedData = forgotPasswordSchema.parse(body);

    // 查找用户
    const user = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    // 无论用户是否存在都返回成功，防止邮箱枚举攻击
    if (!user) {
      await info('auth', '密码重置请求（用户不存在）', { email: validatedData.email });
      return NextResponse.json({
        success: true,
        message: '如果该邮箱已注册，您将收到密码重置邮件',
      });
    }

    // 检查是否在24小时内请求超过3次
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const resetCount = (user as any).passwordResetCount || 0;
    const existingResetExpiresAt = (user as any).passwordResetExpiresAt;

    if (resetCount >= 3 && existingResetExpiresAt && existingResetExpiresAt > oneDayAgo) {
      await warn('auth', '密码重置请求过于频繁', { email: validatedData.email, count: resetCount });
      return NextResponse.json({
        success: true,
        message: '请求过于频繁，请稍后再试',
      });
    }

    // 生成重置 token
    const resetToken = randomBytes(32).toString('hex');
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期

    // 更新用户记录
    await (db.user as any).update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: resetExpiresAt,
        passwordResetCount: resetCount + 1,
      },
    });

    // 发送密码重置邮件
    try {
      // 优先使用用户配置的邮件服务
      let emailService = createEmailServiceFromUser(user.emailConfig);

      // 如果用户没有配置，使用系统默认邮件服务
      if (!emailService) {
        emailService = createSystemEmailService();
      }

      if (emailService) {
        const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
        await emailService.sendPasswordResetEmail(user.email, user.username, resetUrl, '1小时');
        await info('auth', '密码重置邮件已发送', { email: user.email });
      } else {
        await error('auth', '邮件服务未配置', undefined, { email: user.email });
        return NextResponse.json(
          { success: false, message: '邮件服务未配置，请联系管理员' },
          { status: 500 }
        );
      }
    } catch (err: any) {
      await error('auth', '发送密码重置邮件失败', err, { email: user.email });
      return NextResponse.json(
        { success: false, message: '发送邮件失败，请稍后重试' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '如果该邮箱已注册，您将收到密码重置邮件',
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

    console.error('忘记密码请求错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
