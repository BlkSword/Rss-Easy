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
 * 密码强度等级
 */
export type PasswordStrength = 'weak' | 'medium' | 'strong';

/**
 * 验证密码强度
 * 要求：至少 8 个字符，包含字母和数字
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
  strength: PasswordStrength;
  strengthScore: number;
} {
  const errors: string[] = [];
  let strengthScore = 0;

  // 长度要求
  if (password.length < 8) {
    errors.push('密码长度至少为8个字符');
  } else if (password.length >= 12) {
    strengthScore += 2;
  } else {
    strengthScore += 1;
  }

  // 包含字母（大小写均可）
  if (!/[a-zA-Z]/.test(password)) {
    errors.push('密码必须包含字母');
  } else {
    strengthScore += 1;
  }

  // 包含数字
  if (!/\d/.test(password)) {
    errors.push('密码必须包含数字');
  } else {
    strengthScore += 1;
  }

  // 可选：包含特殊字符（加分项）
  if (/[^a-zA-Z0-9]/.test(password)) {
    strengthScore += 1;
  }

  // 包含大小写字母混合（加分项）
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    strengthScore += 1;
  }

  // 最大长度限制
  if (password.length > 128) {
    errors.push('密码长度不能超过128个字符');
  }

  // 计算强度等级
  let strength: PasswordStrength;
  if (strengthScore < 3) {
    strength = 'weak';
  } else if (strengthScore < 5) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
    strengthScore,
  };
}
