/**
 * tRPC上下文
 * 包含数据库、用户会话等信息
 * 安全增强：支持 API Key 认证
 */

import { type inferAsyncReturnType } from '@trpc/server';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { Session } from '@/lib/auth';
import {
  validateUserApiKey,
  extractApiKeyFromHeader,
} from '@/lib/auth/user-api-key';

// 认证方式类型
export type AuthMethod = 'session' | 'api_key' | null;

/**
 * 创建tRPC上下文
 */
export async function createContext(opts?: CreateNextContextOptions) {
  // 从 cookie 中获取会话信息
  let session: Session | null = null;
  let userId: string | null = null;
  let authMethod: AuthMethod = null;
  let apiKeyId: string | null = null;
  let apiKeyScopes: string[] | null = null;

  // 从 headers 获取信息
  const headers = opts?.req?.headers;
  const csrfToken = headers?.['x-csrf-token'] as string | null ?? null;
  const authorizationHeader = headers?.['authorization'] as string | null ?? null;
  const sessionToken = authorizationHeader?.replace('Bearer ', '') ?? null;

  // 获取客户端 IP（用于速率限制）
  const ip =
    (headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (headers?.['x-real-ip'] as string) ||
    null;

  // 1. 首先尝试 API Key 认证
  const apiKey = extractApiKeyFromHeader(authorizationHeader);
  if (apiKey) {
    const apiKeyResult = await validateUserApiKey(apiKey);

    if (apiKeyResult.valid) {
      userId = apiKeyResult.userId ?? null;
      apiKeyId = apiKeyResult.apiKeyId ?? null;
      apiKeyScopes = apiKeyResult.scopes ?? null;
      authMethod = 'api_key';
    }
  }

  // 2. 如果 API Key 认证失败，尝试 Session 认证
  if (!userId) {
    try {
      session = await getSession();

      // 验证用户是否仍然存在（防止已删除用户的 token 继续使用）
      if (session?.userId) {
        const user = await db.user.findUnique({
          where: { id: session.userId },
          select: { id: true },
        });

        // 如果用户不存在，清除 session
        if (!user) {
          session = null;
        } else {
          userId = session.userId;
          authMethod = 'session';
        }
      }
    } catch {
      // Session 无效或过期
      session = null;
    }
  }

  return {
    db,
    userId,
    session,
    requestId: null as string | null,
    csrfToken,
    sessionToken,
    ip,
    authMethod,
    apiKeyId,
    apiKeyScopes,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
