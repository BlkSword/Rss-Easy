/**
 * 会话管理工具
 */

import { cookies } from 'next/headers';
import { verifyToken, type TokenPayload } from './jwt';

const SESSION_COOKIE_NAME = 'session';
const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (in seconds)

export interface Session extends TokenPayload {}

/**
 * 设置会话 Cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * 获取当前会话
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const payload = await verifyToken(token);
    return payload;
  } catch {
    return null;
  }
}

/**
 * 清除会话 Cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * 验证用户是否已认证
 */
export async function requireAuth(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}
