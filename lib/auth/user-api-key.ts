/**
 * 用户 API Key 验证模块
 *
 * 验证用户创建的 API Key（格式：rss_xxx）
 * - Key 哈希验证（SHA-256）
 * - 权限范围检查
 * - 过期时间检查
 * - 使用记录更新
 */

import { createHash } from 'crypto';
import { db } from '@/lib/db';

// API Key 前缀
export const API_KEY_PREFIX = 'rss_';

// 支持的权限范围
export type ApiKeyScope = 'read' | 'write' | 'admin';

// API Key 验证结果
export interface ApiKeyValidationResult {
  valid: boolean;
  userId?: string;
  apiKeyId?: string;
  scopes?: string[];
  error?: string;
}

// API Key 信息（不包含敏感数据）
export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

/**
 * 计算 API Key 的哈希值
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * 验证 API Key 格式
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // 检查前缀
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return false;
  }

  // 检查格式：rss_ + 64 位十六进制
  const keyPart = apiKey.slice(API_KEY_PREFIX.length);
  return /^[a-f0-9]{64}$/i.test(keyPart);
}

/**
 * 验证用户 API Key
 *
 * @param apiKey API Key（格式：rss_xxx）
 * @param requiredScopes 需要的权限范围（可选）
 * @returns 验证结果
 */
export async function validateUserApiKey(
  apiKey: string,
  requiredScopes?: ApiKeyScope[]
): Promise<ApiKeyValidationResult> {
  // 验证格式
  if (!isValidApiKeyFormat(apiKey)) {
    return {
      valid: false,
      error: '无效的 API Key 格式',
    };
  }

  try {
    // 计算哈希
    const keyHash = hashApiKey(apiKey);

    // 查找 API Key
    const apiKeyRecord = await db.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        userId: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
      },
    });

    // Key 不存在
    if (!apiKeyRecord) {
      return {
        valid: false,
        error: 'API Key 不存在',
      };
    }

    // 检查是否激活
    if (!apiKeyRecord.isActive) {
      return {
        valid: false,
        error: 'API Key 已被禁用',
      };
    }

    // 检查是否过期
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      return {
        valid: false,
        error: 'API Key 已过期',
      };
    }

    // 检查权限范围
    if (requiredScopes && requiredScopes.length > 0) {
      const hasAllScopes = requiredScopes.every(scope =>
        apiKeyRecord.scopes.includes(scope)
      );

      if (!hasAllScopes) {
        return {
          valid: false,
          error: '权限不足',
        };
      }
    }

    // 更新最后使用时间（异步，不阻塞）
    db.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(err => {
      console.error('[UserApiKey] Failed to update lastUsedAt:', err);
    });

    return {
      valid: true,
      userId: apiKeyRecord.userId,
      apiKeyId: apiKeyRecord.id,
      scopes: apiKeyRecord.scopes,
    };
  } catch (error) {
    console.error('[UserApiKey] Validation error:', error);
    return {
      valid: false,
      error: 'API Key 验证失败',
    };
  }
}

/**
 * 检查是否拥有指定权限
 */
export function hasScope(
  scopes: string[] | undefined,
  requiredScope: ApiKeyScope
): boolean {
  if (!scopes) {
    return false;
  }
  return scopes.includes(requiredScope) || scopes.includes('admin');
}

/**
 * 检查是否拥有所有指定权限
 */
export function hasAllScopes(
  scopes: string[] | undefined,
  requiredScopes: ApiKeyScope[]
): boolean {
  if (!scopes) {
    return false;
  }

  // admin 拥有所有权限
  if (scopes.includes('admin')) {
    return true;
  }

  return requiredScopes.every(scope => scopes.includes(scope));
}

/**
 * 从 Authorization 头提取 API Key
 *
 * 支持格式：
 * - Authorization: ApiKey rss_xxx
 * - Authorization: Bearer rss_xxx
 */
export function extractApiKeyFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // ApiKey 格式
  if (authHeader.startsWith('ApiKey ')) {
    return authHeader.slice(7).trim();
  }

  // Bearer 格式（也支持 API Key）
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    // 检查是否是 API Key 格式
    if (token.startsWith(API_KEY_PREFIX)) {
      return token;
    }
  }

  return null;
}

/**
 * 获取用户的 API Key 列表
 */
export async function getUserApiKeys(userId: string): Promise<ApiKeyInfo[]> {
  const apiKeys = await db.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      name: true,
      scopes: true,
      isActive: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  });

  return apiKeys;
}

/**
 * 撤销 API Key
 */
export async function revokeApiKey(
  apiKeyId: string,
  userId: string
): Promise<boolean> {
  try {
    const result = await db.apiKey.deleteMany({
      where: {
        id: apiKeyId,
        userId, // 确保只能撤销自己的 Key
      },
    });

    return result.count > 0;
  } catch (error) {
    console.error('[UserApiKey] Revoke error:', error);
    return false;
  }
}

/**
 * 生成新的 API Key
 */
export function generateApiKey(): string {
  const randomBytes = require('crypto').randomBytes(32).toString('hex');
  return `${API_KEY_PREFIX}${randomBytes}`;
}

export type { ApiKeyValidationResult as UserApiKeyValidationResult };
