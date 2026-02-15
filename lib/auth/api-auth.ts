/**
 * API 认证工具
 * 用于保护敏感的 API 端点
 * 安全增强：支持用户 API Key 认证
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './jwt';
import { getSession } from './session';
import {
  validateUserApiKey,
  extractApiKeyFromHeader,
  type ApiKeyScope,
} from './user-api-key';

// 认证结果类型
export interface AuthResult {
  valid: boolean;
  userId?: string;
  authMethod?: 'session' | 'api_key' | 'system';
  apiKeyId?: string;
  scopes?: string[];
}

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
export async function validateUserAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return { valid: false };
    }
    return {
      valid: true,
      userId: session.userId,
      authMethod: 'session',
    };
  } catch {
    return { valid: false };
  }
}

/**
 * 验证用户 API Key
 */
export async function validateApiKeyAuth(
  request: NextRequest,
  requiredScopes?: ApiKeyScope[]
): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  const apiKey = extractApiKeyFromHeader(authHeader);

  if (!apiKey) {
    return { valid: false };
  }

  const result = await validateUserApiKey(apiKey, requiredScopes);

  if (!result.valid) {
    return { valid: false };
  }

  return {
    valid: true,
    userId: result.userId,
    authMethod: 'api_key',
    apiKeyId: result.apiKeyId,
    scopes: result.scopes,
  };
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
 * 安全增强：支持用户 API Key
 */
export async function validateApiKeyOrUser(
  request: NextRequest,
  secretName: string = 'CRON_SECRET',
  options?: {
    requiredScopes?: ApiKeyScope[];
  }
): Promise<AuthResult> {
  // 1. 先检查系统 API 密钥
  if (validateApiKey(request, secretName)) {
    return {
      valid: true,
      authMethod: 'system',
    };
  }

  // 2. 检查用户 API Key
  const apiKeyResult = await validateApiKeyAuth(request, options?.requiredScopes);
  if (apiKeyResult.valid) {
    return apiKeyResult;
  }

  // 3. 检查用户 Session
  return validateUserAuth(request);
}

/**
 * 验证用户 API Key 或 Session（不支持系统密钥）
 * 用于需要用户身份的 API
 */
export async function validateUserOrApiKey(
  request: NextRequest,
  options?: {
    requiredScopes?: ApiKeyScope[];
  }
): Promise<AuthResult> {
  // 1. 检查用户 API Key
  const apiKeyResult = await validateApiKeyAuth(request, options?.requiredScopes);
  if (apiKeyResult.valid) {
    return apiKeyResult;
  }

  // 2. 检查用户 Session
  return validateUserAuth(request);
}
