/**
 * tRPC上下文
 * 包含数据库、用户会话等信息
 */

import { type inferAsyncReturnType } from '@trpc/server';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { Session } from '@/lib/auth';

/**
 * 创建tRPC上下文
 */
export async function createContext(opts?: CreateNextContextOptions) {
  // 从 cookie 中获取会话信息
  let session: Session | null = null;

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
      }
    }
  } catch {
    // Session 无效或过期
    session = null;
  }

  // 从 headers 中获取 CSRF Token
  const headers = opts?.req?.headers;
  const csrfToken = headers?.['x-csrf-token'] as string | null ?? null;
  const authorizationHeader = headers?.['authorization'] as string | null ?? null;
  const sessionToken = authorizationHeader?.replace('Bearer ', '') ?? null;

  return {
    db,
    userId: session?.userId || null,
    session,
    requestId: null as string | null,
    csrfToken,
    sessionToken,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
