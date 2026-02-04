/**
 * 通知页面
 */

'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, Filter, Mail, FileText, AlertTriangle, Sparkles, Info } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type NotificationData = {
  link?: string;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  content: string | null;
  data: { link?: string } | null;
  isRead: boolean;
  createdAt: Date;
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

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
    await markAsReadMutation.mutateAsync({ id });
    refetch();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsReadMutation.mutateAsync();
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    refetch();
  };

  const handleClearRead = async () => {
    await clearReadMutation.mutateAsync();
    refetch();
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
    <div className="container py-6 max-w-4xl">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">通知</h1>
          <p className="text-muted-foreground">
            {unreadCount && unreadCount > 0
              ? `有 ${unreadCount} 条未读通知`
              : '没有未读通知'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount && unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <CheckCheck className="h-4 w-4" />
              全部已读
            </button>
          )}
          <button
            onClick={handleClearRead}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            清空已读
          </button>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          <Filter className="h-4 w-4" />
          全部
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            filter === 'unread'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          <Bell className="h-4 w-4" />
          未读
          {unreadCount && unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-primary-foreground/20 rounded-full text-xs">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 通知列表 */}
      <div className="space-y-3">
        {!notifications || notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="h-16 w-16 mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-2">暂无通知</h3>
            <p className="text-sm">
              {filter === 'unread' ? '没有未读通知' : '还没有任何通知'}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                'bg-card border rounded-lg p-4 transition-colors',
                !notification.isRead && 'bg-primary/5 border-primary/20'
              )}
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
                        <span className="text-xs px-2 py-0.5 bg-secondary rounded-full">
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
                          className="p-2 hover:bg-secondary rounded-lg transition-colors text-sm"
                          title="查看详情"
                        >
                          查看
                        </Link>
                      )}
                      {!notification.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-2 hover:bg-secondary rounded-lg transition-colors"
                          title="标记已读"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="p-2 hover:bg-red-500/10 hover:text-red-600 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
