/**
 * 邮件服务
 * 基于 nodemailer 实现邮件发送功能
 * 安全修复：解密 SMTP 密码
 */

import nodemailer from 'nodemailer';
import { info, warn, error } from '@/lib/logger';
import { safeDecrypt } from '@/lib/crypto/encryption';

/**
 * 转义 HTML 特殊字符
 * 防止邮件中的 HTML 注入
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\//g, "&#x2F;");
}

/**
 * 邮件配置接口
 */
export interface EmailConfig {
  enabled?: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName?: string;
}

/**
 * 邮件发送结果
 */
export interface SendResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * 邮件附件
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/**
 * 邮件服务类
 */
export class EmailService {
  private config: EmailConfig;
  private transporter: nodemailer.Transporter | null = null;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  /**
   * 初始化邮件传输器
   */
  private initTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPassword,
        },
      });
    }
    return this.transporter;
  }

  /**
   * 验证配置
   */
  private validateConfig(): { valid: boolean; message: string } {
    if (!this.config.enabled) {
      return { valid: false, message: '邮件服务未启用' };
    }

    if (!this.config.smtpHost) {
      return { valid: false, message: 'SMTP 服务器地址未配置' };
    }

    if (!this.config.smtpPort) {
      return { valid: false, message: 'SMTP 端口未配置' };
    }

    if (!this.config.smtpUser) {
      return { valid: false, message: 'SMTP 用户名未配置' };
    }

    if (!this.config.smtpPassword) {
      return { valid: false, message: 'SMTP 密码未配置' };
    }

    if (!this.config.fromEmail) {
      return { valid: false, message: '发件人邮箱未配置' };
    }

    return { valid: true, message: '配置有效' };
  }

  /**
   * 发送邮件
   */
  async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
    text?: string,
    attachments?: EmailAttachment[]
  ): Promise<SendResult> {
    try {
      // 验证配置
      const validation = this.validateConfig();
      if (!validation.valid) {
        warn('email', '邮件配置验证失败', { message: validation.message }).catch(() => {});
        return { success: false, message: validation.message };
      }

      // 初始化传输器
      const transporter = this.initTransporter();

      // 构建邮件选项
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.config.fromName
          ? `"${this.config.fromName}" <${this.config.fromEmail}>`
          : this.config.fromEmail,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || this.stripHtml(html),
        attachments: attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType || 'application/octet-stream',
        })),
      };

      // 发送邮件
      const info = await transporter.sendMail(mailOptions);

      // 检查 SMTP 响应，判断是否真正发送成功
      // 成功响应通常包含 250 状态码，如 "250 OK" 或 "250 2.0.0 OK"
      const response = info.response || '';
      const isSuccess = response.includes('250') ||
                        response.toLowerCase().includes('ok') ||
                        response.includes('2.0.0') ||
                        // 某些服务器返回 235 (认证成功后) 或其他 2xx 状态
                        /^2\d{2}/.test(response.trim());

      if (!isSuccess && response) {
        // 有响应但不是成功状态
        warn('email', 'SMTP 响应异常', { response, messageId: info.messageId }).catch(() => {});
        return {
          success: false,
          message: `SMTP 响应异常: ${response || '无响应'}`
        };
      }

      // 记录日志（不阻塞返回）
      info('email', '邮件发送成功', {
        to,
        subject,
        messageId: info.messageId,
        response: response.substring(0, 100), // 只记录前100字符
        hasAttachments: !!attachments?.length,
      }).catch(() => {});

      return { success: true, message: '邮件发送成功' };
    } catch (err: any) {
      const errorMessage = err.message || '发送失败';
      error('email', '邮件发送失败', err, { to, subject, error: errorMessage }).catch(() => {});
      return { success: false, message: `邮件发送失败: ${errorMessage}` };
    }
  }

  /**
   * 发送测试邮件
   */
  async sendTestEmail(to: string, username?: string): Promise<SendResult> {
    const subject = 'Rss-Easy 邮件配置测试';
    const html = this.getTestEmailTemplate(username);
    return this.sendEmail(to, subject, html);
  }

  /**
   * 发送密码重置邮件
   */
  async sendPasswordResetEmail(
    to: string,
    username: string | null,
    resetUrl: string,
    expiresIn: string = '1小时'
  ): Promise<SendResult> {
    const subject = '重置您的 Rss-Easy 密码';
    const html = this.getPasswordResetTemplate(username, resetUrl, expiresIn);
    return this.sendEmail(to, subject, html);
  }

  /**
   * 发送通知邮件（可选功能）
   */
  async sendNotificationEmail(
    to: string,
    username: string | null,
    title: string,
    content: string,
    actionUrl?: string
  ): Promise<SendResult> {
    const subject = `[Rss-Easy] ${title}`;
    const html = this.getNotificationTemplate(username, title, content, actionUrl);
    return this.sendEmail(to, subject, html);
  }

  /**
   * 发送报告邮件
   */
  async sendReportEmail(
    to: string,
    username: string | null,
    report: {
      id: string;
      title: string;
      reportType: 'daily' | 'weekly';
      reportDate: Date;
      summary: string | null;
      content: string | null;
      highlights: string[];
      totalEntries: number;
      totalRead: number;
      totalFeeds: number;
    },
    pdfAttachment?: EmailAttachment
  ): Promise<SendResult> {
    const subject = `[Rss-Easy] ${report.title}`;
    const html = this.getReportEmailTemplate(username, report);
    const text = this.stripHtml(report.content || '');

    // 如果有 PDF 附件，添加附件信息到邮件
    const attachments = pdfAttachment ? [pdfAttachment] : undefined;

    return this.sendEmail(to, subject, html, text, attachments);
  }

  /**
   * 获取测试邮件模板
   */
  private getTestEmailTemplate(username?: string): string {
    const displayName = escapeHtml(username || '用户');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>邮件配置测试</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .content { padding: 30px; }
    .message { font-size: 16px; margin-bottom: 20px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
    .success-icon { font-size: 48px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Rss-Easy</div>
      <p>智能 RSS 资讯聚合平台</p>
    </div>
    <div class="content">
      <div style="text-align: center;">
        <div class="success-icon">✅</div>
        <h2 style="margin-top: 0;">邮件配置测试成功！</h2>
      </div>
      <p class="message">
        您好，${displayName}！
      </p>
      <p class="message">
        这是一封测试邮件，用于验证您的邮件配置是否正确。如果您收到了这封邮件，说明您的 SMTP 配置已经可以正常使用了。
      </p>
      <p class="message">
        发送时间：${new Date().toLocaleString('zh-CN')}
      </p>
    </div>
    <div class="footer">
      <p>此邮件由 Rss-Easy 系统自动发送，请勿回复。</p>
      <p>© ${new Date().getFullYear()} Rss-Easy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 获取密码重置邮件模板
   */
  private getPasswordResetTemplate(
    username: string | null,
    resetUrl: string,
    expiresIn: string
  ): string {
    const displayName = escapeHtml(username || '用户');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重置密码</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .content { padding: 30px; }
    .message { font-size: 16px; margin-bottom: 20px; }
    .button-container { text-align: center; margin: 30px 0; }
    .reset-button { display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
    .reset-button:hover { opacity: 0.9; }
    .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
    .key-icon { font-size: 48px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Rss-Easy</div>
      <p>智能 RSS 资讯聚合平台</p>
    </div>
    <div class="content">
      <div style="text-align: center;">
        <div class="key-icon">🔑</div>
        <h2 style="margin-top: 0;">重置您的密码</h2>
      </div>
      <p class="message">
        您好，${displayName}！
      </p>
      <p class="message">
        我们收到了您重置密码的请求。如果这是您发起的操作，请点击下方按钮设置新密码：
      </p>
      <div class="button-container">
        <a href="${resetUrl}" class="reset-button">重置密码</a>
      </div>
      <p class="message" style="text-align: center; color: #6b7280; font-size: 14px;">
        或者复制以下链接到浏览器打开：<br>
        <span style="word-break: break-all; color: #667eea;">${resetUrl}</span>
      </p>
      <div class="warning">
        <strong>⚠️ 重要提示：</strong>
        <ul style="margin: 10px 0 0 20px; padding: 0;">
          <li>此链接将在 <strong>${expiresIn}</strong> 后失效</li>
          <li>请勿将此链接分享给任何人</li>
          <li>如果您没有发起此请求，请忽略此邮件</li>
        </ul>
      </div>
      <p class="message">
        如果您没有请求重置密码，可能是他人误输入了您的邮箱地址。您的账户仍然是安全的，您可以忽略此邮件继续使用原密码登录。
      </p>
    </div>
    <div class="footer">
      <p>此邮件由 Rss-Easy 系统自动发送，请勿回复。</p>
      <p>© ${new Date().getFullYear()} Rss-Easy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 获取通知邮件模板
   */
  private getNotificationTemplate(
    username: string | null,
    title: string,
    content: string,
    actionUrl?: string
  ): string {
    const displayName = escapeHtml(username || '用户');
    const safeTitle = escapeHtml(title);
    const safeContent = escapeHtml(content);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .content { padding: 30px; }
    .message { font-size: 16px; margin-bottom: 20px; }
    .button-container { text-align: center; margin: 30px 0; }
    .action-button { display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Rss-Easy</div>
      <p>智能 RSS 资讯聚合平台</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">${safeTitle}</h2>
      <p class="message">
        您好，${displayName}！
      </p>
      <div class="message">
        ${safeContent.replace(/\n/g, '<br>')}
      </div>
      ${actionUrl ? `
      <div class="button-container">
        <a href="${actionUrl}" class="action-button">查看详情</a>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>此邮件由 Rss-Easy 系统自动发送，请勿回复。</p>
      <p>© ${new Date().getFullYear()} Rss-Easy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 获取报告邮件模板
   */
  private getReportEmailTemplate(
    username: string | null,
    report: {
      id: string;
      title: string;
      reportType: 'daily' | 'weekly';
      reportDate: Date;
      summary: string | null;
      content: string | null;
      highlights: string[];
      totalEntries: number;
      totalRead: number;
      totalFeeds: number;
    }
  ): string {
    const displayName = escapeHtml(username || '用户');
    const safeTitle = escapeHtml(report.title);
    const safeSummary = escapeHtml(report.summary || '');
    
    // 转换 Markdown 为简单 HTML
    let contentHtml = '';
    if (report.content) {
      // 简单的 Markdown 转换
      contentHtml = report.content
        .replace(/^### (.*$)/gim, '<h3 style="color: #333; margin: 20px 0 10px; font-size: 18px;">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="color: #667eea; margin: 25px 0 15px; font-size: 20px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="color: #333; margin: 30px 0 20px; font-size: 24px;">$1</h1>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^\)]+)\)/gim, '<a href="$2" style="color: #667eea; text-decoration: none;">$1</a>')
        .replace(/^\- (.*$)/gim, '<li style="margin: 8px 0; color: #555;">$1</li>')
        .replace(/(<li>.*<\/li>)/gim, '<ul style="margin: 10px 0; padding-left: 20px;">$1</ul>')
        .replace(/^(?!<[hlu])(.*$)/gim, '<p style="margin: 10px 0; line-height: 1.6; color: #555;">$1</p>')
        .replace(/\n\n/g, '<br>');
    }

    const reportTypeText = report.reportType === 'daily' ? '日报' : '周报';
    const reportTypeColor = report.reportType === 'daily' ? '#3b82f6' : '#8b5cf6';
    const reportTypeIcon = report.reportType === 'daily' ? '📅' : '📊';

    // 生成亮点 HTML
    const highlightsHtml = report.highlights?.length > 0
      ? report.highlights.slice(0, 5).map((h, i) => `
        <div style="padding: 10px; margin: 8px 0; background: #f8fafc; border-radius: 6px; border-left: 3px solid ${reportTypeColor};">
          <span style="color: ${reportTypeColor}; font-weight: bold;">${i + 1}.</span> 
          <span style="color: #333;">${escapeHtml(h)}</span>
        </div>
      `).join('')
      : '<p style="color: #888;">暂无亮点内容</p>';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${reportTypeColor} 0%, #667eea 100%); color: white; padding: 40px 30px; text-align: center; }
    .logo { font-size: 20px; font-weight: bold; margin-bottom: 8px; opacity: 0.9; }
    .report-icon { font-size: 48px; margin-bottom: 15px; }
    .report-title { font-size: 28px; font-weight: bold; margin: 0 0 10px; }
    .report-type { display: inline-block; padding: 6px 16px; background: rgba(255,255,255,0.2); border-radius: 20px; font-size: 14px; margin-top: 10px; }
    .content { padding: 30px; }
    .greeting { font-size: 16px; color: #555; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
    .stats { display: flex; justify-content: space-around; margin: 25px 0; padding: 20px; background: #f8fafc; border-radius: 10px; }
    .stat-item { text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: ${reportTypeColor}; }
    .stat-label { font-size: 12px; color: #888; margin-top: 5px; }
    .section { margin: 30px 0; }
    .section-title { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee; }
    .highlights { background: #fafafa; padding: 20px; border-radius: 10px; }
    .button-container { text-align: center; margin: 30px 0; }
    .view-button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${reportTypeColor} 0%, #667eea 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
    .footer { background-color: #f9fafb; padding: 25px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Rss-Easy</div>
      <div class="report-icon">${reportTypeIcon}</div>
      <h1 class="report-title">${safeTitle}</h1>
      <div class="report-type">${reportTypeText}</div>
    </div>
    <div class="content">
      <div class="greeting">
        您好，${displayName}！<br>
        您的${reportTypeText}已生成，以下是本期阅读摘要。
      </div>

      <div class="stats">
        <div class="stat-item">
          <div class="stat-value">${report.totalEntries}</div>
          <div class="stat-label">新增文章</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${report.totalRead}</div>
          <div class="stat-label">已阅读</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${report.totalFeeds}</div>
          <div class="stat-label">订阅源</div>
        </div>
      </div>

      ${safeSummary ? `
      <div class="section">
        <div class="section-title">📋 摘要</div>
        <p style="color: #555; line-height: 1.8;">${safeSummary}</p>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-title">✨ 精选亮点</div>
        <div class="highlights">
          ${highlightsHtml}
        </div>
      </div>

      <div class="section">
        <div class="section-title">📝 详细内容</div>
        <div style="background: #fafafa; padding: 20px; border-radius: 10px; border-left: 4px solid ${reportTypeColor};">
          ${contentHtml}
        </div>
      </div>

      <div class="button-container">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reports/${report.id}" class="view-button">在网页中查看完整报告</a>
      </div>
    </div>
    <div class="footer">
      <p>此邮件由 Rss-Easy 系统自动发送，请勿回复。</p>
      <p>© ${new Date().getFullYear()} Rss-Easy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 将 HTML 转换为纯文本（备用）
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 验证邮件配置是否有效
   */
  async verifyConnection(): Promise<SendResult> {
    try {
      const validation = this.validateConfig();
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      const transporter = this.initTransporter();
      await transporter.verify();

      info('email', 'SMTP 连接验证成功').catch(() => {});
      return { success: true, message: 'SMTP 连接正常' };
    } catch (err: any) {
      const errorMessage = err.message || '连接失败';
      error('email', 'SMTP 连接验证失败', err, { error: errorMessage }).catch(() => {});
      return { success: false, message: `SMTP 连接失败: ${errorMessage}` };
    }
  }
}

/**
 * 从用户的 emailConfig 创建邮件服务实例
 */
export function createEmailServiceFromUser(emailConfig: any): EmailService | null {
  if (!emailConfig || !emailConfig.enabled) {
    return null;
  }

  // 解密 SMTP 密码（如果已加密）
  let smtpPassword = emailConfig.smtpPassword || '';
  if (smtpPassword) {
    // 尝试解密，如果解密失败则使用原始值（兼容旧数据）
    const decrypted = safeDecrypt(smtpPassword);
    smtpPassword = decrypted || smtpPassword;
  }

  const config: EmailConfig = {
    enabled: emailConfig.enabled,
    smtpHost: emailConfig.smtpHost || '',
    smtpPort: emailConfig.smtpPort || 587,
    smtpSecure: emailConfig.smtpSecure ?? false,
    smtpUser: emailConfig.smtpUser || '',
    smtpPassword,
    fromEmail: emailConfig.fromEmail || '',
    fromName: emailConfig.fromName || 'Rss-Easy',
  };

  return new EmailService(config);
}

/**
 * 获取系统默认邮件服务（使用环境变量配置）
 */
export function createSystemEmailService(): EmailService | null {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    return null;
  }

  const config: EmailConfig = {
    enabled: true,
    smtpHost,
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
    fromName: process.env.SMTP_FROM_NAME || 'Rss-Easy',
  };

  return new EmailService(config);
}
