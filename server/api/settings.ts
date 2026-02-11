/**
 * Settings API Router
 * 用户设置管理
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc/init';
import { info, error } from '@/lib/logger';
import { createEmailServiceFromUser } from '@/lib/email/service';

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
    .output(
      z.object({
        id: z.string(),
        username: z.string(),
        email: z.string(),
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
        showFullContent: z.boolean().optional(),
        showUnreadCount: z.boolean().optional(),
        emailNotifications: z.boolean().optional(),
        digestFrequency: z.enum(['realtime', 'hourly', 'daily', 'weekly']).optional(),
        notifyNewEntries: z.boolean().optional(),
        notifyErrors: z.boolean().optional(),
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

      await info('system', '更新偏好设置', { userId: ctx.userId });

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
        baseURL: z.string().optional(),
        autoSummary: z.boolean().optional(),
        autoCategorize: z.boolean().optional(),
        aiQueueEnabled: z.boolean().optional(),
      })
    )
    .output(
      z.object({
        id: z.string(),
        username: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 获取当前配置
      const current = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { aiConfig: true },
      });

      // 合并配置：只更新明确提供的字段（过滤掉 undefined）
      const currentConfig = (current?.aiConfig as any) || {};
      const updatedConfig = { ...currentConfig };

      // 只复制非 undefined 的字段
      Object.keys(input).forEach(key => {
        const value = input[key as keyof typeof input];
        if (value !== undefined) {
          (updatedConfig as any)[key] = value;
        }
      });

      const user = await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          aiConfig: updatedConfig as any,
        },
      });

      await info('ai', '更新AI配置', {
        userId: ctx.userId,
        provider: updatedConfig.provider
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
    .output(
      z.object({
        success: z.boolean(),
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
  deleteAccount: protectedProcedure
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      // 删除用户的所有数据
      await ctx.db.user.delete({
        where: { id: ctx.userId },
      });

      return { success: true };
    }),

  /**
   * 清空所有文章
   */
  clearAllEntries: protectedProcedure
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
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

  /**
   * 获取API密钥列表
   */
  getApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const apiKeys = await ctx.db.apiKey.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      key: key.keyPrefix + '***',
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      isActive: !key.expiresAt || key.expiresAt > new Date(),
    }));
  }),

  /**
   * 创建API密钥
   */
  createApiKey: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        expiresIn: z.number().optional(), // 过期时间（天数），0表示永不过期
      })
    )
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        key: z.string(),
        keyPrefix: z.string(),
        createdAt: z.date(),
        expiresAt: z.date().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { name, expiresIn } = input;

      // 生成API密钥
      const crypto = await import('crypto');
      const keyValue = `rss_${crypto.randomBytes(32).toString('hex')}`;
      const keyPrefix = keyValue.slice(0, 8);

      // 计算过期时间
      let expiresAt: Date | null = null;
      if (expiresIn && expiresIn > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresIn);
      }

      // 创建密钥哈希用于存储
      const cryptoHash = crypto.createHash('sha256');
      cryptoHash.update(keyValue);
      const keyHash = cryptoHash.digest('hex');

      const apiKey = await ctx.db.apiKey.create({
        data: {
          userId: ctx.userId,
          name,
          keyHash,
          keyPrefix,
          expiresAt,
        },
      });

      // 只在创建时返回完整密钥
      return {
        id: apiKey.id,
        name: apiKey.name,
        key: keyValue,
        keyPrefix: apiKey.keyPrefix,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      };
    }),

  /**
   * 删除API密钥
   */
  deleteApiKey: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.apiKey.deleteMany({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      });

      return { success: true };
    }),

  /**
   * 导出OPML
   */
  exportOPML: protectedProcedure
    .output(
      z.object({
        opml: z.string(),
        filename: z.string(),
      })
    )
    .mutation(async ({ ctx }) => {
    const feeds = await ctx.db.feed.findMany({
      where: { userId: ctx.userId },
      include: { category: true },
    });

    // 生成OPML内容
    let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Rss-Easy 订阅源导出</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
`;

    // 按分类组织
    const byCategory: Record<string, typeof feeds> = {};
    const uncategorized: typeof feeds = [];

    for (const feed of feeds) {
      if (feed.category) {
        if (!byCategory[feed.category.name]) {
          byCategory[feed.category.name] = [];
        }
        byCategory[feed.category.name].push(feed);
      } else {
        uncategorized.push(feed);
      }
    }

    // 输出分类
    for (const [categoryName, categoryFeeds] of Object.entries(byCategory)) {
      opml += `    <outline text="${categoryName}">\n`;
      for (const feed of categoryFeeds) {
        opml += `      <outline type="rss" text="${feed.title}" xmlUrl="${feed.feedUrl}" htmlUrl="${feed.siteUrl || ''}" />\n`;
      }
      opml += `    </outline>\n`;
    }

    // 输出未分类
    for (const feed of uncategorized) {
      opml += `    <outline type="rss" text="${feed.title}" xmlUrl="${feed.feedUrl}" htmlUrl="${feed.siteUrl || ''}" />\n`;
    }

    opml += `  </body>
</opml>`;

    return {
      opml,
      filename: `rss-easy-export-${new Date().toISOString().split('T')[0]}.opml`,
    };
  }),

  /**
   * 导入OPML
   */
  importOPML: protectedProcedure
    .input(
      z.object({
        opmlContent: z.string(),
        categoryId: z.string().optional(),
      })
    )
    .output(
      z.object({
        created: z.number(),
        skipped: z.number(),
        total: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { opmlContent, categoryId } = input;

      // 简单的OPML解析
      const feedUrls: string[] = [];
      const urlRegex = /xmlUrl="([^"]+)"/g;
      let match;
      while ((match = urlRegex.exec(opmlContent)) !== null) {
        feedUrls.push(match[1]);
      }

      // 去重
      const uniqueUrls = [...new Set(feedUrls)];

      let created = 0;
      let skipped = 0;

      for (const url of uniqueUrls) {
        try {
          // 检查是否已存在
          const existing = await ctx.db.feed.findFirst({
            where: {
              userId: ctx.userId,
              feedUrl: url,
            },
          });

          if (existing) {
            skipped++;
            continue;
          }

          // 创建订阅源（后台任务会处理抓取）
          await ctx.db.feed.create({
            data: {
              userId: ctx.userId,
              feedUrl: url,
              title: url,
              categoryId,
            },
          });

          created++;
        } catch (error) {
          console.error(`导入失败: ${url}`, error);
        }
      }

      return {
        created,
        skipped,
        total: uniqueUrls.length,
      };
    }),

  /**
   * 更新邮件配置
   */
  updateEmailConfig: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.number().optional(),
        smtpSecure: z.boolean().optional(),
        smtpUser: z.string().optional(),
        smtpPassword: z.string().optional(),
        fromEmail: z.string().email().optional(),
        fromName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 获取当前配置
      const current = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { emailConfig: true },
      });

      const updatedConfig = {
        ...((current?.emailConfig as any) || {}),
        ...input,
      };

      // 如果密码为空字符串，保留原密码
      if (input.smtpPassword === '') {
        delete updatedConfig.smtpPassword;
      }

      const user = await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          emailConfig: updatedConfig as any,
        },
      });

      return { success: true };
    }),

  /**
   * 测试AI配置
   */
  testAIConfig: protectedProcedure
    .input(z.object({
      provider: z.enum(['openai', 'anthropic', 'deepseek', 'ollama', 'custom']).optional(),
      model: z.string().optional(),
      apiKey: z.string().optional(),
      baseURL: z.string().optional(),
    }).optional())
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
      provider: z.string().optional(),
      model: z.string().optional(),
      error: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // 获取数据库中的配置
        const user = await ctx.db.user.findUnique({
          where: { id: ctx.userId },
          select: { aiConfig: true },
        });

        if (!user) {
          return { success: false, message: '用户不存在' };
        }

        // 合并配置：数据库配置 + 传入的测试配置
        const dbConfig = (user.aiConfig as any) || {};
        const testConfig = input ? { ...dbConfig, ...input } : dbConfig;

        const { checkAIConfig } = await import('@/lib/ai/health-check');
        const result = await checkAIConfig(testConfig);

        return result;
      } catch (err: any) {
        return {
          success: false,
          message: 'AI配置测试失败',
          error: err.message || '未知错误',
        };
      }
    }),

  /**
   * 测试邮件配置
   */
  testEmailConfig: protectedProcedure
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ ctx }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { id: ctx.userId },
          select: { email: true, emailConfig: true, username: true },
        });

        if (!user) {
          return { success: false, message: '用户不存在' };
        }

        const config = user.emailConfig as any;
        if (!config?.enabled || !config?.smtpHost || !config?.smtpUser) {
          return { success: false, message: '邮件配置未完成，请填写所有必填项' };
        }

        // 创建邮件服务并发送测试邮件
        const emailService = createEmailServiceFromUser(user.emailConfig);

        if (!emailService) {
          return { success: false, message: '邮件服务未启用' };
        }

        // 验证连接
        const verifyResult = await emailService.verifyConnection();
        if (!verifyResult.success) {
          return { success: false, message: `SMTP 连接失败: ${verifyResult.message}` };
        }

        // 发送测试邮件
        const sendResult = await emailService.sendTestEmail(user.email, user.username);

        if (sendResult.success) {
          await info('system', '测试邮件发送成功', { userId: ctx.userId, email: user.email });
        } else {
          await error('system', '测试邮件发送失败', undefined, { userId: ctx.userId, error: sendResult.message });
        }

        return sendResult;
      } catch (err: any) {
        await error('system', '测试邮件配置异常', err, { userId: ctx.userId, error: err.message });
        return { success: false, message: err.message || '发送测试邮件失败' };
      }
    }),
});
