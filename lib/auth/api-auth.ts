/**
 * API 认证工具
 * 用于保护敏感的 API 端点
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './jwt';
import { getSession } from './session';

/**
 * 验证 API 密钥（用于 Cron Job 或系统任务）
 */
export function validateApiKey(request: NextRequest, secretName: string = 'CRON_SECRET'): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env[secretName];

  if (!expectedSecret) {
    console.warn(`${secretName} is not configured`);
    return false;
  }

  // 支持 Bearer token 格式
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1] === expectedSecret;
    }
  }

  // 支持查询参数格式
  const urlSecret = request.nextUrl.searchParams.get('secret');
  if (urlSecret) {
    return urlSecret === expectedSecret;
  }

  return false;
}

/**
 * 验证用户 JWT 认证
 */
export async function validateUserAuth(request: NextRequest): Promise<{ valid: boolean; userId?: string }> {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return { valid: false };
    }
    return { valid: true, userId: session.userId };
  } catch {
    return { valid: false };
  }
}

/**
 * 返回未授权响应
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * 验证 API 密钥或用户认证（任一即可）
 */
export async function validateApiKeyOrUser(
  request: NextRequest,
  secretName: string = 'CRON_SECRET'
): Promise<{ valid: boolean; userId?: string }> {
  // 先检查 API 密钥
  if (validateApiKey(request, secretName)) {
    return { valid: true };
  }

  // 再检查用户认证
  return validateUserAuth(request);
}
