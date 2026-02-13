/**
 * 用户注册 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, validatePasswordStrength, signToken, setSessionCookie } from '@/lib/auth';
import { registerRateLimiter, getClientIdentifier, rateLimitResponse } from '@/lib/security/rate-limit';
import { info, error } from '@/lib/logger';

// 注册请求验证 schema
const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  username: z
    .string()
    .min(3, '用户名至少3个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  password: z
    .string()
    .min(8, '密码长度至少为8个字符')
    .regex(/[a-zA-Z]/, '密码必须包含字母')
    .regex(/\d/, '密码必须包含数字'),
});

export async function POST(req: NextRequest) {
  try {
    // 速率限制检查
    const clientId = getClientIdentifier(req);
    const rateLimit = await registerRateLimiter.check(clientId);

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetTime);
    }

    const body = await req.json();

    // 验证请求数据
    const validatedData = registerSchema.parse(body);

    // 验证密码强度
    const passwordCheck = validatePasswordStrength(validatedData.password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: '密码强度不足', details: passwordCheck.errors },
        { status: 400 }
      );
    }

    // 检查邮箱是否已存在
    const existingEmail = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 409 }
      );
    }

    // 检查用户名是否已存在
    const existingUsername = await db.user.findUnique({
      where: { username: validatedData.username },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: '该用户名已被使用' },
        { status: 409 }
      );
    }

    // 哈希密码
    const passwordHash = await hashPassword(validatedData.password);

    // 创建用户
    const user = await db.user.create({
      data: {
        email: validatedData.email,
        username: validatedData.username,
        passwordHash,
        preferences: {
          theme: 'system',
          language: 'zh-CN',
          itemsPerPage: 20,
        },
        aiConfig: {
          // 用户需要在设置中自行配置 AI
          enableSummary: true,
          enableCategory: true,
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        preferences: true,
        aiConfig: true,
        createdAt: true,
      },
    });

    // 生成 JWT token
    const token = await signToken({
      userId: user.id,
      email: user.email,
    });

    // 设置会话 cookie
    await setSessionCookie(token);

    return NextResponse.json(
      {
        success: true,
        user,
        token,
      },
      { status: 201 }
    );
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

    console.error('注册错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
