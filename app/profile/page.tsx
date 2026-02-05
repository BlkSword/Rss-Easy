/**
 * 个人资料页面 - 独立页面（无侧栏）
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Calendar,
  Shield,
  Save,
} from 'lucide-react';
import { Button, Card, Form, Input, Switch, Avatar, Space, Tabs, Typography, Divider, Select } from 'antd';
import type { TabsProps } from 'antd';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';

const { TextArea } = Input;
const { Title, Text } = Typography;

export default function ProfilePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const { data: user, refetch } = trpc.auth.me.useQuery();
  const updateProfile = trpc.auth.updateProfile.useMutation();
  const updatePreferences = trpc.auth.updatePreferences.useMutation();

  const handleProfileSubmit = async (values: any) => {
    setIsLoading(true);
    try {
      await updateProfile.mutateAsync(values);
      notifySuccess('个人资料已更新');
      refetch();
    } catch (error) {
      notifyError('更新失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesSubmit = async (values: any) => {
    setIsLoading(true);
    try {
      await updatePreferences.mutateAsync(values);
      notifySuccess('偏好设置已更新');
      refetch();
    } catch (error) {
      notifyError('更新失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="flex-shrink-0 h-14 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              icon={<ArrowLeft className="h-5 w-5" />}
              onClick={() => router.push('/')}
              title="返回主页"
            />
            <h1 className="font-semibold text-sm">个人资料</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 用户卡片 */}
        <Card className="mb-6 border-border/60">
          <div className="flex items-center gap-6">
            <Avatar size={80} className="bg-gradient-to-br from-primary to-primary/70">
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <div className="flex-1">
              <Title level={3} className="mb-1">{user?.username}</Title>
              <Text type="secondary">{user?.email}</Text>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  加入于 {new Date(user?.createdAt || '').toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* 选项卡内容 */}
        <ProfileTabs
          user={user}
          form={form}
          isLoading={isLoading}
          onProfileSubmit={handleProfileSubmit}
          onPreferencesSubmit={handlePreferencesSubmit}
        />
      </div>
    </div>
  );
}

function ProfileTabs({
  user,
  form,
  isLoading,
  onProfileSubmit,
  onPreferencesSubmit,
}: {
  user: any;
  form: any;
  isLoading: boolean;
  onProfileSubmit: (values: any) => void;
  onPreferencesSubmit: (values: any) => void;
}) {
  const tabItems: TabsProps['items'] = [
    {
      key: 'profile',
      label: (
        <span className="flex items-center gap-2">
          <User className="h-4 w-4" />
          基本信息
        </span>
      ),
      children: (
        <Card className="border-border/60">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              username: user?.username,
              email: user?.email,
              bio: user?.bio || '',
            }}
            onFinish={onProfileSubmit}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<User className="h-4 w-4 text-muted-foreground" />} size="large" />
            </Form.Item>

            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input prefix={<User className="h-4 w-4 text-muted-foreground" />} size="large" />
            </Form.Item>

            <Form.Item label="个性签名" name="bio">
              <TextArea rows={4} placeholder="介绍一下自己..." />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<Save className="h-4 w-4" />} loading={isLoading}>
                保存更改
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'preferences',
      label: (
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          偏好设置
        </span>
      ),
      children: (
        <Card className="border-border/60">
          <Form
            layout="vertical"
            initialValues={{
              theme: user?.preferences?.theme || 'system',
              language: user?.preferences?.language || 'zh-CN',
              itemsPerPage: user?.preferences?.itemsPerPage || 20,
              autoMarkAsRead: user?.preferences?.autoMarkAsRead ?? true,
              showFullContent: user?.preferences?.showFullContent ?? false,
            }}
            onFinish={onPreferencesSubmit}
          >
            <Form.Item label="主题" name="theme">
              <Select
                options={[
                  { label: '浅色', value: 'light' },
                  { label: '深色', value: 'dark' },
                  { label: '跟随系统', value: 'system' },
                ]}
              />
            </Form.Item>

            <Form.Item label="语言" name="language">
              <Select
                options={[
                  { label: '简体中文', value: 'zh-CN' },
                  { label: 'English', value: 'en' },
                ]}
              />
            </Form.Item>

            <Form.Item label="每页显示文章数" name="itemsPerPage">
              <Select
                options={[
                  { label: '10 篇', value: 10 },
                  { label: '20 篇', value: 20 },
                  { label: '50 篇', value: 50 },
                  { label: '100 篇', value: 100 },
                ]}
              />
            </Form.Item>

            <Form.Item name="autoMarkAsRead" valuePropName="checked">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">自动标记为已读</div>
                  <div className="text-sm text-muted-foreground">点击文章后自动标记为已读</div>
                </div>
                <Switch />
              </div>
            </Form.Item>

            <Form.Item name="showFullContent" valuePropName="checked">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">显示完整内容</div>
                  <div className="text-sm text-muted-foreground">在列表中显示文章完整内容而非摘要</div>
                </div>
                <Switch />
              </div>
            </Form.Item>

            <Divider />

            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<Save className="h-4 w-4" />} loading={isLoading}>
                保存更改
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
  ];

  return <Tabs activeKey="profile" items={tabItems} />;
}
