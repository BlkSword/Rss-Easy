/**
 * 系统初始化检查和管理
 * 用于检测系统是否已完成初始设置
 */

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { info, error } from '@/lib/logger';

// 初始化状态缓存（内存缓存，避免频繁查询数据库）
let initializationCache: {
  isInitialized: boolean;
  checkedAt: number;
} | null = null;

// 缓存有效期（5分钟）
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 检查系统是否已初始化
 * 使用缓存优化性能
 */
export async function isSystemInitialized(): Promise<boolean> {
  // 检查缓存
  if (initializationCache && Date.now() - initializationCache.checkedAt < CACHE_TTL) {
    return initializationCache.isInitialized;
  }

  try {
    // 检查 SystemSettings 表
    const settings = await db.systemSettings.findUnique({
      where: { id: 'system' },
      select: { isInitialized: true },
    });

    const isInitialized = settings?.isInitialized ?? false;

    // 更新缓存
    initializationCache = {
      isInitialized,
      checkedAt: Date.now(),
    };

    return isInitialized;
  } catch (err) {
    // 如果表不存在，返回 false
    console.error('检查系统初始化状态失败:', err);
    return false;
  }
}

/**
 * 清除初始化缓存
 * 在系统设置变更后调用
 */
export function clearInitializationCache(): void {
  initializationCache = null;
}

/**
 * 获取系统设置
 */
export async function getSystemSettings() {
  try {
    const settings = await db.systemSettings.findUnique({
      where: { id: 'system' },
    });

    return settings;
  } catch (err) {
    console.error('获取系统设置失败:', err);
    return null;
  }
}

/**
 * 初始化系统设置
 * 创建默认系统设置记录
 */
export async function initializeSystemSettings(): Promise<void> {
  try {
    await db.systemSettings.create({
      data: {
        id: 'system',
        isInitialized: false,
        allowRegistration: true,
        defaultUserRole: 'user',
        systemName: 'Rss-Easy',
      },
    });
  } catch (err: any) {
    // 如果记录已存在，忽略错误
    if (err.code !== 'P2002') {
      throw err;
    }
  }
}

/**
 * 创建超级管理员并完成初始化
 */
export async function initializeSystem(data: {
  email: string;
  username: string;
  password: string;
  systemName?: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // 检查是否已初始化
    const alreadyInitialized = await isSystemInitialized();
    if (alreadyInitialized) {
      return { success: false, error: '系统已完成初始化' };
    }

    // 检查是否有用户存在
    const existingUserCount = await db.user.count();
    if (existingUserCount > 0) {
      return { success: false, error: '系统中已有用户，无法执行初始化' };
    }

    // 哈希密码
    const passwordHash = await hashPassword(data.password);

    // 创建超级管理员
    const user = await db.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        role: 'super_admin',
        preferences: {
          theme: 'system',
          language: 'zh-CN',
          itemsPerPage: 20,
        },
        aiConfig: {
          enableSummary: true,
          enableCategory: true,
        },
      },
    });

    // 更新系统设置
    await db.systemSettings.upsert({
      where: { id: 'system' },
      update: {
        isInitialized: true,
        initializedAt: new Date(),
        systemName: data.systemName || 'Rss-Easy',
      },
      create: {
        id: 'system',
        isInitialized: true,
        initializedAt: new Date(),
        systemName: data.systemName || 'Rss-Easy',
      },
    });

    // 清除缓存
    clearInitializationCache();

    // 记录日志
    await info('system', '系统初始化完成', {
      userId: user.id,
      username: user.username,
      systemName: data.systemName,
    });

    return { success: true, userId: user.id };
  } catch (err) {
    await error('system', '系统初始化失败', err instanceof Error ? err : undefined, {
      email: data.email,
      username: data.username,
    });

    return {
      success: false,
      error: err instanceof Error ? err.message : '初始化失败',
    };
  }
}

/**
 * 检查是否需要显示初始化页面
 * 条件：系统未初始化 且 没有任何用户
 */
export async function needsInitialization(): Promise<boolean> {
  // 如果已初始化，不需要
  const isInitialized = await isSystemInitialized();
  if (isInitialized) {
    return false;
  }

  // 检查是否有用户
  const userCount = await db.user.count();

  // 如果没有用户，需要初始化
  return userCount === 0;
}

/**
 * 检查注册是否开放
 */
export async function isRegistrationAllowed(): Promise<boolean> {
  try {
    const settings = await getSystemSettings();
    return settings?.allowRegistration ?? true;
  } catch {
    return true;
  }
}

/**
 * 获取新用户默认角色
 */
export async function getDefaultUserRole(): Promise<string> {
  try {
    const settings = await getSystemSettings();
    return settings?.defaultUserRole ?? 'user';
  } catch {
    return 'user';
  }
}
