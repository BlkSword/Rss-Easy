/**
 * 密码处理工具
 */

import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * 哈希密码
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 验证密码强度（仅基础验证）
 * 注意：前端仍会显示密码强度指示器供用户参考
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push('密码长度至少为6个字符');
  }

  if (password.length > 128) {
    errors.push('密码长度不能超过128个字符');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
