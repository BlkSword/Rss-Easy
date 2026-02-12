/**
 * 注册页面 - 优化版
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, ArrowRight, Sparkles, Check, X } from 'lucide-react';
import { Button, Input, Form, Progress } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { handleApiError, handleApiSuccess } from '@/lib/feedback';
import { Fade, StaggerContainer } from '@/components/animation/fade';
import { useShakeAnimation, usePageLoadAnimation } from '@/hooks/use-animation';
import { MorphingShape } from '@/components/animation/morphing-shape';
import { cn } from '@/lib/utils';

// 密码要求检查
interface PasswordRequirement {
  label: string;
  check: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: '至少8位字符', check: (p) => p.length >= 8 },
  { label: '包含字母', check: (p) => /[a-zA-Z]/.test(p) },
  { label: '包含数字', check: (p) => /\d/.test(p) },
];

// 密码强度计算
function calculatePasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 20;
  if (/\d/.test(password)) strength += 25;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 30;
  return strength;
}

function getPasswordStrengthText(strength: number): { text: string; color: string } {
  if (strength === 0) return { text: '', color: '' };
  if (strength <= 25) return { text: '弱', color: '#ef4444' };
  if (strength <= 50) return { text: '一般', color: '#f59e0b' };
  if (strength <= 75) return { text: '良好', color: '#3b82f6' };
  return { text: '强', color: '#10b981' };
}

export default function RegisterPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [password, setPassword] = useState('');
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

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    const strength = calculatePasswordStrength(newPassword);
    setPasswordStrength(strength);
  };

  // 检查密码是否满足所有要求
  const passwordChecks = useMemo(() => {
    return passwordRequirements.map((req) => ({
      ...req,
      met: req.check(password),
    }));
  }, [password]);

  const allRequirementsMet = useMemo(() => {
    return passwordChecks.every((check) => check.met);
  }, [passwordChecks]);

  const handleSubmit = async (values: { username: string; email: string; password: string; confirmPassword: string }) => {
    setIsLoading(true);

    try {
      const { confirmPassword, ...submitData } = values;
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        shake();
        handleApiError(data.error || '注册失败', '注册失败');
        setIsLoading(false);
        return;
      }

      // 注册成功
      handleApiSuccess('注册成功', '正在跳转到首页...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 800);
    } catch (err) {
      shake();
      handleApiError(err, '注册失败');
      setIsLoading(false);
    }
  };

  const strengthInfo = getPasswordStrengthText(passwordStrength);

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
        
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        
        <div className="absolute top-20 left-20 opacity-30">
          <MorphingShape size={280} duration={12} />
        </div>
        <div className="absolute bottom-20 right-20 opacity-20">
          <MorphingShape size={220} duration={9} />
        </div>
      </div>

      <Fade in={isLoaded} duration={600} className="w-full max-w-md relative z-10">
        <StaggerContainer staggerDelay={100} initialDelay={200}>
          {/* Logo 和标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20 mb-6 hover-lift">
              <Sparkles className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              创建账号
            </h1>
            <p className="text-muted-foreground">加入 Rss-Easy，开启智能阅读之旅</p>
          </div>

          {/* 注册表单 */}
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
                name="username"
                label={<span className="text-sm font-medium">用户名</span>}
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少3个字符' },
                  { max: 20, message: '用户名最多20个字符' },
                  { pattern: /^[a-zA-Z0-9_-]+$/, message: '用户名只能包含字母、数字、下划线和连字符' },
                ]}
              >
                <Input
                  size="large"
                  prefix={<UserOutlined className={cn(
                    'transition-colors',
                    focusedField === 'username' ? 'text-primary' : 'text-muted-foreground'
                  )} />}
                  placeholder="yourname"
                  disabled={isLoading}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  className="input-focus-animate h-12"
                />
              </Form.Item>

              <Form.Item
                name="email"
                label={<span className="text-sm font-medium">邮箱地址</span>}
                rules={[
                  { required: true, message: '请输入邮箱地址' },
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
              >
                <Input
                  size="large"
                  prefix={<MailOutlined className={cn(
                    'transition-colors',
                    focusedField === 'email' ? 'text-primary' : 'text-muted-foreground'
                  )} />}
                  placeholder="you@example.com"
                  disabled={isLoading}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className="input-focus-animate h-12"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={<span className="text-sm font-medium">密码</span>}
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码长度至少为8个字符' },
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      if (!/[a-zA-Z]/.test(value)) {
                        return Promise.reject(new Error('密码必须包含字母'));
                      }
                      if (!/\d/.test(value)) {
                        return Promise.reject(new Error('密码必须包含数字'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined className={cn(
                    'transition-colors',
                    focusedField === 'password' ? 'text-primary' : 'text-muted-foreground'
                  )} />}
                  placeholder="••••••••"
                  disabled={isLoading}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onChange={handlePasswordChange}
                  className="input-focus-animate h-12"
                  iconRender={(visible) => visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                />
              </Form.Item>

              {/* 密码要求提示 */}
              {password && (
                <div className="mb-4 -mt-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="text-xs font-medium text-foreground mb-2">密码要求：</div>
                  <div className="space-y-1.5">
                    {passwordChecks.map((check, index) => (
                      <div key={index} className={cn(
                        'flex items-center gap-2 text-xs transition-colors',
                        check.met ? 'text-green-600' : 'text-muted-foreground'
                      )}>
                        {check.met ? (
                          <Check className="w-3.5 h-3.5 flex-shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 flex-shrink-0" />
                        )}
                        <span>{check.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 密码强度指示器 */}
              {passwordStrength > 0 && allRequirementsMet && (
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
                    railColor="hsl(var(--muted))"
                    size="small"
                  />
                </div>
              )}

              <Form.Item
                name="confirmPassword"
                label={<span className="text-sm font-medium">确认密码</span>}
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined className={cn(
                    'transition-colors',
                    focusedField === 'confirmPassword' ? 'text-primary' : 'text-muted-foreground'
                  )} />}
                  placeholder="••••••••"
                  disabled={isLoading}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  className="input-focus-animate h-12"
                  iconRender={(visible) => visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={isLoading}
                  disabled={isLoading}
                  block
                  className="h-12 rounded-xl font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 btn-press"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      注册中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      创建账号
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </Form.Item>
            </Form>

            {/* 分割线 */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-4 text-muted-foreground">或</span>
              </div>
            </div>

            {/* 登录链接 */}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">已有账号？</span>{' '}
              <Link 
                href="/login" 
                className="text-primary hover:text-primary/80 font-medium hover:underline transition-colors inline-flex items-center gap-1 group"
              >
                立即登录
                <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

        </StaggerContainer>
      </Fade>
    </div>
  );
}
