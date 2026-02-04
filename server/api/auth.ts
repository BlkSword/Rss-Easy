/**
 * 认证相关的 tRPC Router
 */

import { router, publicProcedure } from '../trpc/init';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, signToken } from '@/lib/auth';
import { TRPCError } from '@trpc/server';

export const authRouter = router({
  /**
   * 用户注册
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        username: z.string().min(3).max(20),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      // 检查邮箱是否已存在
      const existingEmail = await db.user.findUnique({
        where: { email: input.email },
      });

      if (existingEmail) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '该邮箱已被注册',
        });
      }

      // 检查用户名是否已存在
      const existingUsername = await db.user.findUnique({
        where: { username: input.username },
      });

      if (existingUsername) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '该用户名已被使用',
        });
      }

      // 哈希密码并创建用户
      const passwordHash = await hashPassword(input.password);

      const user = await db.user.create({
        data: {
          email: input.email,
          username: input.username,
          passwordHash,
          preferences: {
            theme: 'system',
            language: 'zh-CN',
            itemsPerPage: 20,
          },
          aiConfig: {
            provider: 'openai',
            model: 'gpt-4o',
            enableSummary: true,
            enableCategory: true,
          },
        },
        select: {
          id: true,
          email: true,
          username: true,
          preferences: true,
          aiConfig: true,
          createdAt: true,
        },
      });

      // 生成 JWT token
      const token = await signToken({
        userId: user.id,
        email: user.email,
      });

      return {
        user,
        token,
      };
    }),

  /**
   * 用户登录
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // 查找用户
      const user = await db.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '邮箱或密码错误',
        });
      }

      // 验证密码
      const valid = await verifyPassword(input.password, user.passwordHash);

      if (!valid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '邮箱或密码错误',
        });
      }

      // 生成 JWT token
      const token = await signToken({
        userId: user.id,
        email: user.email,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
          preferences: user.preferences,
          aiConfig: user.aiConfig,
        },
        token,
      };
    }),

  /**
   * 获取当前用户信息
   */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '未登录',
      });
    }

    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        preferences: true,
        aiConfig: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            feeds: true,
            categories: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: '用户不存在',
      });
    }

    return user;
  }),

  /**
   * 更新用户偏好设置
   */
  updatePreferences: publicProcedure
    .input(
      z.object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        language: z.string().optional(),
        itemsPerPage: z.number().min(10).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '未登录',
        });
      }

      const user = await db.user.update({
        where: { id: ctx.userId },
        data: {
          preferences: input,
        },
        select: {
          id: true,
          email: true,
          username: true,
          preferences: true,
        },
      });

      return user;
    }),

  /**
   * 更新AI配置
   */
  updateAiConfig: publicProcedure
    .input(
      z.object({
        provider: z.enum(['openai', 'anthropic', 'deepseek', 'ollama']).optional(),
        model: z.string().optional(),
        enableSummary: z.boolean().optional(),
        enableCategory: z.boolean().optional(),
        enableKeywords: z.boolean().optional(),
        enableSentiment: z.boolean().optional(),
        enableImportance: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '未登录',
        });
      }

      const user = await db.user.update({
        where: { id: ctx.userId },
        data: {
          aiConfig: input,
        },
        select: {
          id: true,
          email: true,
          username: true,
          aiConfig: true,
        },
      });

      return user;
    }),
});
