/**
 * AI分析测试 API
 * 用于测试AI功能是否正常工作
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkAIConfig, getUserAIConfig } from '@/lib/ai/health-check';
import { getDefaultAIService } from '@/lib/ai/client';
import { getSession } from '@/lib/auth/session';
import { info, error } from '@/lib/logger';

const testSchema = z.object({
  text: z.string().min(10, '测试文本至少10个字符'),
});

export async function POST(request: NextRequest) {
  try {
    // 获取用户会话
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, message: '未登录' },
        { status: 401 }
      );
    }

    // 获取用户
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { aiConfig: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '用户不存在' },
        { status: 404 }
      );
    }

    const aiConfig = (user.aiConfig as any) || {};

    // 检查配置是否有效
    if (!aiConfig.configValid) {
      return NextResponse.json({
        success: false,
        message: 'AI配置未验证，请先在设置中测试AI连接',
      });
    }

    // 解析请求
    const body = await request.json();
    const { text } = testSchema.parse(body);

    // 获取用户的 AI 配置（包括解密后的 API 密钥）
    const userAIConfig = await getUserAIConfig(session.userId, db);

    // 测试AI分析 - 使用用户配置
    const startTime = Date.now();
    const aiService = getDefaultAIService(userAIConfig || undefined);

    const result = await aiService.analyzeArticle(text, {
      summary: true,
      keywords: true,
      category: true,
      sentiment: true,
      importance: true,
    });

    const duration = Date.now() - startTime;

    await info('ai', 'AI分析测试成功', {
      userId: session.userId,
      duration,
      hasSummary: !!result.summary,
      hasKeywords: !!result.keywords,
      hasCategory: !!result.category,
    });

    return NextResponse.json({
      success: true,
      message: 'AI分析测试成功',
      result: {
        summary: result.summary,
        keywords: result.keywords,
        category: result.category,
        sentiment: result.sentiment,
        importanceScore: result.importanceScore,
      },
      duration: `${duration}ms`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: '请求数据无效',
          details: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 }
      );
    }

    await error('ai', 'AI分析测试失败', err instanceof Error ? err : undefined);

    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'AI分析测试失败',
      },
      { status: 500 }
    );
  }
}
