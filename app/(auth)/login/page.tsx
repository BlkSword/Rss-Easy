/**
 * 登录页面 - 优化版
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Eye, EyeOff, Loader2, ArrowRight, Mail, Lock, CheckCircle } from 'lucide-react';
import { Button, Input, Form, Checkbox } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { handleApiError, handleApiSuccess } from '@/lib/feedback';
import { Fade, StaggerContainer } from '@/components/animation/fade';
import { useShakeAnimation, usePageLoadAnimation } from '@/hooks/use-animation';
import { MorphingShape } from '@/components/animation/morphing-shape';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
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

  const handleSubmit = async (values: { email: string; password: string; remember?: boolean }) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        shake();
        handleApiError(data.error || '登录失败', '登录失败');
        setIsLoading(false);
        return;
      }

      // 登录成功
      handleApiSuccess('登录成功', '正在跳转到首页...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 800);
    } catch (err) {
      shake();
      handleApiError(err, '登录失败');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      {/* 背景动画 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* 浮动粒子 */}
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
        
        {/* 渐变背景 */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        
        {/* 变形形状 */}
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
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20 mb-6 hover-lift">
              <BookOpen className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              欢迎回来
            </h1>
            <p className="text-muted-foreground">登录到 Rss-Easy，继续您的阅读之旅</p>
          </div>

          {/* 登录表单 */}
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
                rules={[{ required: true, message: '请输入密码' }]}
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
                  className="input-focus-animate h-12"
                  iconRender={(visible) => visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                />
              </Form.Item>

              <Form.Item className="mb-4">
                <div className="flex items-center justify-between">
                  <Form.Item name="remember" valuePropName="checked" noStyle>
                    <Checkbox className="text-sm">记住我</Checkbox>
                  </Form.Item>
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    忘记密码？
                  </Link>
                </div>
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
                      登录中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      登录
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

            {/* 注册链接 */}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">还没有账号？</span>{' '}
              <Link 
                href="/register" 
                className="text-primary hover:text-primary/80 font-medium hover:underline transition-colors inline-flex items-center gap-1 group"
              >
                立即注册
                <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

        </StaggerContainer>
      </Fade>
    </div>
  );
}
