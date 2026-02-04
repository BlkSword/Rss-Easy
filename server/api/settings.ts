/**
 * Settings API Router
 * 用户设置管理
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';

export const settingsRouter = router({
  /**
   * 获取用户设置
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        username: true,
        email: true,
        preferences: true,
        aiConfig: true,
      },
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    return user;
  }),

  /**
   * 更新个人资料
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        username: z.string().min(2).max(50).optional(),
        bio: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.update({
        where: { id: ctx.userId },
        data: input,
      });

      return user;
    }),

  /**
   * 更新偏好设置
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        fontSize: z.enum(['small', 'medium', 'large']).optional(),
        itemsPerPage: z.number().min(10).max(100).optional(),
        autoMarkAsRead: z.boolean().optional(),
        showUnreadCount: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          preferences: {
            ...(input as any),
          },
        },
      });

      return user;
    }),

  /**
   * 更新 AI 配置
   */
  updateAIConfig: protectedProcedure
    .input(
      z.object({
        provider: z.enum(['openai', 'anthropic', 'deepseek', 'ollama', 'custom']).optional(),
        model: z.string().optional(),
        apiKey: z.string().optional(),
        baseURL: z.string().url().optional(),
        autoSummary: z.boolean().optional(),
        autoCategorize: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 获取当前配置
      const current = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { aiConfig: true },
      });

      const updatedConfig = {
        ...((current?.aiConfig as any) || {}),
        ...input,
      };

      const user = await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          aiConfig: updatedConfig as any,
        },
      });

      return user;
    }),

  /**
   * 修改密码
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 验证当前密码
      const { verifyPassword } = await import('@/lib/auth/password');
      const isValid = await verifyPassword(input.currentPassword, user.passwordHash);

      if (!isValid) {
        throw new Error('当前密码错误');
      }

      // 哈希新密码
      const { hashPassword } = await import('@/lib/auth/password');
      const hashedPassword = await hashPassword(input.newPassword);

      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: { passwordHash: hashedPassword },
      });

      return { success: true };
    }),

  /**
   * 删除账户
   */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    // 删除用户的所有数据
    await ctx.db.user.delete({
      where: { id: ctx.userId },
    });

    return { success: true };
  }),

  /**
   * 清空所有文章
   */
  clearAllEntries: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.entry.deleteMany({
      where: {
        feed: { userId: ctx.userId },
      },
    });

    return { success: true };
  }),

  /**
   * 导出用户数据
   */
  exportData: protectedProcedure.mutation(async ({ ctx }) => {
    // 获取所有用户数据
    const [user, feeds, categories, entries] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true, username: true, email: true, preferences: true, createdAt: true },
      }),
      ctx.db.feed.findMany({
        where: { userId: ctx.userId },
        include: { category: true },
      }),
      ctx.db.category.findMany({
        where: { userId: ctx.userId },
      }),
      ctx.db.entry.findMany({
        where: { feed: { userId: ctx.userId } },
        include: { feed: true },
        take: 1000, // 限制导出数量
      }),
    ]);

    return {
      user,
      feeds,
      categories,
      entries,
      exportedAt: new Date(),
    };
  }),
});
