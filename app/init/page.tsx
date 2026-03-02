/**
 * 系统初始化页面
 * 创建超级管理员账户并完成系统初始化
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Rss, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';

export default function InitPage() {
  const router = useRouter();
  const [step, setStep] = useState<'check' | 'form' | 'creating' | 'done' | 'error'>('check');
  const [errorMessage, setErrorMessage] = useState('');

  // 表单数据
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [systemName, setSystemName] = useState('Rss-Easy');

  // 表单验证错误
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 检查初始化状态
  const { data: initStatus, isLoading: checkingInit } = trpc.admin.checkInitStatus.useQuery();

  useEffect(() => {
    if (!checkingInit && initStatus) {
      if (initStatus.isInitialized) {
        // 已初始化，跳转到首页
        router.push('/');
      } else if (initStatus.needsInit) {
        // 需要初始化
        setStep('form');
      } else {
        // 有用户但未初始化（异常状态）
        setErrorMessage('系统状态异常：存在用户但未完成初始化');
        setStep('error');
      }
    }
  }, [checkingInit, initStatus, router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = '请输入邮箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (!username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (username.length < 3) {
      newErrors.username = '用户名至少 3 个字符';
    } else if (username.length > 20) {
      newErrors.username = '用户名最多 20 个字符';
    }

    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 8) {
      newErrors.password = '密码至少 8 个字符';
    } else if (!/[a-zA-Z]/.test(password)) {
      newErrors.password = '密码必须包含字母';
    } else if (!/\d/.test(password)) {
      newErrors.password = '密码必须包含数字';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    if (!systemName.trim()) {
      newErrors.systemName = '请输入系统名称';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setStep('creating');
    setErrorMessage('');

    try {
      const response = await fetch('/api/admin/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username,
          password,
          systemName,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStep('done');
        // 3秒后跳转到登录页
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setErrorMessage(data.error || '初始化失败');
        setStep('error');
      }
    } catch (err) {
      setErrorMessage('网络错误，请重试');
      setStep('error');
    }
  };

  // 检查中
  if (step === 'check') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">检查系统状态...</p>
        </div>
      </div>
    );
  }

  // 创建中
  if (step === 'creating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">正在创建超级管理员账户...</p>
        </div>
      </div>
    );
  }

  // 完成
  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">初始化完成</h1>
          <p className="mt-2 text-muted-foreground">系统已成功初始化，即将跳转到登录页面...</p>
        </div>
      </div>
    );
  }

  // 错误
  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">初始化失败</h1>
          <p className="mt-2 text-muted-foreground">{errorMessage}</p>
          <button
            onClick={() => setStep('form')}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // 表单
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 mb-4">
            <Rss className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">欢迎使用 Rss-Easy</h1>
          <p className="text-muted-foreground mt-2">创建超级管理员账户以开始使用</p>
        </div>

        {/* 表单卡片 */}
        <div className="bg-card border border-border rounded-2xl shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 系统名称 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                系统名称
              </label>
              <input
                type="text"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                placeholder="Rss-Easy"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl border bg-background transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  errors.systemName ? 'border-red-500' : 'border-border'
                )}
              />
              {errors.systemName && (
                <p className="mt-1 text-sm text-red-500">{errors.systemName}</p>
              )}
            </div>

            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl border bg-background transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  errors.username ? 'border-red-500' : 'border-border'
                )}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-500">{errors.username}</p>
              )}
            </div>

            {/* 邮箱 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl border bg-background transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  errors.email ? 'border-red-500' : 'border-border'
                )}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少8位，包含字母和数字"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl border bg-background transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  errors.password ? 'border-red-500' : 'border-border'
                )}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl border bg-background transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  errors.confirmPassword ? 'border-red-500' : 'border-border'
                )}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>

            {/* 提示 */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                此账户将拥有超级管理员权限，可以管理所有用户和系统设置。请妥善保管账户信息。
              </p>
            </div>

            {/* 提交按钮 */}
            <button
              type="submit"
              className={cn(
                'w-full py-3 rounded-xl font-medium transition-all duration-200',
                'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground',
                'hover:opacity-90 active:scale-[0.98]',
                'shadow-lg shadow-primary/25'
              )}
            >
              完成初始化
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
