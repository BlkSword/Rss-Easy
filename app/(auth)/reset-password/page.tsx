/**
 * 重置密码页面
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Input, Form, Progress } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { handleApiError, handleApiSuccess } from '@/lib/feedback';
import { Fade, StaggerContainer } from '@/components/animation/fade';
import { useShakeAnimation, usePageLoadAnimation } from '@/hooks/use-animation';
import { MorphingShape } from '@/components/animation/morphing-shape';
import { cn } from '@/lib/utils';

// 密码强度计算
function calculatePasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 6) strength += 25;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
  if (/\d/.test(password)) strength += 25;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 25;
  return strength;
}

function getPasswordStrengthText(strength: number): { text: string; color: string } {
  if (strength === 0) return { text: '', color: '' };
  if (strength <= 25) return { text: '弱', color: '#ef4444' };
  if (strength <= 50) return { text: '一般', color: '#f59e0b' };
  if (strength <= 75) return { text: '良好', color: '#3b82f6' };
  return { text: '强', color: '#10b981' };
}

type FormState = 'loading' | 'valid' | 'invalid' | 'expired' | 'success';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [formState, setFormState] = useState<FormState>('loading');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const { isShaking, shake } = useShakeAnimation();
  const isLoaded = usePageLoadAnimation(100);

  // 背景粒子效果
  const [particles, setParticles] = useState<{ x: number; y: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 20 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, []);

  // 验证 token
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setFormState('invalid');
        return;
      }

      try {
        const response = await fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.success && data.valid) {
          setFormState('valid');
        } else {
          if (data.message?.includes('过期')) {
            setFormState('expired');
          } else {
            setFormState('invalid');
          }
        }
      } catch (err: any) {
        if (err.message?.includes('过期')) {
          setFormState('expired');
        } else {
          setFormState('invalid');
        }
      }
    };

    verifyToken();
  }, [token]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const strength = calculatePasswordStrength(e.target.value);
    setPasswordStrength(strength);
  };

  const handleSubmit = async (values: { newPassword: string; confirmPassword: string }) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: values.newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFormState('success');
        handleApiSuccess('密码已重置', data.message);
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        shake();
        handleApiError(data.message, '重置失败');
      }
    } catch (err: any) {
      shake();
      handleApiError(err, '重置失败');
    } finally {
      setIsLoading(false);
    }
  };

  const strengthInfo = getPasswordStrengthText(passwordStrength);

  // 加载中状态
  if (formState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">验证重置链接...</p>
        </div>
      </div>
    );
  }

  // 无效/过期 token 状态
  if (formState === 'invalid' || formState === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        </div>

        <Fade in={true} duration={600} className="w-full max-w-md relative z-10">
          <div className="bg-card border border-border/60 rounded-2xl shadow-xl p-8 text-center">
            <div className={cn(
              'inline-flex items-center justify-center w-20 h-20 rounded-full mb-6',
              formState === 'expired'
                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            )}>
              <AlertCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-4">
              {formState === 'expired' ? '链接已过期' : '无效的链接'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {formState === 'expired'
                ? '此密码重置链接已过期。请重新申请密码重置。'
                : '此密码重置链接无效或已被使用。请重新申请密码重置。'}
            </p>
            <div className="space-y-3">
              <a href="/forgot-password">
                <Button type="primary" size="large" block className="h-12 rounded-xl">
                  重新申请密码重置
                </Button>
              </a>
              <a href="/login">
                <Button type="default" size="large" block className="h-12 rounded-xl">
                  返回登录
                </Button>
              </a>
            </div>
          </div>
        </Fade>
      </div>
    );
  }

  // 成功状态
  if (formState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl animate-pulse-soft" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        </div>

        <Fade in={true} duration={600} className="w-full max-w-md relative z-10">
          <div className="bg-card border border-border/60 rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 mb-6">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-4">密码已重置</h2>
            <p className="text-muted-foreground mb-6">
              您的密码已成功重置。正在跳转到登录页面...
            </p>
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          </div>
        </Fade>
      </div>
    );
  }

  // 正常表单状态
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      {/* 背景动画 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary/10 animate-float"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}

        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />

        <div className="absolute top-20 right-20 opacity-30">
          <MorphingShape size={300} duration={10} />
        </div>
        <div className="absolute bottom-20 left-20 opacity-20">
          <MorphingShape size={200} duration={8} />
        </div>
      </div>

      <Fade in={isLoaded} duration={600} className="w-full max-w-md relative z-10">
        <StaggerContainer staggerDelay={100} initialDelay={200}>
          {/* Logo 和标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20 mb-6 hover-lift overflow-hidden">
              <img src="/logo.png" alt="Rss-Easy" className="w-14 h-14 object-contain" />
            </div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              设置新密码
            </h1>
            <p className="text-muted-foreground">请输入您的新密码</p>
          </div>

          {/* 表单容器 */}
          <div className={cn(
            'bg-card border border-border/60 rounded-2xl shadow-xl shadow-primary/5 p-8 backdrop-blur-sm',
            isShaking && 'animate-shake'
          )}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
              requiredMark={false}
            >
              <Form.Item
                name="newPassword"
                label={<span className="text-sm font-medium">新密码</span>}
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码长度至少为6个字符' },
                ]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined className="text-muted-foreground" />}
                  placeholder="••••••••"
                  disabled={isLoading}
                  onChange={handlePasswordChange}
                  className="input-focus-animate h-12"
                  iconRender={(visible) => visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                />
              </Form.Item>

              {/* 密码强度指示器 */}
              {passwordStrength > 0 && (
                <div className="mb-4 -mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">密码强度</span>
                    <span className="text-xs font-medium" style={{ color: strengthInfo.color }}>
                      {strengthInfo.text}
                    </span>
                  </div>
                  <Progress
                    percent={passwordStrength}
                    showInfo={false}
                    strokeColor={strengthInfo.color}
                    trailColor="hsl(var(--muted))"
                    size="small"
                  />
                </div>
              )}

              <Form.Item
                name="confirmPassword"
                label={<span className="text-sm font-medium">确认新密码</span>}
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined className="text-muted-foreground" />}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="input-focus-animate h-12"
                  iconRender={(visible) => visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  disabled={isLoading}
                  block
                  className="h-12 rounded-xl font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 btn-press"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      重置中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      重置密码
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </Form.Item>
            </Form>

            {/* 返回登录 */}
            <div className="mt-6 text-center text-sm">
              <a
                href="/login"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                返回登录
              </a>
            </div>
          </div>

          {/* 安全提示 */}
          <Fade delay={400}>
            <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/40 text-xs">
              <div className="flex items-center justify-center gap-2 mb-2 text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span>安全提示</span>
              </div>
              <ul className="space-y-1 text-muted-foreground/70 text-center">
                <li>• 密码长度至少 6 个字符</li>
                <li>• 建议使用大小写字母、数字和特殊字符的组合</li>
                <li>• 不要使用与其他网站相同的密码</li>
              </ul>
            </div>
          </Fade>
        </StaggerContainer>
      </Fade>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
