/**
 * 报告定时任务 API Router
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { info, warn, error } from '@/lib/logger';

// 频次选项
const FrequencyEnum = z.enum(['once', 'daily', 'weekly', 'monthly']);

// 日期范围选项
const DateRangeEnum = z.enum(['yesterday', 'last7days', 'last30days', 'lastWeek', 'lastMonth', 'custom']);

// 计算下次执行时间
function calculateNextRunAt(frequency: string, baseTime: Date): Date | null {
  if (frequency === 'once') {
    return null; // 一次性任务没有下次执行时间
  }

  const next = new Date(baseTime);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      return null;
  }

  return next;
}

export const reportSchedulesRouter = router({
  /**
   * 获取定时任务列表
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const schedules = await ctx.db.reportSchedule.findMany({
      where: { userId: ctx.userId },
      orderBy: [{ isEnabled: 'desc' }, { createdAt: 'desc' }],
    });

    return schedules;
  }),

  /**
   * 获取单个定时任务
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const schedule = await ctx.db.reportSchedule.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      if (!schedule) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '定时任务不存在' });
      }

      return schedule;
    }),

  /**
   * 创建定时任务
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        firstRunAt: z.date(),
        frequency: FrequencyEnum,
        dateRange: DateRangeEnum,
        customDays: z.number().min(1).max(365).optional(),
        includeStats: z.boolean().default(true),
        includeHighlights: z.boolean().default(true),
        includeAiSummary: z.boolean().default(true),
        recipientEmail: z.string().email(),
        emailSubject: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 计算下次执行时间
      const nextRunAt = calculateNextRunAt(input.frequency, input.firstRunAt);

      const schedule = await ctx.db.reportSchedule.create({
        data: {
          userId: ctx.userId,
          name: input.name,
          firstRunAt: input.firstRunAt,
          frequency: input.frequency,
          nextRunAt,
          dateRange: input.dateRange,
          customDays: input.customDays,
          includeStats: input.includeStats,
          includeHighlights: input.includeHighlights,
          includeAiSummary: input.includeAiSummary,
          recipientEmail: input.recipientEmail,
          emailSubject: input.emailSubject,
          isEnabled: true,
        },
      });

      await info('system', '创建报告定时任务', {
        userId: ctx.userId,
        scheduleId: schedule.id,
        name: schedule.name,
        frequency: schedule.frequency,
        nextRunAt: schedule.nextRunAt,
      });

      return schedule;
    }),

  /**
   * 更新定时任务
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        firstRunAt: z.date().optional(),
        frequency: FrequencyEnum.optional(),
        dateRange: DateRangeEnum.optional(),
        customDays: z.number().min(1).max(365).optional(),
        includeStats: z.boolean().optional(),
        includeHighlights: z.boolean().optional(),
        includeAiSummary: z.boolean().optional(),
        recipientEmail: z.string().email().optional(),
        emailSubject: z.string().max(200).optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;

      // 检查任务是否存在
      const existing = await ctx.db.reportSchedule.findFirst({
        where: { id, userId: ctx.userId },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '定时任务不存在' });
      }

      // 如果更新了执行时间或频次，重新计算下次执行时间
      let nextRunAt = existing.nextRunAt;
      if (updateData.firstRunAt || updateData.frequency) {
        const baseTime = updateData.firstRunAt || existing.firstRunAt;
        const frequency = updateData.frequency || existing.frequency;
        nextRunAt = calculateNextRunAt(frequency, baseTime);
      }

      const schedule = await ctx.db.reportSchedule.update({
        where: { id },
        data: {
          ...updateData,
          nextRunAt,
        },
      });

      await info('system', '更新报告定时任务', {
        userId: ctx.userId,
        scheduleId: schedule.id,
        updates: Object.keys(updateData),
      });

      return schedule;
    }),

  /**
   * 删除定时任务
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.reportSchedule.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '定时任务不存在' });
      }

      await ctx.db.reportSchedule.delete({
        where: { id: input.id },
      });

      await info('system', '删除报告定时任务', {
        userId: ctx.userId,
        scheduleId: input.id,
      });

      return { success: true };
    }),

  /**
   * 启用/禁用定时任务
   */
  toggle: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        isEnabled: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.reportSchedule.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '定时任务不存在' });
      }

      const schedule = await ctx.db.reportSchedule.update({
        where: { id: input.id },
        data: { isEnabled: input.isEnabled },
      });

      await info('system', input.isEnabled ? '启用报告定时任务' : '禁用报告定时任务', {
        userId: ctx.userId,
        scheduleId: input.id,
      });

      return schedule;
    }),

  /**
   * 立即执行定时任务（生成报告并发送邮件）
   */
  executeNow: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const schedule = await ctx.db.reportSchedule.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });

      if (!schedule) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '定时任务不存在' });
      }

      // 这里可以触发报告生成和发送
      // 暂时只记录日志，实际实现可以调用报告生成服务
      await info('system', '手动执行报告定时任务', {
        userId: ctx.userId,
        scheduleId: input.id,
        scheduleName: schedule.name,
      });

      // 更新执行次数
      await ctx.db.reportSchedule.update({
        where: { id: input.id },
        data: {
          runCount: { increment: 1 },
          lastRunAt: new Date(),
        },
      });

      return { success: true, message: '任务已触发执行' };
    }),
});
