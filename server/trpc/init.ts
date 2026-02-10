/**
 * tRPC初始化
 */

import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { info, warn, error } from '@/lib/logger';

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
 * 中间件：请求日志记录
 */
const requestLogger = t.middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  
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
 * 导出tRPC实例和中间件
 */
export const router = t.router;
export const publicProcedure = t.procedure.use(requestLogger);
export const protectedProcedure = t.procedure.use(isAuthed).use(requestLogger);
