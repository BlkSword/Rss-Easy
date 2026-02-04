/**
 * JWT Token 处理工具
 */

import { SignJWT, jwtVerify } from 'jose';

const getSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET or JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
};

export interface TokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * 签发 JWT Token
 */
export async function signToken(payload: {
  userId: string;
  email: string;
}): Promise<string> {
  const secret = getSecret();

  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

/**
 * 验证 JWT Token
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * 从请求头中提取 Token
 */
export function extractTokenFromHeader(
  authorization: string | null
): string | null {
  if (!authorization) return null;

  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
