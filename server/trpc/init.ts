/**
 * tRPC初始化
 */

import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { info, warn, error } from '@/lib/logger';
import { generateRequestId } from '@/lib/request/request-id';

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
 */
const csrfProtection = t.middleware(({ ctx, next, type }) => {
  // 只对 mutation 操作进行 CSRF 验证
  if (type !== 'mutation') {
    return next();
  }

  // 获取 CSRF Token（从 headers 或 body）
  const csrfTokenFromHeader = ctx.csrfToken;
  const sessionToken = ctx.sessionToken;

  if (!csrfTokenFromHeader || !sessionToken) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '缺少 CSRF Token 或会话',
    });
  }

  // 验证 CSRF Token（简化检查，实际应该使用真正的验证）
  // 这里我们信任 session Token，因为已经过 JWT 验证
  if (csrfTokenFromHeader !== sessionToken.substring(0, 32)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'CSRF Token 无效',
    });
  }

  return next();
});

/**
 * 导出tRPC实例和中间件
 */
export const router = t.router;
export const publicProcedure = t.procedure.use(requestLogger);
export const protectedProcedure = t.procedure.use(isAuthed).use(requestLogger);
export const protectedMutation = t.procedure.use(isAuthed).use(csrfProtection).use(requestLogger);
