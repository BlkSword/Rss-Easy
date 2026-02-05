/**
 * 登录页面
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Button, Input, Form, Checkbox } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { handleApiError, handleApiSuccess } from '@/lib/feedback';

export default function LoginPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (values: { email: string; password: string }) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        handleApiError(data.error || '登录失败', '登录失败');
        setIsLoading(false);
        return;
      }

      // 登录成功
      handleApiSuccess('登录成功', '正在跳转到首页...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 500);
    } catch (err) {
      handleApiError(err, '登录失败');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20 mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">欢迎回来</h1>
          <p className="text-muted-foreground">登录到 Rss-Easy</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-xl shadow-primary/5 p-8 backdrop-blur-sm">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label="邮箱地址"
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
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined className="text-muted-foreground" />}
                placeholder="••••••••"
                disabled={isLoading}
              />
            </Form.Item>

            <Form.Item>
              <div className="flex items-center justify-between">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>记住我</Checkbox>
                </Form.Item>
                <Link href="/forgot-password" className="text-primary hover:underline text-sm">
                  忘记密码？
                </Link>
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={isLoading}
                disabled={isLoading}
                block
                className="h-11 rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200"
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          {/* 分割线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-2 text-muted-foreground">或</span>
            </div>
          </div>

          {/* 注册链接 */}
          <div className="text-center text-sm">
            <span className="text-muted-foreground">还没有账号？</span>{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              立即注册
            </Link>
          </div>
        </div>

        {/* 测试账号提示 */}
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border/60 text-sm text-center shadow-sm">
          <p className="font-medium mb-2 text-foreground">📋 测试账号</p>
          <p className="text-muted-foreground">
            邮箱: <span className="font-mono text-foreground">test@example.com</span>
          </p>
          <p className="text-muted-foreground">
            密码: <span className="font-mono text-foreground">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
