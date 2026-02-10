/**
 * 密码重置邮件模板
 * 提供可重用的模板函数
 */

import { EmailService } from '../service';

/**
 * 密码重置邮件数据
 */
export interface PasswordResetEmailData {
  username: string | null;
  resetUrl: string;
  expiresIn?: string;
}

/**
 * 生成密码重置邮件 HTML
 */
export function generatePasswordResetHtml(data: PasswordResetEmailData): string {
  const { username, resetUrl, expiresIn = '1小时' } = data;
  const displayName = username || '用户';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重置您的密码</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style>
    /* 重置样式 */
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f5; margin: 0; padding: 20px; }

    /* 容器 */
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

    /* 头部 */
    .email-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .email-logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .email-tagline { font-size: 14px; opacity: 0.9; }

    /* 内容区 */
    .email-content { padding: 30px; }
    .email-greeting { font-size: 20px; font-weight: 600; margin-bottom: 15px; color: #1f2937; }
    .email-message { font-size: 16px; margin-bottom: 20px; color: #4b5563; }
    .email-link-box { background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; word-break: break-all; }
    .email-link { color: #667eea; font-size: 14px; }

    /* 按钮样式 */
    .button-container { text-align: center; margin: 30px 0; }
    .reset-button { display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; transition: opacity 0.3s; }
    .reset-button:hover { opacity: 0.9; }

    /* 警告框 */
    .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }
    .warning-title { color: #92400e; font-weight: 600; margin-bottom: 8px; }
    .warning-list { margin: 10px 0 0 20px; padding: 0; color: #78350f; }
    .warning-list li { margin-bottom: 5px; }

    /* 页脚 */
    .email-footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .email-footer p { margin: 5px 0; }

    /* 图标 */
    .icon { font-size: 48px; margin-bottom: 20px; }

    /* 响应式 */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .email-content { padding: 20px !important; }
      .reset-button { width: 100% !important; box-sizing: border-box; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- 头部 -->
    <div class="email-header">
      <div class="email-logo">📚 Rss-Easy</div>
      <div class="email-tagline">智能 RSS 资讯聚合平台</div>
    </div>

    <!-- 内容区 -->
    <div class="email-content">
      <!-- 图标 -->
      <div style="text-align: center;">
        <div class="icon">🔑</div>
        <h2 style="margin-top: 0; margin-bottom: 25px;">重置您的密码</h2>
      </div>

      <!-- 问候语 -->
      <div class="email-greeting">您好，${displayName}！</div>

      <!-- 主要内容 -->
      <div class="email-message">
        我们收到了您重置密码的请求。如果这是您发起的操作，请点击下方按钮设置新密码：
      </div>

      <!-- 按钮 -->
      <div class="button-container">
        <a href="${resetUrl}" class="reset-button">重置密码</a>
      </div>

      <!-- 链接文本 -->
      <div class="email-link-box">
        <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">如果按钮无法点击，请复制以下链接到浏览器打开：</div>
        <div class="email-link">${resetUrl}</div>
      </div>

      <!-- 安全提示 -->
      <div class="warning-box">
        <div class="warning-title">⚠️ 安全提示</div>
        <ul class="warning-list">
          <li>此链接将在 <strong>${expiresIn}</strong> 后失效</li>
          <li>请勿将此链接分享给任何人</li>
          <li>如果您没有发起此请求，请忽略此邮件</li>
        </ul>
      </div>

      <!-- 额外说明 -->
      <div class="email-message" style="margin-top: 25px; font-size: 14px; color: #6b7280;">
        如果您没有请求重置密码，可能是他人误输入了您的邮箱地址。您的账户仍然是安全的，您可以忽略此邮件继续使用原密码登录。
      </div>

      <!-- 发送时间 -->
      <div style="text-align: center; margin-top: 25px; font-size: 13px; color: #9ca3af;">
        发送时间：${new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>

    <!-- 页脚 -->
    <div class="email-footer">
      <p>此邮件由 Rss-Easy 系统自动发送，请勿回复。</p>
      <p>© ${new Date().getFullYear()} Rss-Easy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 生成密码重置邮件纯文本
 */
export function generatePasswordResetText(data: PasswordResetEmailData): string {
  const { username, resetUrl, expiresIn = '1小时' } = data;
  const displayName = username || '用户';

  return `
Rss-Easy 密码重置
=====================================

您好，${displayName}！

我们收到了您重置密码的请求。如果这是您发起的操作，请访问以下链接设置新密码：

${resetUrl}

重要提示：
- 此链接将在 ${expiresIn} 后失效
- 请勿将此链接分享给任何人
- 如果您没有发起此请求，请忽略此邮件

如果您没有请求重置密码，可能是他人误输入了您的邮箱地址。您的账户仍然是安全的，您可以忽略此邮件继续使用原密码登录。

---
发送时间：${new Date().toLocaleString('zh-CN')}

此邮件由 Rss-Easy 系统自动发送，请勿回复。
© ${new Date().getFullYear()} Rss-Easy. All rights reserved.
`.trim();
}

/**
 * 密码重置成功邮件模板
 */
export function generatePasswordSuccessHtml(username: string | null): string {
  const displayName = username || '用户';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>密码已成功重置</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f5; margin: 0; padding: 20px; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .email-header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
    .email-content { padding: 30px; }
    .success-icon { font-size: 48px; margin-bottom: 20px; }
    .email-footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">📚 Rss-Easy</div>
      <div style="font-size: 14px; opacity: 0.9;">智能 RSS 资讯聚合平台</div>
    </div>
    <div class="email-content">
      <div style="text-align: center;">
        <div class="success-icon">✅</div>
        <h2 style="margin-top: 0;">密码已成功重置</h2>
      </div>
      <p style="font-size: 16px; margin-bottom: 20px;">您好，${displayName}！</p>
      <p style="font-size: 16px; margin-bottom: 20px;">您的密码已成功重置。现在您可以使用新密码登录您的账户了。</p>
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong>安全提示：</strong>如果您没有重置密码，请立即联系我们的支持团队。
      </div>
    </div>
    <div class="email-footer">
      <p>此邮件由 Rss-Easy 系统自动发送，请勿回复。</p>
      <p>© ${new Date().getFullYear()} Rss-Easy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 导出模板函数供 EmailService 使用
 */
export function getPasswordResetTemplates() {
  return {
    html: generatePasswordResetHtml,
    text: generatePasswordResetText,
    successHtml: generatePasswordSuccessHtml,
  };
}
