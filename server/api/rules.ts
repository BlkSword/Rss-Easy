/**
 * Subscription Rules API Router
 * 订阅规则管理
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { getRuleEngine } from '@/lib/rules/engine';
import { info, warn, error } from '@/lib/logger';

export const rulesRouter = router({
  /**
   * 获取规则列表
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.db.subscriptionRule.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /**
   * 获取单个规则
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const rule = await ctx.db.subscriptionRule.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      if (!rule) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '规则不存在' });
      }

      return rule;
    }),

  /**
   * 创建规则
   */
  add: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        conditions: z.array(
          z.object({
            field: z.enum(['title', 'content', 'author', 'category', 'tag', 'feedTitle']),
            operator: z.enum(['contains', 'notContains', 'equals', 'notEquals', 'matches', 'in', 'gt', 'lt']),
            value: z.union([z.string(), z.array(z.string()), z.number()]),
          })
        ),
        actions: z.array(
          z.object({
            type: z.enum([
              'markRead',
              'markUnread',
              'star',
              'unstar',
              'archive',
              'unarchive',
              'assignCategory',
              'addTag',
              'removeTag',
              'skip',
            ]),
            params: z.record(z.string(), z.any()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await info('api', '用户创建订阅规则', {
        userId: ctx.userId,
        name: input.name,
        conditionsCount: input.conditions.length,
        actionsCount: input.actions.length,
        actions: input.actions.map(a => a.type)
      });

      // 验证至少有一个条件和动作
      if (input.conditions.length === 0) {
        await warn('api', '创建订阅规则失败：无条件', {
          userId: ctx.userId,
          name: input.name
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '至少需要一个条件',
        });
      }

      if (input.actions.length === 0) {
        await warn('api', '创建订阅规则失败：无动作', {
          userId: ctx.userId,
          name: input.name
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '至少需要一个动作',
        });
      }

      // 验证动作参数
      for (const action of input.actions) {
        if (action.type === 'assignCategory' && !action.params?.categoryId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'assignCategory 动作需要 categoryId 参数',
          });
        }
        if ((action.type === 'addTag' || action.type === 'removeTag') && !action.params?.tag) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${action.type} 动作需要 tag 参数`,
          });
        }
      }

      const rule = await ctx.db.subscriptionRule.create({
        data: {
          userId: ctx.userId,
          name: input.name,
          conditions: input.conditions as any,
          actions: input.actions as any,
        },
      });

      await info('api', '订阅规则创建成功', {
        userId: ctx.userId,
        ruleId: rule.id,
        name: rule.name
      });

      return rule;
    }),

  /**
   * 更新规则
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        conditions: z
          .array(
            z.object({
              field: z.enum(['title', 'content', 'author', 'category', 'tag', 'feedTitle']),
              operator: z.enum(['contains', 'notContains', 'equals', 'notEquals', 'matches', 'in', 'gt', 'lt']),
              value: z.union([z.string(), z.array(z.string()), z.number()]),
            })
          )
          .optional(),
        actions: z
          .array(
            z.object({
              type: z.enum([
                'markRead',
                'markUnread',
                'star',
                'unstar',
                'archive',
                'unarchive',
                'assignCategory',
                'addTag',
                'removeTag',
                'skip',
              ]),
              params: z.record(z.string(), z.any()).optional(),
            })
          )
          .optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await info('api', '用户更新订阅规则', {
        userId: ctx.userId,
        ruleId: input.id,
        updatedFields: Object.keys(input).filter(k => k !== 'id')
      });

      const { id, ...data } = input;

      // 验证动作参数
      if (data.actions) {
        for (const action of data.actions) {
          if (action.type === 'assignCategory' && !action.params?.categoryId) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'assignCategory 动作需要 categoryId 参数',
            });
          }
        }
      }

      const rule = await ctx.db.subscriptionRule.update({
        where: {
          id,
          userId: ctx.userId,
        },
        data,
      });

      await info('api', '订阅规则更新成功', {
        userId: ctx.userId,
        ruleId: rule.id,
        name: rule.name
      });

      return rule;
    }),

  /**
   * 删除规则
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // 先获取规则信息用于日志
      const rule = await ctx.db.subscriptionRule.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        select: {
          id: true,
          name: true,
          isEnabled: true
        }
      });

      if (!rule) {
        await warn('api', '删除订阅规则失败：不存在', {
          userId: ctx.userId,
          ruleId: input.id
        });
        throw new TRPCError({ code: 'NOT_FOUND', message: '规则不存在' });
      }

      await info('api', '用户删除订阅规则', {
        userId: ctx.userId,
        ruleId: input.id,
        ruleName: rule.name
      });

      await ctx.db.subscriptionRule.delete({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      return { success: true };
    }),

  /**
   * 切换规则启用状态
   */
  toggle: protectedProcedure
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      const rule = await ctx.db.subscriptionRule.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        select: {
          id: true,
          name: true,
          isEnabled: true,
        },
      });

      if (!rule) {
        await warn('api', '切换订阅规则状态失败：不存在', {
          userId: ctx.userId,
          ruleId: input.id
        });
        throw new TRPCError({ code: 'NOT_FOUND', message: '规则不存在' });
      }

      const newEnabled = input.enabled !== undefined ? input.enabled : !rule.isEnabled;

      await info('api', '用户切换订阅规则状态', {
        userId: ctx.userId,
        ruleId: rule.id,
        ruleName: rule.name,
        from: rule.isEnabled ? 'enabled' : 'disabled',
        to: newEnabled ? 'enabled' : 'disabled'
      });

      const updated = await ctx.db.subscriptionRule.update({
        where: { id: input.id },
        data: {
          isEnabled: newEnabled,
        },
      });

      return updated;
    }),

  /**
   * 测试规则
   */
  test: protectedProcedure
    .input(
      z.object({
        rule: z.object({
          name: z.string().optional(),
          conditions: z.array(
            z.object({
              field: z.enum(['title', 'content', 'author', 'category', 'tag', 'feedTitle']),
              operator: z.enum(['contains', 'notContains', 'equals', 'notEquals', 'matches', 'in', 'gt', 'lt']),
              value: z.union([z.string(), z.array(z.string()), z.number()]),
            })
          ),
          actions: z.array(
            z.object({
              type: z.enum([
                'markRead',
                'markUnread',
                'star',
                'unstar',
                'archive',
                'unarchive',
                'assignCategory',
                'addTag',
                'removeTag',
                'skip',
              ]),
              params: z.record(z.string(), z.any()).optional(),
            })
          ),
        }),
        sampleCount: z.number().min(1).max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const engine = getRuleEngine();
      const result = await engine.testRule(ctx.userId, input.rule);

      return result;
    }),

  /**
   * 获取匹配历史
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        ruleId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where: any = {
        feed: { userId: ctx.userId },
      };

      if (input.ruleId) {
        // 获取该规则匹配的文章ID（这里简化处理，实际应该有专门的记录表）
        // 暂时返回空数组
        return [];
      }

      // 返回最近应用规则的文章（简化实现）
      const entries = await ctx.db.entry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      });

      return entries;
    }),

  /**
   * 应用规则到现有文章
   */
  applyToEntries: protectedProcedure
    .input(
      z.object({
        ruleId: z.string().uuid(),
        entryIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const rule = await ctx.db.subscriptionRule.findFirst({
        where: {
          id: input.ruleId,
          userId: ctx.userId,
        },
      });

      if (!rule) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '规则不存在' });
      }

      const engine = getRuleEngine();
      const results = [];

      for (const entryId of input.entryIds) {
        const matched = await engine.matchRule(entryId, rule as any);
        if (matched) {
          await engine.executeActions(entryId, rule.actions as any);
          results.push(entryId);
        }
      }

      return {
        success: true,
        processed: results.length,
        total: input.entryIds.length,
      };
    }),

  /**
   * 手动执行规则
   */
  execute: protectedProcedure
    .input(z.object({ ruleId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const rule = await ctx.db.subscriptionRule.findFirst({
        where: {
          id: input.ruleId,
          userId: ctx.userId,
        },
      });

      if (!rule) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '规则不存在' });
      }

      // 获取用户的最新文章
      const entries = await ctx.db.entry.findMany({
        where: {
          feed: { userId: ctx.userId },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const engine = getRuleEngine();
      let processed = 0;

      for (const entry of entries) {
        const matched = await engine.matchRule(entry.id, rule as any);
        if (matched) {
          await engine.executeActions(entry.id, rule.actions as any);
          processed++;
        }
      }

      return {
        success: true,
        processed,
        total: entries.length,
      };
    }),
});
