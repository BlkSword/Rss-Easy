/**
 * 设置页面 - 独立页面（无侧栏）
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Bell,
  Palette,
  Database,
  Key,
  Save,
  Plus,
  Trash2,
  Shield,
} from 'lucide-react';
import { Button, Card, Col, Row, Input, Segmented, Switch, Space, Tabs, List, Typography, Divider, Select, Alert } from 'antd';
import type { TabsProps } from 'antd';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

export default function SettingsPage() {
  const router = useRouter();

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
            <h1 className="font-semibold text-sm">设置</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <SettingsContent />
      </div>
    </div>
  );
}

function SettingsContent() {
  const [activeTab, setActiveTab] = useState('profile');

  const tabItems: TabsProps['items'] = [
    {
      key: 'profile',
      label: (
        <span className="flex items-center gap-2">
          <User className="h-4 w-4" />
          个人资料
        </span>
      ),
      children: <ProfileSettings />,
    },
    {
      key: 'notifications',
      label: (
        <span className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          通知设置
        </span>
      ),
      children: <NotificationSettings />,
    },
    {
      key: 'appearance',
      label: (
        <span className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          外观
        </span>
      ),
      children: <AppearanceSettings />,
    },
    {
      key: 'security',
      label: (
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          安全
        </span>
      ),
      children: <SecuritySettings />,
    },
    {
      key: 'data',
      label: (
        <span className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          数据管理
        </span>
      ),
      children: <DataSettings />,
    },
    {
      key: 'api',
      label: (
        <span className="flex items-center gap-2">
          <Key className="h-4 w-4" />
          API密钥
        </span>
      ),
      children: <ApiSettings />,
    },
  ];

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      items={tabItems}
      className="settings-tabs"
    />
  );
}

// 个人资料设置
function ProfileSettings() {
  const { data: user } = trpc.auth.me.useQuery();

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card title="个人资料" className="border-border/60">
        <Space direction="vertical" size="middle" className="w-full">
          <div>
            <div className="mb-2">
              <Text type="secondary">用户名</Text>
            </div>
            <Input
              size="large"
              defaultValue={user?.username}
              placeholder="输入用户名"
            />
          </div>
          <div>
            <div className="mb-2">
              <Text type="secondary">邮箱</Text>
            </div>
            <Input
              size="large"
              defaultValue={user?.email}
              placeholder="输入邮箱"
            />
          </div>
          <div>
            <div className="mb-2">
              <Text type="secondary">个性签名</Text>
            </div>
            <TextArea
              rows={3}
              placeholder="介绍一下自己..."
            />
          </div>
          <Button
            type="primary"
            icon={<Save className="h-4 w-4" />}
            onClick={() => notifySuccess('个人资料已更新')}
          >
            保存更改
          </Button>
        </Space>
      </Card>
    </Space>
  );
}

// 通知设置
function NotificationSettings() {
  return (
    <Card title="通知设置" className="border-border/60">
      <Space direction="vertical" size="large" className="w-full">
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="font-medium">新文章通知</div>
            <div className="text-sm text-muted-foreground">当订阅源有新文章时通知</div>
          </div>
          <Switch defaultChecked />
        </div>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="font-medium">每日摘要</div>
            <div className="text-sm text-muted-foreground">每天发送重要文章摘要</div>
          </div>
          <Switch />
        </div>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="font-medium">周报提醒</div>
            <div className="text-sm text-muted-foreground">每周生成阅读报告</div>
          </div>
          <Switch defaultChecked />
        </div>
      </Space>
    </Card>
  );
}

// 外观设置
function AppearanceSettings() {
  const [theme, setTheme] = useState('light');

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card title="主题设置" className="border-border/60">
        <div className="mb-4">
          <div className="mb-4">
            <Text type="secondary">选择主题</Text>
          </div>
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              { label: '浅色', value: 'light' },
              { label: '深色', value: 'dark' },
              { label: '跟随系统', value: 'system' },
            ]}
            block
          />
        </div>
        <Row gutter={16} className="mt-6">
          <Col span={8}>
            <div
              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/50'}`}
              onClick={() => setTheme('light')}
            >
              <div className="h-20 bg-white rounded-lg mb-3 border border-border/60 shadow-sm" />
              <div className="text-sm font-medium text-center">浅色</div>
            </div>
          </Col>
          <Col span={8}>
            <div
              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/50'}`}
              onClick={() => setTheme('dark')}
            >
              <div className="h-20 bg-gray-900 rounded-lg mb-3 shadow-sm" />
              <div className="text-sm font-medium text-center">深色</div>
            </div>
          </Col>
          <Col span={8}>
            <div
              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${theme === 'system' ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/50'}`}
              onClick={() => setTheme('system')}
            >
              <div className="h-20 bg-gradient-to-r from-white to-gray-900 rounded-lg mb-3 shadow-sm" />
              <div className="text-sm font-medium text-center">跟随系统</div>
            </div>
          </Col>
        </Row>
      </Card>

      <Card title="阅读设置" className="border-border/60">
        <Space direction="vertical" size="middle" className="w-full">
          <div>
            <div className="mb-2">
              <Text type="secondary">字体大小</Text>
            </div>
            <Select
              defaultValue="medium"
              style={{ width: '100%' }}
              options={[
                { label: '小', value: 'small' },
                { label: '中', value: 'medium' },
                { label: '大', value: 'large' },
              ]}
            />
          </div>
          <div>
            <div className="mb-2">
              <Text type="secondary">每页显示文章数</Text>
            </div>
            <Select
              defaultValue={20}
              style={{ width: '100%' }}
              options={[
                { label: '10 篇', value: 10 },
                { label: '20 篇', value: 20 },
                { label: '50 篇', value: 50 },
                { label: '100 篇', value: 100 },
              ]}
            />
          </div>
        </Space>
      </Card>
    </Space>
  );
}

// 安全设置
function SecuritySettings() {
  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card title="修改密码" className="border-border/60">
        <Space direction="vertical" size="middle" className="w-full">
          <div>
            <div className="mb-2">
              <Text type="secondary">当前密码</Text>
            </div>
            <Input.Password size="large" placeholder="输入当前密码" />
          </div>
          <div>
            <div className="mb-2">
              <Text type="secondary">新密码</Text>
            </div>
            <Input.Password size="large" placeholder="输入新密码（至少8位）" />
          </div>
          <div>
            <div className="mb-2">
              <Text type="secondary">确认新密码</Text>
            </div>
            <Input.Password size="large" placeholder="再次输入新密码" />
          </div>
          <Button
            type="primary"
            size="large"
            onClick={() => notifySuccess('密码已更新')}
          >
            更新密码
          </Button>
        </Space>
      </Card>
    </Space>
  );
}

// 数据管理
function DataSettings() {
  const handleExport = () => {
    notifySuccess('OPML 文件已导出');
  };

  const handleClearEntries = () => {
    notifySuccess('所有文章已清空');
  };

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card title="导入/导出" className="border-border/60">
        <Space direction="vertical" size="large" className="w-full">
          <div>
            <Title level={5}>导出 OPML</Title>
            <Paragraph type="secondary">
              导出所有订阅源为 OPML 文件，方便备份或迁移
            </Paragraph>
            <Button onClick={handleExport}>导出 OPML</Button>
          </div>
          <Divider />
          <div>
            <Title level={5}>导入 OPML</Title>
            <Paragraph type="secondary">
              从 OPML 文件导入订阅源
            </Paragraph>
            <Space direction="vertical" size="small">
              <Input type="file" accept=".opml,.xml" />
              <Button>导入 OPML</Button>
            </Space>
          </div>
        </Space>
      </Card>

      <Card title="危险区域" className="border-red-200">
        <Alert
          message="警告"
          description="以下操作不可恢复，请谨慎操作"
          type="warning"
          showIcon
          className="mb-4"
        />
        <Space direction="vertical" size="middle" className="w-full">
          <div>
            <Title level={5} type="danger">清空所有文章</Title>
            <Paragraph type="secondary">
              删除所有文章记录，订阅源保留
            </Paragraph>
            <Button danger onClick={handleClearEntries}>
              清空文章
            </Button>
          </div>
          <Divider />
          <div>
            <Title level={5} type="danger">删除账户</Title>
            <Paragraph type="secondary">
              永久删除您的账户和所有数据
            </Paragraph>
            <Button danger type="primary">
              删除账户
            </Button>
          </div>
        </Space>
      </Card>
    </Space>
  );
}

// API密钥设置
function ApiSettings() {
  const [apiKeys, setApiKeys] = useState([
    { id: '1', name: '我的应用', key: 'sk-xxxx****', createdAt: '2024-01-01' },
  ]);

  const handleDeleteKey = (id: string) => {
    setApiKeys(apiKeys.filter((key) => key.id !== id));
    notifySuccess('API密钥已删除');
  };

  return (
    <Card
      title="API密钥"
      className="border-border/60"
      extra={
        <Button icon={<Plus className="h-4 w-4" />}>
          创建密钥
        </Button>
      }
    >
      <Paragraph type="secondary">
        API密钥用于访问 Rss-Easy 的 API 接口，请妥善保管
      </Paragraph>

      <List
        dataSource={apiKeys}
        renderItem={(key) => (
          <List.Item
            actions={[
              <Button
                type="text"
                danger
                size="small"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => handleDeleteKey(key.id)}
              >
                删除
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={<span className="font-medium">{key.name}</span>}
              description={
                <span className="text-muted-foreground">
                  {key.key} · 创建于 {key.createdAt}
                </span>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
