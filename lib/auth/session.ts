/**
 * 会话管理工具
 */

import { cookies } from 'next/headers';
import { verifyToken, type TokenPayload } from './jwt';

const SESSION_COOKIE_NAME = 'session';
const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (in seconds)

export interface Session extends TokenPayload {}

/**
 * 判断是否应该使用 secure cookie
 * 只有在 HTTPS 环境下才启用 secure
 */
function shouldUseSecureCookie(): boolean {
  // 1. 检查环境变量是否明确设置
  const secureCookieEnv = process.env.SECURE_COOKIE;
  if (secureCookieEnv !== undefined) {
    return secureCookieEnv === 'true' || secureCookieEnv === '1';
  }

  // 2. 检查 NEXTAUTH_URL 是否是 HTTPS
  const nextauthUrl = process.env.NEXTAUTH_URL;
  if (nextauthUrl?.startsWith('https://')) {
    return true;
  }

  // 3. 开发环境不使用 secure
  if (process.env.NODE_ENV === 'development') {
    return false;
  }

  // 4. 生产环境默认使用 secure（假设使用 HTTPS）
  // 但如果用户通过 HTTP 访问，浏览器会拒绝 secure cookie
  // 所以在 Docker 本地开发场景下，应该设置 SECURE_COOKIE=false
  return true;
}

/**
 * 设置会话 Cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
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
