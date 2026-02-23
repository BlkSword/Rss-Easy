/**
 * 邮件服务设置组件
 * SMTP 配置管理
 */

'use client';

import { useState, useEffect } from 'react';
import { Mail, Server, Lock, Shield, Send, AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface EmailSettingsProps {
  user: any;
}

export function EmailSettings({ user }: EmailSettingsProps) {
  const emailConfig = user?.emailConfig || {};

  const [enabled, setEnabled] = useState(emailConfig.enabled ?? false);
  const [smtpHost, setSmtpHost] = useState(emailConfig.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(emailConfig.smtpPort || 587);
  const [smtpSecure, setSmtpSecure] = useState(emailConfig.smtpSecure ?? false);
  const [smtpUser, setSmtpUser] = useState(emailConfig.smtpUser || '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [fromEmail, setFromEmail] = useState(emailConfig.fromEmail || '');
  const [fromName, setFromName] = useState(emailConfig.fromName || '');
  const [showPassword, setShowPassword] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const updateEmailConfig = trpc.settings.updateEmailConfig.useMutation();
  const testEmailConfig = trpc.settings.testEmailConfig.useMutation();

  const hasChanges =
    enabled !== (emailConfig.enabled ?? false) ||
    smtpHost !== (emailConfig.smtpHost || '') ||
    smtpPort !== (emailConfig.smtpPort || 587) ||
    smtpSecure !== (emailConfig.smtpSecure ?? false) ||
    smtpUser !== (emailConfig.smtpUser || '') ||
    smtpPassword !== '' ||
    fromEmail !== (emailConfig.fromEmail || '') ||
    fromName !== (emailConfig.fromName || '');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateEmailConfig.mutateAsync({
        enabled,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPassword: smtpPassword || undefined,
        fromEmail,
        fromName,
      });
      notifySuccess('邮件配置已保存');
      setSmtpPassword('');
    } catch (error: any) {
      notifyError(error.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 检查必填字段是否完整，返回缺失字段列表
  const getMissingFields = () => {
    const missing: string[] = [];
    if (!smtpHost) missing.push('SMTP 服务器地址');
    if (!smtpUser) missing.push('用户名');
    // 密码：如果新输入了就用新的，否则检查是否有已保存的
    if (!smtpPassword && !emailConfig.smtpPassword) missing.push('密码');
    if (!fromEmail) missing.push('发件人邮箱');
    return missing;
  };

  const canTest = () => {
    // 至少需要服务器地址和用户名才能尝试测试
    return smtpHost && smtpUser;
  };

  const handleTest = async () => {
    // 检查缺失字段
    const missing = getMissingFields();
    if (missing.length > 0) {
      notifyError(`请填写以下必填项: ${missing.join('、')}`);
      return;
    }

    setIsTesting(true);
    try {
      const result = await testEmailConfig.mutateAsync({
        config: {
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          smtpPassword: smtpPassword || undefined,
          fromEmail,
          fromName,
        },
      });
      if (result.success) {
        notifySuccess(result.message);
      } else {
        notifyError(result.message);
      }
    } catch (error: any) {
      notifyError(error.message || '测试失败');
    } finally {
      setIsTesting(false);
    }
  };

  // 预设配置
  const presets = [
    { name: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false },
    { name: 'Outlook', host: 'smtp.office365.com', port: 587, secure: false },
    { name: 'QQ邮箱', host: 'smtp.qq.com', port: 587, secure: false },
    { name: '163邮箱', host: 'smtp.163.com', port: 465, secure: true },
    { name: '阿里云', host: 'smtp.aliyun.com', port: 465, secure: true },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setSmtpHost(preset.host);
    setSmtpPort(preset.port);
    setSmtpSecure(preset.secure);
  };

  return (
    <div className="space-y-6">
      {/* SMTP配置 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            SMTP 服务器配置
          </CardTitle>
          <CardDescription>
            配置邮件服务器以启用邮件通知功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 启用开关 */}
          <div
            className={cn(
              'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-250 cursor-pointer group',
              'hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent',
              enabled
                ? 'border-primary/50 bg-gradient-to-r from-primary/[0.08] to-primary/[0.03] shadow-sm'
                : 'border-border/80 bg-muted/20'
            )}
            onClick={() => setEnabled(!enabled)}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-250',
                  enabled ? 'bg-primary/20 shadow-sm' : 'bg-muted/60 group-hover:bg-primary/10'
                )}
              >
                <Mail
                  className={cn(
                    'h-5 w-5 transition-all duration-250',
                    enabled ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-primary/60'
                  )}
                />
              </div>
              <div>
                <div
                  className={cn(
                    'font-medium transition-colors duration-200',
                    enabled ? 'text-primary' : 'group-hover:text-primary/90'
                  )}
                >
                  启用邮件服务
                </div>
                <div className="text-sm text-muted-foreground">
                  开启后可接收文章摘要和系统通知邮件
                </div>
              </div>
            </div>
            <button
              className={cn(
                'toggle-switch relative w-14 h-7 rounded-full transition-all duration-300',
                enabled
                  ? 'bg-slate-300 dark:bg-slate-600'
                  : 'bg-primary shadow-lg shadow-primary/30'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setEnabled(!enabled);
              }}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full shadow-md transition-all duration-300',
                  enabled ? 'left-8 bg-white' : 'left-1 bg-white'
                )}
              />
            </button>
          </div>

          {enabled && (
            <>
              {/* 预设选择 */}
              <div className="space-y-3">
                <label className="text-sm font-medium">快速配置（选择邮件服务商）</label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm border-2 transition-all duration-200',
                        smtpHost === preset.host
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50'
                      )}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* SMTP服务器地址 */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  SMTP 服务器地址
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.example.com"
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                    'transition-all duration-200 input-warm',
                    'placeholder:text-muted-foreground/50'
                  )}
                />
              </div>

              {/* 端口和安全 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">端口</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    placeholder="587"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                      'transition-all duration-200 input-warm'
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    常用端口: 25, 465(SSL), 587(TLS)
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">加密方式</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSmtpSecure(false)}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all duration-200',
                        !smtpSecure
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      STARTTLS
                    </button>
                    <button
                      onClick={() => setSmtpSecure(true)}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all duration-200',
                        smtpSecure
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      SSL/TLS
                    </button>
                  </div>
                </div>
              </div>

              {/* 认证信息 */}
              <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  认证信息
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    用户名 / 邮箱地址
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="your@email.com"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                      'transition-all duration-200 input-warm',
                      'placeholder:text-muted-foreground/50'
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    密码 / 授权码
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={emailConfig.smtpPassword ? '••••••••（已配置）' : '输入密码或授权码'}
                      className={cn(
                        'w-full px-4 py-3 pr-10 rounded-xl border-2 border-border bg-background',
                        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                        'transition-all duration-200 input-warm',
                        'placeholder:text-muted-foreground/50'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    建议使用应用专用授权码而非登录密码
                  </p>
                </div>
              </div>

              {/* 发件人信息 */}
              <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  发件人信息
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      发件人邮箱
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="noreply@example.com"
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                        'transition-all duration-200 input-warm',
                        'placeholder:text-muted-foreground/50'
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">发件人名称</label>
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="Rss-Easy"
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border-2 border-border bg-background',
                        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                        'transition-all duration-200 input-warm',
                        'placeholder:text-muted-foreground/50'
                      )}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 安全提示 */}
      {enabled && (
        <Card className="border-primary/20 bg-primary/5 overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">安全提示</h4>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>SMTP 密码将被加密存储</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>建议使用应用专用授权码而非主密码</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>启用 SSL/TLS 加密以保护传输安全</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3">
        {enabled && (
          <Button
            variant="ghost"
            onClick={handleTest}
            isLoading={isTesting}
            disabled={!canTest()}
            leftIcon={<Send className="h-4 w-4" />}
          >
            发送测试邮件
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={isSaving}
          disabled={!hasChanges || isSaving}
          leftIcon={enabled ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        >
          保存配置
        </Button>
      </div>
    </div>
  );
}

export default EmailSettings;
