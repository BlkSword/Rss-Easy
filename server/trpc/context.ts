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
  } catch {
    // Session 无效或过期
    session = null;
  }

  return {
    db,
    userId: session?.userId || null,
    session,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
