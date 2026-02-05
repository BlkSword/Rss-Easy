/**
 * 注册页面
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Button, Input, Form } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { handleApiError, handleApiSuccess } from '@/lib/feedback';

export default function RegisterPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

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
        handleApiError(data.error || '注册失败', '注册失败');
        setIsLoading(false);
        return;
      }

      // 注册成功
      handleApiSuccess('注册成功', '正在跳转到首页...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 500);
    } catch (err) {
      handleApiError(err, '注册失败');
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
          <h1 className="text-2xl font-bold mb-2">创建账号</h1>
          <p className="text-muted-foreground">加入 Rss-Easy</p>
        </div>

        {/* 注册表单 */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-xl shadow-primary/5 p-8 backdrop-blur-sm">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            requiredMark={false}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { max: 20, message: '用户名最多20个字符' },
                { pattern: /^[a-zA-Z0-9_-]+$/, message: '用户名只能包含字母、数字、下划线和连字符' },
              ]}
            >
              <Input
                size="large"
                prefix={<UserOutlined className="text-muted-foreground" />}
                placeholder="yourname"
                disabled={isLoading}
              />
            </Form.Item>

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
              rules={[
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码长度至少为8个字符' },
              ]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined className="text-muted-foreground" />}
                placeholder="••••••••"
                disabled={isLoading}
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="确认密码"
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
                prefix={<LockOutlined className="text-muted-foreground" />}
                placeholder="••••••••"
                disabled={isLoading}
              />
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
                注册
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

          {/* 登录链接 */}
          <div className="text-center text-sm">
            <span className="text-muted-foreground">已有账号？</span>{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              立即登录
            </Link>
          </div>
        </div>

        {/* 服务条款 */}
        <p className="mt-6 text-xs text-center text-muted-foreground">
          注册即表示您同意我们的{' '}
          <Link href="/terms" className="text-primary hover:underline">
            服务条款
          </Link>{' '}
          和{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            隐私政策
          </Link>
        </p>
      </div>
    </div>
  );
}
