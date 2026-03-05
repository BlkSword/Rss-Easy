/**
 * 系统初始化检查和管理
 *
 * 安全原则：
 * 1. 永远不信任客户端传来的任何参数
 * 2. 后端通过数据库判断是否已初始化
 * 3. 判断依据：SystemSettings.isInitialized === true OR 用户数量 > 0
 */

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { info, error } from '@/lib/logger';

// 初始化状态缓存（内存缓存，避免频繁查询数据库）
let initializationCache: {
  isInitialized: boolean;
  checkedAt: number;
} | null = null;

// 缓存有效期（30秒，较短以防止缓存攻击）
const CACHE_TTL = 30 * 1000;

/**
 * 检查系统是否已初始化
 *
 * 判断逻辑（必须满足以下任一条件）：
 * 1. SystemSettings.isInitialized === true
 * 2. 用户表中存在至少一个用户
 *
 * 这是后端的唯一可信判断，不依赖任何客户端参数
 */
export async function isSystemInitialized(): Promise<boolean> {
  // 检查缓存
  if (initializationCache && Date.now() - initializationCache.checkedAt < CACHE_TTL) {
    return initializationCache.isInitialized;
  }

  try {
    // 方法1：检查 SystemSettings 表
    const settings = await db.systemSettings.findUnique({
      where: { id: 'system' },
      select: { isInitialized: true },
    });

    if (settings?.isInitialized === true) {
      updateCache(true);
      return true;
    }

    // 方法2：检查用户表（更可靠的判断）
    // 如果有任何用户存在，说明系统已初始化
    const userCount = await db.user.count();

    const isInitialized = userCount > 0;
    updateCache(isInitialized);

    return isInitialized;
  } catch (err) {
    console.error('检查系统初始化状态失败:', err);

    // 数据库错误时的回退策略：检查缓存
    if (initializationCache) {
      // 使用旧缓存值，即使过期也比没有信息好
      return initializationCache.isInitialized;
    }

    // 完全无法确定时，保守地返回 false
    // 让 init 页面自己做更详细的检查
    return false;
  }
}

/**
 * 更新缓存
 */
function updateCache(isInitialized: boolean): void {
  initializationCache = {
    isInitialized,
    checkedAt: Date.now(),
  };
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
 * 创建超级管理员并完成初始化
 *
 * 安全检查：
 * 1. 检查是否已初始化（通过 isSystemInitialized）
 * 2. 再次检查是否有用户存在（双重验证）
 * 3. 使用事务确保原子性
 */
export async function initializeSystem(data: {
  email: string;
  username: string;
  password: string;
  systemName?: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // 安全检查1：使用 isSystemInitialized 检查
    const alreadyInitialized = await isSystemInitialized();
    if (alreadyInitialized) {
      await error('system', '初始化被拒绝：系统已初始化', undefined, { email: data.email });
      return { success: false, error: '系统已完成初始化' };
    }

    // 安全检查2：直接检查用户数量（双重验证，防止缓存攻击）
    const userCount = await db.user.count();
    if (userCount > 0) {
      await error('system', '初始化被拒绝：用户已存在', undefined, {
        email: data.email,
        userCount
      });
      return { success: false, error: '系统中已有用户，无法执行初始化' };
    }

    // 哈希密码
    const passwordHash = await hashPassword(data.password);

    // 使用事务创建用户和设置
    const result = await db.$transaction(async (tx) => {
      // 再次在事务内检查（防止并发攻击）
      const countInTx = await tx.user.count();
      if (countInTx > 0) {
        throw new Error('并发初始化检测到用户已存在');
      }

      // 创建超级管理员
      const user = await tx.user.create({
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
      await tx.systemSettings.upsert({
        where: { id: 'system' },
        update: {
          isInitialized: true,
          initializedAt: new Date(),
          systemName: data.systemName || 'RSS-Post',
        },
        create: {
          id: 'system',
          isInitialized: true,
          initializedAt: new Date(),
          systemName: data.systemName || 'RSS-Post',
        },
      });

      return user;
    });

    // 清除缓存
    clearInitializationCache();

    // 记录日志
    await info('system', '系统初始化完成', {
      userId: result.id,
      username: result.username,
      systemName: data.systemName,
    });

    return { success: true, userId: result.id };
  } catch (err) {
    await error('system', '系统初始化失败', err instanceof Error ? err : undefined, {
      email: data.email,
      username: data.username,
    });

    // 清除缓存，让下次检查重新查询
    clearInitializationCache();

    return {
      success: false,
      error: err instanceof Error ? err.message : '初始化失败',
    };
  }
}

/**
 * 检查是否需要显示初始化页面
 *
 * 这是 isSystemInitialized 的反向
 */
export async function needsInitialization(): Promise<boolean> {
  const isInitialized = await isSystemInitialized();
  return !isInitialized;
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

/**
 * 代理配置缓存
 */
let proxyConfigCache: {
  config: {
    enabled: boolean;
    host: string | null;
    port: number | null;
    type: string;
  };
  checkedAt: number;
} | null = null;

/**
 * 获取代理配置
 */
export async function getProxyConfig(): Promise<{
  enabled: boolean;
  host: string | null;
  port: number | null;
  type: string;
}> {
  if (proxyConfigCache && Date.now() - proxyConfigCache.checkedAt < 60 * 1000) {
    return proxyConfigCache.config;
  }

  try {
    const settings = await db.systemSettings.findUnique({
      where: { id: 'system' },
      select: {
        proxyEnabled: true,
        proxyHost: true,
        proxyPort: true,
        proxyType: true,
      },
    });

    const config = {
      enabled: settings?.proxyEnabled ?? false,
      host: settings?.proxyHost ?? null,
      port: settings?.proxyPort ?? null,
      type: settings?.proxyType ?? 'http',
    };

    proxyConfigCache = {
      config,
      checkedAt: Date.now(),
    };

    return config;
  } catch (err) {
    console.error('获取代理配置失败:', err);
    return {
      enabled: false,
      host: null,
      port: null,
      type: 'http',
    };
  }
}

/**
 * 清除代理配置缓存
 */
export function clearProxyConfigCache(): void {
  proxyConfigCache = null;
}
