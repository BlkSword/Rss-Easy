/**
 * 邮件服务
 * 基于 nodemailer 实现邮件发送功能
 */

import nodemailer from 'nodemailer';
import { info, warn, error } from '@/lib/logger';

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
    text?: string
  ): Promise<SendResult> {
    try {
      // 验证配置
      const validation = this.validateConfig();
      if (!validation.valid) {
        await warn('email', '邮件配置验证失败', { message: validation.message });
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
      };

      // 发送邮件
      const info = await transporter.sendMail(mailOptions);

      await info('email', '邮件发送成功', {
        to,
        subject,
        messageId: info.messageId,
      });

      return { success: true, message: '邮件发送成功' };
    } catch (err: any) {
      const errorMessage = err.message || '发送失败';
      await error('email', '邮件发送失败', err, { to, subject, error: errorMessage });
      return { success: false, message: '邮件发送失败', error: errorMessage };
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

      await info('email', 'SMTP 连接验证成功');
      return { success: true, message: 'SMTP 连接正常' };
    } catch (err: any) {
      const errorMessage = err.message || '连接失败';
      await error('email', 'SMTP 连接验证失败', err, { error: errorMessage });
      return { success: false, message: 'SMTP 连接失败', error: errorMessage };
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

  const config: EmailConfig = {
    enabled: emailConfig.enabled,
    smtpHost: emailConfig.smtpHost || '',
    smtpPort: emailConfig.smtpPort || 587,
    smtpSecure: emailConfig.smtpSecure ?? false,
    smtpUser: emailConfig.smtpUser || '',
    smtpPassword: emailConfig.smtpPassword || '',
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
