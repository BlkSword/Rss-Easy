/**
 * 安全设置组件
 */

'use client';

import { useState } from 'react';
import { Shield, Lock, Save, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { mutate: changePassword } = trpc.settings.changePassword.useMutation();

  const passwordRequirements = [
    { label: '至少8个字符', met: newPassword.length >= 8 },
    { label: '包含大写字母', met: /[A-Z]/.test(newPassword) },
    { label: '包含小写字母', met: /[a-z]/.test(newPassword) },
    { label: '包含数字', met: /\d/.test(newPassword) },
  ];

  const isPasswordValid = passwordRequirements.every((r) => r.met);
  const isFormValid =
    currentPassword && newPassword && confirmPassword && isPasswordValid && newPassword === confirmPassword;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setIsSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      notifySuccess('密码已更新');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            修改密码
          </CardTitle>
          <CardDescription>定期更换密码以保护账户安全</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 当前密码 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">当前密码</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码"
                className={cn(
                  'w-full px-4 py-2.5 pr-10 rounded-lg border border-border bg-background',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                  'transition-all duration-200',
                  'placeholder:text-muted-foreground/50'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* 新密码 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">新密码</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新密码（至少8位）"
                className={cn(
                  'w-full px-4 py-2.5 pr-10 rounded-lg border border-border bg-background',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                  'transition-all duration-200',
                  'placeholder:text-muted-foreground/50'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* 密码要求提示 */}
            {newPassword && (
              <div className="space-y-1 mt-2">
                {passwordRequirements.map((req, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center gap-2 text-xs',
                      req.met ? 'text-green-600' : 'text-muted-foreground'
                    )}
                  >
                    <Check className={cn('h-3 w-3', req.met ? 'opacity-100' : 'opacity-0')} />
                    {req.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 确认新密码 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">确认新密码</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                className={cn(
                  'w-full px-4 py-2.5 pr-10 rounded-lg border border-border bg-background',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                  'transition-all duration-200',
                  'placeholder:text-muted-foreground/50'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* 密码匹配提示 */}
            {confirmPassword && (
              <p
                className={cn(
                  'text-xs mt-1',
                  confirmPassword === newPassword ? 'text-green-600' : 'text-red-500'
                )}
              >
                {confirmPassword === newPassword ? '密码匹配' : '密码不匹配'}
              </p>
            )}
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={isSaving}
              disabled={!isFormValid || isSaving}
              leftIcon={<Save className="h-4 w-4" />}
            >
              更新密码
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 安全提示 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-sm">安全建议</h4>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• 使用至少8位包含大小写字母、数字和符号的强密码</li>
                <li>• 不要在不同网站使用相同密码</li>
                <li>• 定期更换密码以保持账户安全</li>
                <li>• 不要与他人共享您的账户信息</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
