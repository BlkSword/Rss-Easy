/**
 * 设置页面主内容组件
 * 使用项目统一的设计系统，增强交互反馈
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Key,
  Database,
  Palette,
  Bell,
  Sparkles,
  Shield,
  Mail,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { ProfileSettings } from './settings/profile-settings';
import { PreferencesSettings } from './settings/preferences-settings';
import { SecuritySettings } from './settings/security-settings';
import { ApiSettings } from './settings/api-settings';
import { DataSettings } from './settings/data-settings';
import { NotificationSettings } from './settings/notification-settings';
import { AISettings } from './settings/ai-settings';
import { EmailSettings } from './settings/email-settings';
import { LogsSettings } from './settings/logs-settings';

type TabKey = 'profile' | 'preferences' | 'security' | 'api' | 'data' | 'notifications' | 'ai' | 'email' | 'logs';

const tabs = [
  { key: 'profile' as TabKey, label: '个人资料', icon: User },
  { key: 'preferences' as TabKey, label: '偏好设置', icon: Palette },
  { key: 'security' as TabKey, label: '安全设置', icon: Shield },
  { key: 'api' as TabKey, label: 'API配置', icon: Key },
  { key: 'email' as TabKey, label: '邮件配置', icon: Mail },
  { key: 'notifications' as TabKey, label: '通知设置', icon: Bell },
  { key: 'ai' as TabKey, label: 'AI配置', icon: Sparkles },
  { key: 'logs' as TabKey, label: '系统日志', icon: ScrollText },
  { key: 'data' as TabKey, label: '数据管理', icon: Database },
];

export function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const { data: user } = trpc.auth.me.useQuery();

  // 从URL参数读取tab
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabKey;
    if (tabFromUrl && tabs.some(t => t.key === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);
  const { mutate: deleteAccount } = trpc.settings.deleteAccount.useMutation();

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      notifyError('请输入密码以确认删除');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount({ password: deletePassword });
      notifySuccess('账户已删除');
      router.push('/login');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '删除失败');
      setIsDeleting(false);
    }
  };

  const handleDeleteModalClose = () => {
    setIsDeleteModalOpen(false);
    setDeletePassword('');
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 顶部导航栏 */}
      <header className="flex-shrink-0 h-14 border-b border-border/60 header-glass">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className={cn(
                'p-2 rounded-xl transition-all duration-200 group',
                'hover:bg-muted hover:-translate-x-0.5',
                'active:translate-x-0 active:scale-95'
              )}
              title="返回主页"
            >
              <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            </button>
            <h1 className="font-semibold text-sm">设置</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏导航 */}
        <aside className="w-56 border-r border-border/60 bg-muted/10 p-4 hidden md:block">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-250',
                    'group relative overflow-hidden',
                    isActive
                      ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-md border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {/* 背景光晕效果 */}
                  <span className={cn(
                    'absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                    !isActive && 'group-hover:opacity-100'
                  )} />
                  <Icon className={cn(
                    'relative h-4 w-4 transition-all duration-250',
                    isActive ? 'text-primary scale-110' : 'group-hover:scale-110 group-hover:text-primary/80'
                  )} />
                  <span className="relative">{tab.label}</span>
                  {/* 选中指示器 */}
                  {isActive && (
                    <>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-sm" />
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* 设置内容区域 */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {/* 移动端选项卡导航 */}
            <div className="md:hidden mb-6 overflow-x-auto pb-2 -mx-6 px-6">
              <div className="flex gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'option-item flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-250',
                        'border-2',
                        isActive
                          ? 'border-primary/50 bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-md ring-2 ring-primary/10'
                          : 'border-transparent text-muted-foreground hover:bg-muted/60'
                      )}
                    >
                      <Icon className={cn(
                        'h-4 w-4 transition-transform duration-200',
                        isActive ? 'scale-110' : 'group-hover:scale-105'
                      )} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 设置内容 */}
            <div className="space-y-6">
              {activeTab === 'profile' && <ProfileSettings user={user} />}
              {activeTab === 'preferences' && <PreferencesSettings user={user} />}
              {activeTab === 'security' && <SecuritySettings />}
              {activeTab === 'api' && <ApiSettings />}
              {activeTab === 'notifications' && <NotificationSettings user={user} />}
              {activeTab === 'ai' && <AISettings user={user} />}
              {activeTab === 'email' && <EmailSettings user={user} />}
              {activeTab === 'logs' && <LogsSettings />}
              {activeTab === 'data' && (
                <DataSettings onOpenDeleteModal={() => setIsDeleteModalOpen(true)} />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* 删除账户确认弹窗 */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteModalClose}
        title="删除账户"
        description="此操作将永久删除您的账户和所有数据，包括订阅源、文章、设置等。此操作无法撤销，请谨慎操作。"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={handleDeleteModalClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
              disabled={isDeleting}
            >
              取消
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting || !deletePassword.trim()}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                'bg-red-600 hover:bg-red-700 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              ⚠️ 警告：删除账户将永久移除所有数据，此操作不可恢复！
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              请输入密码以确认删除
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="输入您的密码"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
