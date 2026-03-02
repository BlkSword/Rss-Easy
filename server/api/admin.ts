/**
 * 管理员相关的 tRPC Router
 * 包含：
 * - 系统设置管理
 * - 用户管理
 * - 初始化状态检查
 */

import { router, publicProcedure, adminProcedure, superAdminProcedure, protectedProcedure } from '../trpc/init';
import { z } from 'zod';
import { db } from '@/lib/db';
import { TRPCError } from '@trpc/server';
import { info, warn, error } from '@/lib/logger';
import {
  getSystemSettings,
  isSystemInitialized,
  needsInitialization,
  clearInitializationCache,
} from '@/lib/system/init-check';
import {
  getRoleDisplayName,
  canModifyRole,
  type UserRole,
} from '@/lib/auth/roles';

// 系统设置输入 schema
const systemSettingsSchema = z.object({
  allowRegistration: z.boolean().optional(),
  defaultUserRole: z.enum(['user', 'editor', 'admin']).optional(),
  systemName: z.string().min(1).max(50).optional(),
  systemLogo: z.string().url().nullable().optional(),
  systemDescription: z.string().max(500).nullable().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).nullable().optional(),
});

// 更新用户角色 schema
const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  newRole: z.enum(['user', 'editor', 'admin', 'super_admin']),
});

export const adminRouter = router({
  /**
   * 检查初始化状态（公开）
   */
  checkInitStatus: publicProcedure.query(async () => {
    const isInitialized = await isSystemInitialized();
    const needsInit = await needsInitialization();

    return {
      isInitialized,
      needsInit,
    };
  }),

  /**
   * 获取系统设置（需要登录）
   */
  getSystemSettings: protectedProcedure.query(async () => {
    const settings = await getSystemSettings();

    if (!settings) {
      // 返回默认设置
      return {
        allowRegistration: true,
        defaultUserRole: 'user',
        systemName: 'Rss-Easy',
        systemLogo: null,
        systemDescription: null,
        maintenanceMode: false,
        maintenanceMessage: null,
      };
    }

    return {
      allowRegistration: settings.allowRegistration,
      defaultUserRole: settings.defaultUserRole,
      systemName: settings.systemName,
      systemLogo: settings.systemLogo,
      systemDescription: settings.systemDescription,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
    };
  }),

  /**
   * 更新系统设置（仅超级管理员）
   */
  updateSystemSettings: superAdminProcedure
    .input(systemSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const settings = await db.systemSettings.upsert({
          where: { id: 'system' },
          update: {
            ...input,
            updatedAt: new Date(),
          },
          create: {
            id: 'system',
            ...input,
          },
        });

        // 清除缓存
        clearInitializationCache();

        // 记录日志
        await info('system', '系统设置已更新', {
          userId: ctx.userId,
          changes: input,
        });

        return {
          success: true,
          settings: {
            allowRegistration: settings.allowRegistration,
            defaultUserRole: settings.defaultUserRole,
            systemName: settings.systemName,
            systemLogo: settings.systemLogo,
            systemDescription: settings.systemDescription,
            maintenanceMode: settings.maintenanceMode,
            maintenanceMessage: settings.maintenanceMessage,
          },
        };
      } catch (err) {
        await error('system', '更新系统设置失败', err instanceof Error ? err : undefined, {
          userId: ctx.userId,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '更新系统设置失败',
        });
      }
    }),

  /**
   * 获取用户列表（管理员+）
   */
  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        role: z.enum(['user', 'editor', 'admin', 'super_admin']).optional(),
        sortBy: z.enum(['createdAt', 'username', 'email']).default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, search, role, sortBy, sortOrder } = input;
      const skip = (page - 1) * limit;

      // 构建查询条件
      const where: any = {};

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (role) {
        where.role = role;
      }

      // 查询用户
      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                feeds: true,
                categories: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        db.user.count({ where }),
      ]);

      return {
        users: users.map((user) => ({
          ...user,
          roleDisplay: getRoleDisplayName(user.role),
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * 更新用户角色（管理员+）
   */
  updateUserRole: adminProcedure
    .input(updateUserRoleSchema)
    .mutation(async ({ input, ctx }) => {
      const { userId, newRole } = input;

      // 获取目标用户
      const targetUser = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, username: true },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '用户不存在',
        });
      }

      // 检查是否可以修改角色
      const roleCheck = canModifyRole(
        ctx.userRole!,
        newRole,
        ctx.userId!,
        userId
      );

      if (!roleCheck.allowed) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: roleCheck.reason || '没有权限修改此用户角色',
        });
      }

      // 更新角色
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: { role: newRole },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
        },
      });

      // 记录日志
      await info('system', '用户角色已更新', {
        operatorId: ctx.userId,
        targetUserId: userId,
        oldRole: targetUser.role,
        newRole,
      });

      return {
        success: true,
        user: {
          ...updatedUser,
          roleDisplay: getRoleDisplayName(updatedUser.role),
        },
      };
    }),

  /**
   * 删除用户（仅超级管理员）
   */
  deleteUser: superAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;

      // 不能删除自己
      if (userId === ctx.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '不能删除自己的账户',
        });
      }

      // 获取目标用户
      const targetUser = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, username: true, email: true },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '用户不存在',
        });
      }

      // 不能删除其他超级管理员
      if (targetUser.role === 'super_admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '不能删除超级管理员',
        });
      }

      // 删除用户（级联删除相关数据）
      await db.user.delete({
        where: { id: userId },
      });

      // 记录日志
      await info('system', '用户已删除', {
        operatorId: ctx.userId,
        deletedUserId: userId,
        deletedUsername: targetUser.username,
        deletedEmail: targetUser.email,
      });

      return { success: true };
    }),

  /**
   * 获取用户详情（管理员+）
   */
  getUserDetail: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const user = await db.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
          preferences: true,
          _count: {
            select: {
              feeds: true,
              categories: true,
              readingHistory: true,
              notifications: true,
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

      return {
        ...user,
        roleDisplay: getRoleDisplayName(user.role),
      };
    }),

  /**
   * 获取系统统计信息（管理员+）
   */
  getStats: adminProcedure.query(async () => {
    const [userCount, feedCount, entryCount, todayLoginCount] = await Promise.all([
      db.user.count(),
      db.feed.count(),
      db.entry.count(),
      // 今日登录数（通过日志表统计）
      db.systemLog.count({
        where: {
          category: 'auth',
          message: { contains: '登录成功' },
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    // 按角色统计用户
    const usersByRole = await db.user.groupBy({
      by: ['role'],
      _count: true,
    });

    return {
      userCount,
      feedCount,
      entryCount,
      todayLoginCount,
      usersByRole: usersByRole.map((item) => ({
        role: item.role,
        count: item._count,
        roleDisplay: getRoleDisplayName(item.role),
      })),
    };
  }),
});
