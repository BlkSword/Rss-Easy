/**
 * 通知页面 - 全屏布局
 */

'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, Filter, Mail, FileText, AlertTriangle, Sparkles, Info } from 'lucide-react';
import { Button, Card, Badge, Space, Empty, Spin, Tooltip } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';
import { useSidebar } from '@/components/providers/sidebar-provider';

type NotificationData = {
  link?: string;
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { isCollapsed, toggleSidebar } = useSidebar();

  const { data: notifications, refetch } = trpc.notifications.list.useQuery({
    limit: 100,
    onlyUnread: filter === 'unread',
  });

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation();
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation();
  const deleteMutation = trpc.notifications.delete.useMutation();
  const clearReadMutation = trpc.notifications.clearRead.useMutation();

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsReadMutation.mutateAsync({ id });
      refetch();
    } catch (error) {
      handleApiError(error, '操作失败');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
      handleApiSuccess('已全部标记为已读');
      refetch();
    } catch (error) {
      handleApiError(error, '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      refetch();
    } catch (error) {
      handleApiError(error, '操作失败');
    }
  };

  const handleClearRead = async () => {
    try {
      await clearReadMutation.mutateAsync();
      handleApiSuccess('已清空已读通知');
      refetch();
    } catch (error) {
      handleApiError(error, '操作失败');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_entry':
        return <Mail className="h-5 w-5 text-blue-500" />;
      case 'report_ready':
        return <FileText className="h-5 w-5 text-green-500" />;
      case 'feed_error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'ai_complete':
        return <Sparkles className="h-5 w-5 text-purple-500" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'new_entry':
        return '新文章';
      case 'report_ready':
        return '报告';
      case 'feed_error':
        return '错误';
      case 'ai_complete':
        return 'AI';
      default:
        return '系统';
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isCollapsed} />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className={cn(
          'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
          isCollapsed ? 'hidden lg:hidden' : 'block'
        )}>
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">通知</h1>
                <p className="text-muted-foreground text-sm">
                  {unreadCount && unreadCount > 0
                    ? `有 ${unreadCount} 条未读通知`
                    : '没有未读通知'}
                </p>
              </div>
              <Space>
                {unreadCount && unreadCount > 0 && (
                  <Button
                    icon={<CheckCheck className="h-4 w-4" />}
                    onClick={handleMarkAllAsRead}
                  >
                    全部已读
                  </Button>
                )}
                <Button
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={handleClearRead}
                >
                  清空已读
                </Button>
              </Space>
            </div>

            {/* 过滤器 */}
            <div className="flex items-center gap-2 mb-6">
              <Button
                type={filter === 'all' ? 'primary' : 'default'}
                icon={<Filter className="h-4 w-4" />}
                onClick={() => setFilter('all')}
              >
                全部
              </Button>
              <Badge count={unreadCount || 0} showZero>
                <Button
                  type={filter === 'unread' ? 'primary' : 'default'}
                  icon={<Bell className="h-4 w-4" />}
                  onClick={() => setFilter('unread')}
                >
                  未读
                </Button>
              </Badge>
            </div>

            {/* 通知列表 */}
            {!notifications || notifications.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={filter === 'unread' ? '没有未读通知' : '还没有任何通知'}
              />
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={cn(
                      'border-border/60 transition-colors',
                      !notification.isRead && 'bg-primary/5 border-primary/20'
                    )}
                    size="small"
                  >
                    <div className="flex gap-4">
                      {/* 图标 */}
                      <div className="flex-shrink-0 pt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                {getTypeLabel(notification.type)}
                              </span>
                              {!notification.isRead && (
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                              )}
                            </div>
                            <h3 className="font-semibold">{notification.title}</h3>
                            {notification.content && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {notification.content}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(notification.createdAt).toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-1">
                            {(notification.data as NotificationData)?.link && (
                              <Link
                                href={(notification.data as NotificationData).link!}
                                className="p-2 hover:bg-muted rounded-lg transition-colors text-sm"
                              >
                                查看
                              </Link>
                            )}
                            {!notification.isRead && (
                              <Tooltip title="标记已读">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<Check className="h-4 w-4" />}
                                  onClick={() => handleMarkAsRead(notification.id)}
                                />
                              </Tooltip>
                            )}
                            <Tooltip title="删除">
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<Trash2 className="h-4 w-4" />}
                                onClick={() => handleDelete(notification.id)}
                              />
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
