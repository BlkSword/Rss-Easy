/**
 * Reports API Router
 * 安全修复：使用加密安全的随机令牌生成
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { getReportGenerator } from '@/lib/reports/generator';
import { asyncReportGenerator } from '@/lib/reports/async-generator';
import { checkAIConfigQuick, getUserAIConfig } from '@/lib/ai/health-check';
import { createEmailServiceFromUser, type EmailAttachment } from '@/lib/email/service';
import { convertMarkdownToPdf } from '@/lib/reports/pdf-converter';
import { info, warn, error } from '@/lib/logger';
import { randomBytes } from 'crypto';

export const reportsRouter = router({
  /**
   * 快速检查AI配置（不发送API请求）
   * 只检查用户级别的配置，不回退到环境变量
   */
  checkAIConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const aiConfig = await getUserAIConfig(ctx.userId, ctx.db);

      // 检查用户是否明确配置了 AI
      // 必须有 provider 和 apiKey 才算配置完成
      const hasProvider = !!(aiConfig?.provider);
      const hasApiKey = !!(aiConfig?.apiKey);

      if (!hasProvider && !hasApiKey) {
        return {
          success: false,
          message: '未配置AI服务',
          error: '请在设置中配置AI提供商和API密钥',
        };
      }

      if (!hasProvider) {
        return {
          success: false,
          message: '未选择AI提供商',
          error: '请在设置中选择AI提供商',
        };
      }

      if (!hasApiKey) {
        return {
          success: false,
          message: '未配置API密钥',
          error: '请在设置中配置API密钥',
        };
      }

      return {
        success: true,
        message: 'AI配置已就绪',
        provider: aiConfig.provider,
        model: aiConfig.model,
      };
    }),

  /**
   * 启动异步生成日报
   */
  startGenerateDaily: protectedProcedure
    .input(
      z.object({
        reportDate: z.date().default(() => new Date()),
        aiGenerated: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await info('system', '用户请求生成日报', {
        userId: ctx.userId,
        reportDate: input.reportDate.toISOString(),
        aiGenerated: input.aiGenerated
      });

      const result = await asyncReportGenerator.startGeneration(
        ctx.userId,
        'daily',
        input.reportDate,
        input.aiGenerated
      );

      if (!result.success) {
        await error('system', '日报生成启动失败', undefined, {
          userId: ctx.userId,
          error: result.error
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || '启动生成失败',
        });
      }

      await info('system', '日报生成启动成功', {
        userId: ctx.userId,
        reportId: result.report?.id
      });

      return result.report;
    }),

  /**
   * 启动异步生成周报
   */
  startGenerateWeekly: protectedProcedure
    .input(
      z.object({
        reportDate: z.date().default(() => new Date()),
        aiGenerated: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await info('system', '用户请求生成周报', {
        userId: ctx.userId,
        reportDate: input.reportDate.toISOString(),
        aiGenerated: input.aiGenerated
      });

      const result = await asyncReportGenerator.startGeneration(
        ctx.userId,
        'weekly',
        input.reportDate,
        input.aiGenerated
      );

      if (!result.success) {
        await error('system', '周报生成启动失败', undefined, {
          userId: ctx.userId,
          error: result.error
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || '启动生成失败',
        });
      }

      await info('system', '周报生成启动成功', {
        userId: ctx.userId,
        reportId: result.report?.id
      });

      return result.report;
    }),

  /**
   * 获取报告生成进度
   */
  getProgress: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const progress = await asyncReportGenerator.getProgress(input.id, ctx.userId);

      if (!progress) {
        await warn('system', '查询报告进度失败，报告不存在', {
          userId: ctx.userId,
          reportId: input.id
        });
        throw new TRPCError({ code: 'NOT_FOUND', message: '报告不存在' });
      }

      return progress;
    }),

  /**
   * 取消报告生成
   */
  cancelGeneration: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await info('system', '用户取消报告生成', {
        userId: ctx.userId,
        reportId: input.id
      });

      await asyncReportGenerator.cancelGeneration(input.id, ctx.userId);

      await info('system', '报告生成已取消', {
        userId: ctx.userId,
        reportId: input.id
      });

      return { success: true };
    }),

  /**
   * 生成日报（同步，兼容旧版）
   */
  generateDaily: protectedProcedure
    .input(
      z.object({
        reportDate: z.date().default(() => new Date()),
        aiGenerated: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const generator = getReportGenerator();
      const report = await generator.generateDailyReport(
        ctx.userId,
        input.reportDate,
        input.aiGenerated
      );
      return report;
    }),

  /**
   * 生成周报（同步，兼容旧版）
   */
  generateWeekly: protectedProcedure
    .input(
      z.object({
        reportDate: z.date().default(() => new Date()),
        aiGenerated: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const generator = getReportGenerator();
      const report = await generator.generateWeeklyReport(
        ctx.userId,
        input.reportDate,
        input.aiGenerated
      );
      return report;
    }),

  /**
   * 获取报告列表
   */
  list: protectedProcedure
    .input(
      z.object({
        reportType: z.enum(['daily', 'weekly']).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const { reportType, limit, offset } = input;

      const [reports, total] = await Promise.all([
        ctx.db.report.findMany({
          where: {
            userId: ctx.userId,
            ...(reportType && { reportType }),
          },
          include: {
            entries: {
              include: {
                entry: {
                  include: {
                    feed: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                rank: 'asc',
              },
              take: 10,
            },
          },
          orderBy: {
            reportDate: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        ctx.db.report.count({
          where: {
            userId: ctx.userId,
            ...(reportType && { reportType }),
          },
        }),
      ]);

      return {
        items: reports,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    }),

  /**
   * 获取单个报告
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const report = await ctx.db.report.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        include: {
          entries: {
            include: {
              entry: {
                include: {
                  feed: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              rank: 'asc',
            },
          },
        },
      });

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '报告不存在' });
      }

      return report;
    }),

  /**
   * 转换报告格式
   */
  convertFormat: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        format: z.enum(['markdown', 'html', 'json']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const report = await ctx.db.report.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '报告不存在' });
      }

      const generator = getReportGenerator();
      const content = await generator.convertReportFormat(input.id, input.format);

      // 更新报告格式
      await ctx.db.report.update({
        where: { id: input.id },
        data: { format: input.format },
      });

      return { content, format: input.format };
    }),

  /**
   * 删除报告
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.report.delete({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      return { success: true };
    }),

  /**
   * 生成分享链接
   * 安全修复：使用加密安全的随机令牌
   */
  generateShareToken: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // 生成加密安全的随机 token
      const shareToken = randomBytes(32).toString('base64url');

      await ctx.db.report.update({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        data: {
          isPublic: true,
          shareToken,
        },
      });

      return { shareToken };
    }),

  /**
   * 取消分享
   */
  revokeShare: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.report.update({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        data: {
          isPublic: false,
          shareToken: null,
        },
      });

      return { success: true };
    }),

  /**
   * 发送报告到邮箱
   */
  sendByEmail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await info('system', '用户请求发送报告邮件', {
        userId: ctx.userId,
        reportId: input.id
      });

      // 1. 获取报告
      const report = await ctx.db.report.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '报告不存在' });
      }

      if (report.status !== 'completed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '报告尚未生成完成，无法发送' });
      }

      // 2. 获取用户邮箱配置
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { email: true, username: true, emailConfig: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
      }

      // 3. 检查邮件配置
      const emailConfig = user.emailConfig as any;
      if (!emailConfig?.enabled) {
        return {
          success: false,
          message: '邮件服务未启用，请先在设置中配置邮件',
        };
      }

      // 4. 创建邮件服务
      const emailService = createEmailServiceFromUser(emailConfig);
      if (!emailService) {
        return {
          success: false,
          message: '邮件服务配置无效，请检查邮件设置',
        };
      }

      // 5. 生成 PDF 附件
      let pdfAttachment: EmailAttachment | undefined;
      if (report.content) {
        try {
          const pdfResult = await convertMarkdownToPdf(report.content, {
            title: report.title,
          });

          if (pdfResult.success && pdfResult.pdfBuffer) {
            const dateStr = report.reportDate.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).replace(/\//g, '-');
            const reportTypeText = report.reportType === 'daily' ? '日报' : '周报';

            pdfAttachment = {
              filename: `${reportTypeText}_${dateStr}.pdf`,
              content: pdfResult.pdfBuffer,
              contentType: 'application/pdf',
            };

            await info('system', 'PDF 附件生成成功', {
              reportId: input.id,
              pdfSize: pdfResult.pdfBuffer.length,
            });
          }
        } catch (pdfError) {
          // PDF 生成失败不影响邮件发送
          await warn('system', 'PDF 附件生成失败，将发送无附件邮件', {
            reportId: input.id,
            error: pdfError instanceof Error ? pdfError.message : String(pdfError),
          });
        }
      }

      // 6. 发送邮件（包含 PDF 附件）
      const sendResult = await emailService.sendReportEmail(
        user.email,
        user.username,
        {
          id: report.id,
          title: report.title,
          reportType: report.reportType as 'daily' | 'weekly',
          reportDate: report.reportDate,
          summary: report.summary,
          content: report.content,
          highlights: report.highlights,
          totalEntries: report.totalEntries,
          totalRead: report.totalRead,
          totalFeeds: report.totalFeeds,
        },
        pdfAttachment
      );

      if (sendResult.success) {
        await info('system', '报告邮件发送成功', {
          userId: ctx.userId,
          reportId: input.id,
          email: user.email,
          hasPdfAttachment: !!pdfAttachment,
        });
      } else {
        await error('system', '报告邮件发送失败', undefined, {
          userId: ctx.userId,
          reportId: input.id,
          error: sendResult.message,
        });
      }

      return {
        success: sendResult.success,
        message: sendResult.message + (pdfAttachment ? '（含 PDF 附件）' : ''),
      };
    }),

  /**
   * 检查报告邮件配置状态
   */
  checkEmailConfig: protectedProcedure
    .output(z.object({
      enabled: z.boolean(),
      configured: z.boolean(),
      email: z.string().optional(),
      message: z.string(),
    }))
    .query(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { email: true, emailConfig: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
      }

      const emailConfig = user.emailConfig as any;
      const enabled = emailConfig?.enabled ?? false;
      const configured = !!(emailConfig?.smtpHost && emailConfig?.smtpUser);

      let message = '';
      if (!enabled) {
        message = '邮件服务未启用';
      } else if (!configured) {
        message = '邮件服务配置不完整';
      } else {
        message = '邮件服务已配置';
      }

      return {
        enabled,
        configured,
        email: user.email,
        message,
      };
    }),
});
