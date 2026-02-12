/**
 * CSRF Token 保护
 * 防止跨站请求伪造攻击
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const getSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET or JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
};

/**
 * 生成 CSRF Token
 */
export async function generateCSRFToken(sessionToken: string): Promise<string> {
  const secret = getSecret();

  // 使用 session Token 作为基础生成 CSRF Token
  const token = await new SignJWT({ sessionToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h') // CSRF Token 1 小时过期
    .sign(secret);

  return token;
}

/**
 * 验证 CSRF Token
 */
export async function validateCSRFToken(
  csrfToken: string,
  expectedSessionToken: string
): Promise<boolean> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(csrfToken, secret);

    // 验证 CSRF Token 中的 session Token 是否匹配
    return payload.sessionToken === expectedSessionToken;
  } catch {
    return false;
  }
}

/**
 * 获取或生成 CSRF Token
 */
export async function getOrCreateCSRFToken(sessionToken: string): Promise<string> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get('csrf_token')?.value;

  // 如果存在且有效，返回现有 Token
  if (existingToken) {
    const isValid = await validateCSRFToken(existingToken, sessionToken);
    if (isValid) {
      return existingToken;
    }
  }

  // 生成新的 CSRF Token
  const newToken = await generateCSRFToken(sessionToken);

  // 设置到 cookie
  cookieStore.set('csrf_token', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600, // 1 小时
  });

  return newToken;
}

/**
 * 清除 CSRF Token
 */
export async function clearCSRFToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('csrf_token');
}
