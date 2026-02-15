/**
 * tRPC初始化
 * 安全增强：
 * - 速率限制中间件
 * - 改进的 CSRF 保护
 * - 权限检查中间件
 */

import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { info, warn, error } from '@/lib/logger';
import { generateRequestId } from '@/lib/request/request-id';
import {
  loginRateLimiter,
  registerRateLimiter,
  getClientIdentifier,
} from '@/lib/security/redis-rate-limit';
import { validateCSRFToken } from '@/lib/auth/csrf';
import { hasScope, type ApiKeyScope } from '@/lib/auth/user-api-key';

/**
 * tRPC实例
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * 中间件：请求日志记录（带请求 ID）
 */
const requestLogger = t.middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();

  // 生成请求 ID（如果不存在）
  if (!ctx.requestId) {
    ctx.requestId = generateRequestId();
  }
  
  try {
    const result = await next();
    const duration = Date.now() - start;
    
    // 记录API请求日志
    if (path.startsWith('logs.')) {
      // 避免记录日志查询本身，防止循环
      return result;
    }
    
    await info('api', `API ${type}`, {
      path,
      userId: ctx.userId,
      duration,
      success: true,
    });
    
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    
    await error('api', `API ${type} 失败`, err instanceof Error ? err : undefined, {
      path,
      userId: ctx.userId,
      duration,
    });
    
    throw err;
  }
});

/**
 * 中间件：检查是否已认证
 */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '需要登录' });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // 确保userId非null
    },
  });
});

/**
 * 中间件：CSRF Token 验证（用于 mutation 操作）
 * 改进版：使用 JWT 签名验证 CSRF Token
 */
const csrfProtection = t.middleware(async ({ ctx, next, type }) => {
  // 只对 mutation 操作进行 CSRF 验证
  if (type !== 'mutation') {
    return next();
  }

  // 如果是通过 API Key 认证，跳过 CSRF 检查
  if (ctx.authMethod === 'api_key') {
    return next();
  }

  // 获取 CSRF Token（从 headers）
  const csrfTokenFromHeader = ctx.csrfToken;
  const sessionToken = ctx.sessionToken;

  if (!csrfTokenFromHeader || !sessionToken) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '缺少 CSRF Token 或会话',
    });
  }

  // 使用 JWT 验证 CSRF Token
  const isValid = await validateCSRFToken(csrfTokenFromHeader, sessionToken);

  if (!isValid) {
    await warn('security', 'CSRF Token 验证失败', {
      userId: ctx.userId,
      hasCsrfToken: !!csrfTokenFromHeader,
      hasSessionToken: !!sessionToken,
    });

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'CSRF Token 无效或已过期',
    });
  }

  return next();
});

/**
 * 中间件：速率限制（登录）
 */
const loginRateLimit = t.middleware(async ({ ctx, next }) => {
  const identifier = getClientIdentifier(ctx.userId, ctx.ip);

  const result = await loginRateLimiter.check(identifier);

  if (!result.allowed) {
    await warn('security', '登录速率限制触发', {
      identifier,
      resetAt: result.resetAt,
      retryAfter: result.retryAfter,
    });

    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `登录尝试过于频繁，请在 ${result.retryAfter} 秒后重试`,
    });
  }

  return next();
});

/**
 * 中间件：速率限制（注册）
 */
const registerRateLimit = t.middleware(async ({ ctx, next }) => {
  const identifier = getClientIdentifier(ctx.userId, ctx.ip);

  const result = await registerRateLimiter.check(identifier);

  if (!result.allowed) {
    await warn('security', '注册速率限制触发', {
      identifier,
      resetAt: result.resetAt,
      retryAfter: result.retryAfter,
    });

    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `注册请求过于频繁，请在 ${result.retryAfter} 秒后重试`,
    });
  }

  return next();
});

/**
 * 创建权限检查中间件工厂
 */
function createScopeCheckMiddleware(requiredScopes: ApiKeyScope[]) {
  return t.middleware(async ({ ctx, next }) => {
    // 如果不是 API Key 认证，跳过权限检查（使用用户完整权限）
    if (ctx.authMethod !== 'api_key') {
      return next();
    }

    // 检查 API Key 权限
    const apiKeyScopes = ctx.apiKeyScopes || [];

    if (!apiKeyScopes.some(scope => requiredScopes.includes(scope as ApiKeyScope))) {
      await warn('security', 'API Key 权限不足', {
        userId: ctx.userId,
        requiredScopes,
        actualScopes: apiKeyScopes,
      });

      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'API Key 权限不足',
      });
    }

    return next();
  });
}

/**
 * 导出tRPC实例和中间件
 */
export const router = t.router;

// 公开 procedure（仅日志记录）
export const publicProcedure = t.procedure.use(requestLogger);

// 需要认证的 procedure
export const protectedProcedure = t.procedure.use(isAuthed).use(requestLogger);

// 需要 CSRF 保护的 mutation procedure
export const protectedMutation = t.procedure.use(isAuthed).use(csrfProtection).use(requestLogger);

// 登录 procedure（带速率限制）
export const loginProcedure = t.procedure.use(loginRateLimit).use(requestLogger);

// 注册 procedure（带速率限制）
export const registerProcedure = t.procedure.use(registerRateLimit).use(requestLogger);

// 带特定权限检查的 procedure
export const withScope = (...scopes: ApiKeyScope[]) =>
  t.procedure.use(isAuthed).use(createScopeCheckMiddleware(scopes)).use(requestLogger);

// 导出中间件供外部使用
export { loginRateLimit, registerRateLimit, csrfProtection };
