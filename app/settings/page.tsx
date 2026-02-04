/**
 * 设置页面
 */

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  User,
  Bell,
  Palette,
  Database,
  Key,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-muted-foreground">管理您的账户和偏好设置</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 侧边导航 */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                activeTab === 'profile'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">个人资料</span>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                activeTab === 'notifications'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span className="text-sm font-medium">通知设置</span>
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                activeTab === 'appearance'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <Palette className="h-4 w-4" />
              <span className="text-sm font-medium">外观</span>
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                activeTab === 'data'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">数据管理</span>
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                activeTab === 'api'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <Key className="h-4 w-4" />
              <span className="text-sm font-medium">API密钥</span>
            </button>
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'data' && <DataSettings />}
          {activeTab === 'api' && <ApiSettings />}
        </div>
      </div>
    </div>
  );
}

// 个人资料设置
function ProfileSettings() {
  const { data: user } = trpc.auth.me.useQuery();

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">个人资料</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">用户名</label>
            <input
              type="text"
              defaultValue={user?.username}
              className="w-full px-3 py-2 bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input
              type="email"
              defaultValue={user?.email}
              className="w-full px-3 py-2 bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">个性签名</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="介绍一下自己..."
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
            <Save className="h-4 w-4" />
            保存更改
          </button>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">修改密码</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">当前密码</label>
            <input
              type="password"
              className="w-full px-3 py-2 bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">新密码</label>
            <input
              type="password"
              className="w-full px-3 py-2 bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">确认新密码</label>
            <input
              type="password"
              className="w-full px-3 py-2 bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
            更新密码
          </button>
        </div>
      </div>
    </div>
  );
}

// 通知设置
function NotificationSettings() {
  return (
    <div className="bg-card border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">通知设置</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">新文章通知</div>
            <div className="text-sm text-muted-foreground">当订阅源有新文章时通知</div>
          </div>
          <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">每日摘要</div>
            <div className="text-sm text-muted-foreground">每天发送重要文章摘要</div>
          </div>
          <input type="checkbox" className="w-5 h-5 rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">周报提醒</div>
            <div className="text-sm text-muted-foreground">每周生成阅读报告</div>
          </div>
          <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
        </div>
      </div>
    </div>
  );
}

// 外观设置
function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">主题设置</h2>
        <div className="grid grid-cols-3 gap-4">
          <button className="p-4 border-2 border-primary rounded-lg">
            <div className="h-16 bg-background rounded mb-2" />
            <div className="text-sm font-medium">浅色</div>
          </button>
          <button className="p-4 border rounded-lg hover:border-primary/50">
            <div className="h-16 bg-gray-900 rounded mb-2" />
            <div className="text-sm font-medium">深色</div>
          </button>
          <button className="p-4 border rounded-lg hover:border-primary/50">
            <div className="h-16 bg-gradient-to-r from-background to-gray-900 rounded mb-2" />
            <div className="text-sm font-medium">跟随系统</div>
          </button>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">阅读设置</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">字体大小</label>
            <select className="w-full px-3 py-2 bg-secondary rounded-md">
              <option>小</option>
              <option selected>中</option>
              <option>大</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">每页显示文章数</label>
            <select className="w-full px-3 py-2 bg-secondary rounded-md">
              <option>10</option>
              <option selected>20</option>
              <option>50</option>
              <option>100</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// 数据管理
function DataSettings() {
  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">导入/导出</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">导出 OPML</h3>
            <p className="text-sm text-muted-foreground mb-3">
              导出所有订阅源为 OPML 文件，方便备份或迁移
            </p>
            <button className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors">
              导出 OPML
            </button>
          </div>
          <div>
            <h3 className="font-medium mb-2">导入 OPML</h3>
            <p className="text-sm text-muted-foreground mb-3">
              从 OPML 文件导入订阅源
            </p>
            <input type="file" accept=".opml,.xml" className="mb-2" />
            <button className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors">
              导入 OPML
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6 border-red-200">
        <h2 className="text-lg font-semibold mb-4 text-red-600">危险区域</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">清空所有文章</h3>
            <p className="text-sm text-muted-foreground mb-3">
              删除所有文章记录，订阅源保留
            </p>
            <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
              清空文章
            </button>
          </div>
          <div>
            <h3 className="font-medium mb-2">删除账户</h3>
            <p className="text-sm text-muted-foreground mb-3">
              永久删除您的账户和所有数据
            </p>
            <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
              删除账户
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// API密钥设置
function ApiSettings() {
  const [apiKeys, setApiKeys] = useState([
    { id: '1', name: '我的应用', key: 'sk-xxxx****', createdAt: '2024-01-01' },
  ]);

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">API密钥</h2>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          创建密钥
        </button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        API密钥用于访问 Rss-Easy 的 API 接口，请妥善保管
      </p>

      <div className="space-y-3">
        {apiKeys.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between p-4 bg-secondary rounded-lg"
          >
            <div>
              <div className="font-medium">{key.name}</div>
              <div className="text-sm text-muted-foreground">
                {key.key} · 创建于 {key.createdAt}
              </div>
            </div>
            <button className="p-2 hover:bg-background rounded-md transition-colors">
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
