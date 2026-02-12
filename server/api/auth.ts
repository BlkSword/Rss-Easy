/**
 * 认证相关的 tRPC Router
 */

import { router, publicProcedure } from '../trpc/init';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, signToken } from '@/lib/auth';
import { TRPCError } from '@trpc/server';
import { info, warn, error } from '@/lib/logger';
import { createEmailServiceFromUser, createSystemEmailService } from '@/lib/email/service';
import { randomBytes } from 'crypto';

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

      await info('auth', '用户登录成功', { userId: user.id, email: user.email });

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
          preferences: user.preferences,
          aiConfig: user.aiConfig,
          emailConfig: user.emailConfig,
        },
        token,
      };
    }),

  /**
   * 用户登出
   */
  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.userId) {
        await info('auth', '用户登出', { userId: ctx.userId });
      }
      return { success: true };
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
        emailConfig: true,
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
   * 更新用户资料
   */
  updateProfile: publicProcedure
    .input(
      z.object({
        username: z.string().min(3).max(20).optional(),
        avatarUrl: z.string().url().optional(),
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
        data: input,
        select: {
          id: true,
          email: true,
          username: true,
          avatarUrl: true,
        },
      });

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
        autoMarkAsRead: z.boolean().optional(),
        showFullContent: z.boolean().optional(),
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
   * 更新密码
   */
  updatePassword: publicProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '未登录',
        });
      }

      // 获取用户
      const user = await db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          passwordHash: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '用户不存在',
        });
      }

      // 验证当前密码
      const { verifyPassword } = await import('@/lib/auth');
      const valid = await verifyPassword(input.currentPassword, user.passwordHash);

      if (!valid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '当前密码错误',
        });
      }

      // 哈希新密码
      const { hashPassword } = await import('@/lib/auth');
      const passwordHash = await hashPassword(input.newPassword);

      await db.user.update({
        where: { id: ctx.userId },
        data: { passwordHash },
      });

      return { success: true };
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

  /**
   * 请求密码重置
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      // 查找用户
      const user = await db.user.findUnique({
        where: { email: input.email },
      });

      // 无论用户是否存在都返回成功，防止邮箱枚举攻击
      if (!user) {
        await info('auth', '密码重置请求（用户不存在）', { email: input.email });
        return { success: true, message: '如果该邮箱已注册，您将收到密码重置邮件' };
      }

      // 检查是否在24小时内请求超过3次
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const resetCount = (user as any).passwordResetCount || 0;
      const existingResetExpiresAt = (user as any).passwordResetExpiresAt;

      if (resetCount >= 3 && existingResetExpiresAt && existingResetExpiresAt > oneDayAgo) {
        await warn('auth', '密码重置请求过于频繁', { email: input.email, count: resetCount });
        return { success: true, message: '请求过于频繁，请稍后再试' };
      }

      // 生成重置 token
      const resetToken = randomBytes(32).toString('hex');
      const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期

      // 更新用户记录
      await (db.user as any).update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpiresAt: resetExpiresAt,
          passwordResetCount: resetCount + 1,
        },
      });

      // 发送密码重置邮件
      try {
        // 优先使用用户配置的邮件服务
        let emailService = createEmailServiceFromUser(user.emailConfig);

        // 如果用户没有配置，使用系统默认邮件服务
        if (!emailService) {
          emailService = createSystemEmailService();
        }

        if (emailService) {
          const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
          await emailService.sendPasswordResetEmail(user.email, user.username, resetUrl, '1小时');
          await info('auth', '密码重置邮件已发送', { email: user.email });
        } else {
          await error('auth', '邮件服务未配置', undefined, { email: user.email });
          return { success: false, message: '邮件服务未配置，请联系管理员' };
        }
      } catch (err: any) {
        await error('auth', '发送密码重置邮件失败', err, { email: user.email });
        return { success: false, message: '发送邮件失败，请稍后重试' };
      }

      return { success: true, message: '如果该邮箱已注册，您将收到密码重置邮件' };
    }),

  /**
   * 验证重置 token
   */
  verifyResetToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .query(async ({ input }) => {
      const user = await (db.user as any).findUnique({
        where: { passwordResetToken: input.token } as any,
        select: {
          id: true,
          email: true,
          username: true,
          passwordResetExpiresAt: true,
          passwordResetUsed: true, // 检查是否已使用
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '无效的重置链接',
        });
      }

      if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '重置链接已过期，请重新申请',
        });
      }

      // 检查 token 是否已被使用
      if (user.passwordResetUsed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '重置链接已被使用，请重新申请',
        });
      }

      return {
        valid: true,
        email: user.email,
        username: user.username,
      };
    }),

  /**
   * 重置密码
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      // 查找用户
      const user = await (db.user as any).findUnique({
        where: { passwordResetToken: input.token } as any,
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '无效的重置链接',
        });
      }

      // 检查 token 是否过期
      if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '重置链接已过期，请重新申请',
        });
      }

      // 检查 token 是否已被使用
      if (user.passwordResetUsed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '重置链接已被使用，请重新申请',
        });
      }

      // 哈希新密码
      const passwordHash = await hashPassword(input.newPassword);

      // 更新密码并清除重置 token，标记为已使用
      await (db.user as any).update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          passwordResetUsed: true, // 标记为已使用
          passwordResetCount: 0,
        },
      });

      await info('auth', '密码已重置', { email: user.email });

      return { success: true, message: '密码已成功重置，请使用新密码登录' };
    }),
});
