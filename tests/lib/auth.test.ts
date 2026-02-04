/**
 * Auth 测试
 */

import { describe, it, expect } from '@jest/globals';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { signToken, verifyToken } from '@/lib/auth/jwt';

describe('Password', () => {
  it('should hash password correctly', async () => {
    const password = 'testPassword123';
    const hash = await hashPassword(password);

    expect(hash).toBeTruthy();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('should verify correct password', async () => {
    const password = 'testPassword123';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);

    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'testPassword123';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword('wrongPassword', hash);

    expect(isValid).toBe(false);
  });

  it('should generate different hashes for same password', async () => {
    const password = 'testPassword123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });
});

describe('JWT', () => {
  it('should sign and verify token', async () => {
    const payload = { userId: 'user-123', email: 'test@example.com' };
    const token = await signToken(payload);
    const decoded = await verifyToken(token);

    expect(decoded).toBeTruthy();
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('should reject invalid token', async () => {
    const invalidToken = 'invalid.jwt.token';

    await expect(verifyToken(invalidToken)).rejects.toThrow();
  });

  it('should reject expired token', async () => {
    // 创建一个已过期的 token（使用负的过期时间）
    const payload = { userId: 'user-123' };
    const secret = process.env.NEXTAUTH_SECRET || 'test-secret';

    // 使用 jose 创建过期 token
    const { SignJWT } = await import('jose');
    const expiredToken = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 1000) // 1000秒前签发
      .setExpirationTime(Math.floor(Date.now() / 1000) - 500) // 500秒前过期
      .sign(new TextEncoder().encode(secret));

    await expect(verifyToken(expiredToken)).rejects.toThrow();
  });
});
