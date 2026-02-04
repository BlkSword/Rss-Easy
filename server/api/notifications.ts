/**
 * Notifications API Router
 * 通知管理
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';

export const notificationsRouter = router({
  /**
   * 获取通知列表
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        onlyUnread: z.boolean().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.db.notification.findMany({
        where: {
          userId: ctx.userId,
          ...(input.onlyUnread && { isRead: false }),
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit,
      });
    }),

  /**
   * 获取未读数量
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.notification.count({
      where: {
        userId: ctx.userId,
        isRead: false,
      },
    });
  }),

  /**
   * 标记为已读
   */
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const notification = await ctx.db.notification.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      if (!notification) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '通知不存在' });
      }

      await ctx.db.notification.update({
        where: { id: input.id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return { success: true };
    }),

  /**
   * 标记所有为已读
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notification.updateMany({
      where: {
        userId: ctx.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }),

  /**
   * 删除通知
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const notification = await ctx.db.notification.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      if (!notification) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '通知不存在' });
      }

      await ctx.db.notification.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * 清空已读通知
   */
  clearRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notification.deleteMany({
      where: {
        userId: ctx.userId,
        isRead: true,
      },
    });

    return { success: true };
  }),
});
