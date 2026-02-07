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
});
