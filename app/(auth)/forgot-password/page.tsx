/**
 * 忘记密码页面
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { Button, Input, Form } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { handleApiError, handleApiSuccess } from '@/lib/feedback';
import { Fade, StaggerContainer } from '@/components/animation/fade';
import { useShakeAnimation, usePageLoadAnimation } from '@/hooks/use-animation';
import { MorphingShape } from '@/components/animation/morphing-shape';
import { cn } from '@/lib/utils';

type FormState = 'input' | 'success' | 'error';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [formState, setFormState] = useState<FormState>('input');
  const [email, setEmail] = useState('');
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

  const handleSubmit = async (values: { email: string }) => {
    setIsLoading(true);
    setEmail(values.email);

    try {
      // 使用 REST API
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (data.success) {
        setFormState('success');
        handleApiSuccess('', data.message);
      } else {
        shake();
        setFormState('error');
        handleApiError(data.message, '请求失败');
      }
    } catch (err: any) {
      shake();
      setFormState('error');
      handleApiError(err, '请求失败');
    } finally {
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
              忘记密码
            </h1>
            <p className="text-muted-foreground">请输入您的邮箱地址，我们将发送密码重置链接</p>
          </div>

          {/* 表单容器 */}
          <div className={cn(
            'bg-card border border-border/60 rounded-2xl shadow-xl shadow-primary/5 p-8 backdrop-blur-sm',
            isShaking && 'animate-shake'
          )}>
            {formState === 'input' ? (
              <>
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
                      prefix={<MailOutlined className="text-muted-foreground" />}
                      placeholder="you@example.com"
                      disabled={isLoading}
                      className="input-focus-animate h-12"
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
                          发送中...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          发送重置链接
                          <Mail className="w-4 h-4" />
                        </span>
                      )}
                    </Button>
                  </Form.Item>
                </Form>

                {/* 返回登录 */}
                <div className="mt-6 text-center text-sm">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
                    返回登录
                  </Link>
                </div>
              </>
            ) : formState === 'success' ? (
              <>
                {/* 成功状态 */}
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 mb-6">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">邮件已发送</h2>
                  <p className="text-muted-foreground mb-6">
                    如果该邮箱已注册，您将收到一封包含密码重置链接的邮件。
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm text-left mb-6">
                    <p className="font-medium mb-2">发送至：{email}</p>
                    <p className="text-muted-foreground text-xs">
                      请检查您的收件箱（包括垃圾邮件文件夹），点击邮件中的链接重置密码。
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Button
                      type="default"
                      size="large"
                      block
                      className="h-12 rounded-xl"
                      onClick={() => {
                        setFormState('input');
                        form.resetFields();
                      }}
                    >
                      重新发送
                    </Button>
                    <Link href="/login">
                      <Button
                        type="primary"
                        size="large"
                        block
                        className="h-12 rounded-xl"
                      >
                        返回登录
                      </Button>
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* 错误状态 */}
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 mb-6">
                    <Mail className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">发送失败</h2>
                  <p className="text-muted-foreground mb-6">
                    发送密码重置邮件时出现错误，请稍后重试。
                  </p>
                  <div className="space-y-3">
                    <Button
                      type="primary"
                      size="large"
                      block
                      className="h-12 rounded-xl"
                      onClick={() => {
                        setFormState('input');
                      }}
                    >
                      重试
                    </Button>
                    <Link href="/login">
                      <Button
                        type="default"
                        size="large"
                        block
                        className="h-12 rounded-xl"
                      >
                        返回登录
                      </Button>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </StaggerContainer>
      </Fade>
    </div>
  );
}
