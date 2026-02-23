/**
 * Settings API Router
 * 用户设置管理
 * 安全修复：
 * - 敏感配置遮蔽、SMTP密码加密
 * - 危险操作使用 CSRF 保护
 * - 账户删除需要密码验证
 */

import { z } from 'zod';
import { protectedProcedure, protectedMutation, router } from '../trpc/init';
import { info, error, warn } from '@/lib/logger';
import { createEmailServiceFromUser } from '@/lib/email/service';
import { encrypt, safeDecrypt } from '@/lib/crypto/encryption';
import { verifyPassword } from '@/lib/auth/password';

/**
 * 遮蔽敏感字符串，只显示前后几个字符
 */
function maskSensitive(value: string | undefined, showChars: number = 4): string {
  if (!value) return '';
  if (value.length <= showChars * 2) return '****';
  return `${value.slice(0, showChars)}${'*'.repeat(Math.min(8, value.length - showChars * 2))}${value.slice(-showChars)}`;
}

export const settingsRouter = router({
  /**
   * 获取用户设置
   * 安全修复：遮蔽敏感配置（API Key, SMTP 密码）
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
        emailConfig: true,
      },
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    // 处理 AI 配置
    const aiConfig = (user.aiConfig as any) || {};
    const maskedAiConfig = { ...aiConfig };

    // 遮蔽 API Key（解密后只显示部分）
    if (aiConfig.apiKey) {
      const decryptedKey = safeDecrypt(aiConfig.apiKey);
      maskedAiConfig.apiKey = maskSensitive(decryptedKey);
      maskedAiConfig.hasApiKey = !!decryptedKey;
    }

    // 处理邮件配置
    const emailConfig = (user.emailConfig as any) || {};
    const maskedEmailConfig = { ...emailConfig };

    // 遮蔽 SMTP 密码
    if (emailConfig.smtpPassword) {
      const decryptedPassword = safeDecrypt(emailConfig.smtpPassword);
      maskedEmailConfig.smtpPassword = maskSensitive(decryptedPassword);
      maskedEmailConfig.hasSmtpPassword = !!decryptedPassword;
    }

    return {
      ...user,
      aiConfig: maskedAiConfig,
      emailConfig: maskedEmailConfig,
    };
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

      // 检查是否修改了敏感配置（provider, model, apiKey, baseURL）
      const sensitiveFields = ['provider', 'model', 'apiKey', 'baseURL'];
      const modifiedSensitiveField = sensitiveFields.some(field =>
        input[field as keyof typeof input] !== undefined &&
        input[field as keyof typeof input] !== currentConfig[field]
      );

      // 只复制非 undefined 的字段
      Object.keys(input).forEach(key => {
        const value = input[key as keyof typeof input];
        if (value !== undefined) {
          // 如果是 apiKey，加密后再存储
          if (key === 'apiKey' && typeof value === 'string' && value) {
            (updatedConfig as any)[key] = encrypt(value);
          } else {
            (updatedConfig as any)[key] = value;
          }
        }
      });

      // 如果修改了敏感配置，清除验证标志并禁用功能
      if (modifiedSensitiveField) {
        (updatedConfig as any).configValid = false;
        // 保留用户的功能开关设置，但清空验证标志
        // 这样用户需要重新测试才能启用功能
      }

      const user = await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          aiConfig: updatedConfig as any,
        },
      });

      await info('ai', '更新AI配置', {
        userId: ctx.userId,
        provider: updatedConfig.provider,
        configValid: updatedConfig.configValid,
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
        newPassword: z
          .string()
          .min(8, '密码长度至少为8个字符')
          .regex(/[a-zA-Z]/, '密码必须包含字母')
          .regex(/\d/, '密码必须包含数字'),
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
   * 安全增强：需要密码验证 + CSRF 保护
   */
  deleteAccount: protectedMutation
    .input(
      z.object({
        password: z.string().min(1, '请输入密码以确认删除'),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      // 验证密码
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { passwordHash: true, email: true },
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const isValidPassword = await verifyPassword(input.password, user.passwordHash);

      if (!isValidPassword) {
        await warn('security', '账户删除密码验证失败', {
          userId: ctx.userId,
        });
        throw new Error('密码错误，无法删除账户');
      }

      // 删除用户的所有数据
      await ctx.db.user.delete({
        where: { id: ctx.userId },
      });

      await info('security', '账户已删除', { userId: ctx.userId, email: user.email });

      return { success: true };
    }),

  /**
   * 清空所有文章
   * 安全增强：使用 CSRF 保护
   */
  clearAllEntries: protectedMutation
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      await ctx.db.entry.deleteMany({
        where: {
          feed: { userId: ctx.userId },
        },
      });

      await info('system', '清空所有文章', { userId: ctx.userId });

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

      await info('security', '删除 API Key', { userId: ctx.userId, apiKeyId: input.id });

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
   * 预览 OPML 文件
   * 解析 OPML 并返回将要导入的订阅源列表，不执行实际导入
   */
  previewOPML: protectedProcedure
    .input(
      z.object({
        opmlContent: z.string(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        title: z.string(),
        feeds: z.array(z.object({
          url: z.string(),
          title: z.string(),
          category: z.string().optional(),
        })),
        categories: z.array(z.string()),
        error: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { previewOPML } = await import('@/lib/opml/importer');
      return previewOPML(input.opmlContent);
    }),

  /**
   * 导入OPML（智能版）
   * 与添加订阅源流程对齐，使用智能发现功能
   */
  importOPML: protectedProcedure
    .input(
      z.object({
        opmlContent: z.string(),
        categoryId: z.string().optional(),
        skipDiscovery: z.boolean().optional(), // 跳过智能发现
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        created: z.number(),
        skipped: z.number(),
        failed: z.number(),
        total: z.number(),
        details: z.array(z.object({
          url: z.string(),
          title: z.string(),
          status: z.enum(['imported', 'skipped', 'failed']),
          message: z.string().optional(),
        })),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { opmlContent, categoryId, skipDiscovery } = input;

      const { smartImportOPML } = await import('@/lib/opml/importer');
      const result = await smartImportOPML(opmlContent, {
        userId: ctx.userId,
        categoryId,
        skipDiscovery,
      });

      return {
        success: result.success,
        created: result.imported,
        skipped: result.skipped,
        failed: result.failed,
        total: result.total,
        details: result.details,
      };
    }),

  /**
   * 获取 OPML 导入进度
   */
  getImportProgress: protectedProcedure
    .output(z.object({
      phase: z.enum(['parsing', 'discovering', 'creating', 'fetching', 'completed']),
      current: z.number(),
      total: z.number(),
      currentItem: z.string().optional(),
      message: z.string(),
      stats: z.object({
        imported: z.number(),
        skipped: z.number(),
        failed: z.number(),
      }),
    }).nullable())
    .query(async ({ ctx }) => {
      const { getImportProgress } = await import('@/lib/opml/importer');
      return getImportProgress(ctx.userId);
    }),

  /**
   * 清除导入进度
   */
  clearImportProgress: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { clearImportProgress } = await import('@/lib/opml/importer');
      clearImportProgress(ctx.userId);
      return { success: true };
    }),

  /**
   * 更新邮件配置
   * 安全修复：加密 SMTP 密码
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

      const currentConfig = (current?.emailConfig as any) || {};
      const updatedConfig = { ...currentConfig };

      // 处理每个字段
      Object.keys(input).forEach(key => {
        const value = input[key as keyof typeof input];
        if (value !== undefined) {
          // 如果是 SMTP 密码，加密后存储
          if (key === 'smtpPassword' && typeof value === 'string' && value) {
            updatedConfig[key] = encrypt(value);
          } else {
            updatedConfig[key] = value;
          }
        }
      });

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

      await info('system', '更新邮件配置', { userId: ctx.userId });

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

        // 解密数据库中的API密钥（如果存在）
        const decryptedDbConfig = { ...dbConfig };
        if (dbConfig.apiKey) {
          decryptedDbConfig.apiKey = safeDecrypt(dbConfig.apiKey);
        }

        // 如果input为空，只使用数据库配置；否则合并
        const testConfig = input ? { ...decryptedDbConfig, ...input } : decryptedDbConfig;

        const { checkAIConfig } = await import('@/lib/ai/health-check');
        const result = await checkAIConfig(testConfig);

        // 测试通过，保存验证标志和配置
        if (result.success) {
          const updatedConfig = { ...dbConfig };

          // 如果有新的输入值，更新配置
          if (input) {
            Object.keys(input).forEach(key => {
              const value = input[key as keyof typeof input];
              if (value !== undefined) {
                // 如果是 apiKey，加密后再存储
                if (key === 'apiKey' && typeof value === 'string' && value) {
                  (updatedConfig as any)[key] = encrypt(value);
                } else {
                  (updatedConfig as any)[key] = value;
                }
              }
            });
          }

          // 标记配置已验证
          (updatedConfig as any).configValid = true;
          (updatedConfig as any).lastTestedAt = new Date().toISOString();

          // 如果是第一次测试成功，设置默认值
          if ((updatedConfig as any).autoSummary === undefined) {
            (updatedConfig as any).autoSummary = false;
          }
          if ((updatedConfig as any).autoCategorize === undefined) {
            (updatedConfig as any).autoCategorize = false;
          }
          if ((updatedConfig as any).aiQueueEnabled === undefined) {
            (updatedConfig as any).aiQueueEnabled = false;
          }

          await ctx.db.user.update({
            where: { id: ctx.userId },
            data: { aiConfig: updatedConfig as any },
          });

          await info('ai', 'AI配置测试通过并保存', {
            userId: ctx.userId,
            provider: result.provider,
            model: result.model,
          });
        }

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
   * 支持传入配置参数进行测试（无需先保存）
   */
  testEmailConfig: protectedProcedure
    .input(z.object({
      // 可选传入配置参数，不传则从数据库读取
      config: z.object({
        smtpHost: z.string().optional(),
        smtpPort: z.number().optional(),
        smtpSecure: z.boolean().optional(),
        smtpUser: z.string().optional(),
        smtpPassword: z.string().optional(),
        fromEmail: z.string().optional(),
        fromName: z.string().optional(),
      }).optional(),
    }).optional())
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const user = await ctx.db.user.findUnique({
          where: { id: ctx.userId },
          select: { email: true, emailConfig: true, username: true },
        });

        if (!user) {
          return { success: false, message: '用户不存在' };
        }

        // 使用传入的配置或数据库中的配置
        const dbConfig = (user.emailConfig as any) || {};
        const inputConfig = input?.config || {};

        const config = {
          enabled: dbConfig.enabled ?? true,
          smtpHost: inputConfig.smtpHost || dbConfig.smtpHost,
          smtpPort: inputConfig.smtpPort || dbConfig.smtpPort || 587,
          smtpSecure: inputConfig.smtpSecure ?? dbConfig.smtpSecure ?? false,
          smtpUser: inputConfig.smtpUser || dbConfig.smtpUser,
          smtpPassword: inputConfig.smtpPassword || dbConfig.smtpPassword,
          fromEmail: inputConfig.fromEmail || dbConfig.fromEmail,
          fromName: inputConfig.fromName || dbConfig.fromName,
        };

        // 详细验证缺失字段
        const missingFields: string[] = [];
        if (!config.smtpHost) missingFields.push('SMTP 服务器地址');
        if (!config.smtpUser) missingFields.push('用户名');
        if (!config.smtpPassword && !dbConfig.smtpPassword) missingFields.push('密码');
        if (!config.fromEmail) missingFields.push('发件人邮箱');
        if (!user.email) missingFields.push('用户邮箱（接收测试邮件）');

        if (missingFields.length > 0) {
          return {
            success: false,
            message: `请填写以下必填项: ${missingFields.join('、')}`,
          };
        }

        // 创建邮件服务并发送测试邮件
        const emailService = createEmailServiceFromUser(config as any);

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

        // 记录日志（不阻塞返回）
        if (sendResult.success) {
          info('system', '测试邮件发送成功', { userId: ctx.userId, email: user.email }).catch(() => {});
        } else {
          error('system', '测试邮件发送失败', undefined, { userId: ctx.userId, error: sendResult.message }).catch(() => {});
        }

        return sendResult;
      } catch (err: any) {
        error('system', '测试邮件配置异常', err, { userId: ctx.userId, error: err.message }).catch(() => {});
        return { success: false, message: err.message || '发送测试邮件失败' };
      }
    }),

  /**
   * 获取报告邮件设置
   */
  getReportEmailSettings: protectedProcedure
    .output(z.object({
      autoSendDaily: z.boolean(),
      autoSendWeekly: z.boolean(),
      dailySendTime: z.string(),
      weeklySendDay: z.number(),
      weeklySendTime: z.string(),
    }))
    .query(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { emailConfig: true },
      });

      const emailConfig = (user?.emailConfig as any) || {};
      const reportSettings = emailConfig.reportSettings || {};

      return {
        autoSendDaily: reportSettings.autoSendDaily ?? false,
        autoSendWeekly: reportSettings.autoSendWeekly ?? false,
        dailySendTime: reportSettings.dailySendTime ?? '09:00',
        weeklySendDay: reportSettings.weeklySendDay ?? 1, // 默认周一
        weeklySendTime: reportSettings.weeklySendTime ?? '09:00',
      };
    }),

  /**
   * 更新报告邮件设置
   */
  updateReportEmailSettings: protectedProcedure
    .input(z.object({
      autoSendDaily: z.boolean().optional(),
      autoSendWeekly: z.boolean().optional(),
      dailySendTime: z.string().optional(),
      weeklySendDay: z.number().min(0).max(6).optional(),
      weeklySendTime: z.string().optional(),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { emailConfig: true },
      });

      const currentConfig = (user?.emailConfig as any) || {};
      const currentReportSettings = currentConfig.reportSettings || {};

      const updatedConfig = {
        ...currentConfig,
        reportSettings: {
          ...currentReportSettings,
          ...Object.fromEntries(Object.entries(input).filter(([_, v]) => v !== undefined)),
        },
      };

      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: { emailConfig: updatedConfig },
      });

      await info('system', '更新报告邮件设置', {
        userId: ctx.userId,
        settings: updatedConfig.reportSettings,
      });

      return { success: true };
    }),
});
