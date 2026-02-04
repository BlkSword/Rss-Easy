/**
 * Categories API Router
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';

export const categoriesRouter = router({
  /**
   * 获取分类列表
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const categories = await ctx.db.category.findMany({
        where: { userId: ctx.userId },
        include: {
          _count: {
            select: { feeds: true },
          },
          feeds: {
            select: {
              id: true,
              title: true,
              iconUrl: true,
              unreadCount: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      // 计算未读数
      const categoriesWithUnread = await Promise.all(
        categories.map(async (cat) => ({
          ...cat,
          unreadCount: await ctx.db.entry.count({
            where: {
              feed: { categoryId: cat.id, userId: ctx.userId },
              isRead: false,
            },
          }),
        }))
      );

      return categoriesWithUnread;
    }),

  /**
   * 获取单个分类
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const category = await ctx.db.category.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        include: {
          _count: {
            select: { feeds: true },
          },
          feeds: {
            select: {
              id: true,
              title: true,
              iconUrl: true,
              unreadCount: true,
              description: true,
            },
          },
        },
      });

      if (!category) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '分类不存在' });
      }

      // 计算未读数
      const unreadCount = await ctx.db.entry.count({
        where: {
          feed: { categoryId: category.id, userId: ctx.userId },
          isRead: false,
        },
      });

      return {
        ...category,
        unreadCount,
      };
    }),

  /**
   * 添加分类
   */
  add: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      icon: z.string().optional(),
      parentId: z.string().uuid().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const category = await ctx.db.category.create({
        data: {
          userId: ctx.userId,
          ...input,
        },
      });

      return category;
    }),

  /**
   * 更新分类
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      icon: z.string().optional(),
      parentId: z.string().uuid().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const category = await ctx.db.category.update({
        where: {
          id,
          userId: ctx.userId,
        },
        data,
      });

      return category;
    }),

  /**
   * 删除分类
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // 检查是否有子分类
      const hasChildren = await ctx.db.category.count({
        where: { parentId: input.id },
      }) > 0;

      if (hasChildren) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '请先删除子分类',
        });
      }

      // 取消关联feeds的分类
      await ctx.db.feed.updateMany({
        where: { categoryId: input.id },
        data: { categoryId: null },
      });

      await ctx.db.category.delete({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      return { success: true };
    }),

  /**
   * 批量更新排序
   */
  reorder: protectedProcedure
    .input(z.array(z.object({
      id: z.string().uuid(),
      sortOrder: z.number(),
    })))
    .mutation(async ({ input, ctx }) => {
      await Promise.all(
        input.map(({ id, sortOrder }) =>
          ctx.db.category.update({
            where: { id, userId: ctx.userId },
            data: { sortOrder },
          })
        )
      );

      return { success: true };
    }),
});
