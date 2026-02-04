/**
 * 通知铃铛组件
 * 显示未读数量和通知列表
 */

'use client';

import { useState } from 'react';
import { Bell, Check, Trash2, CheckCheck, MoreVertical } from 'lucide-react';
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

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();
  const { data: notifications, refetch } = trpc.notifications.list.useQuery(
    { limit: 10 },
    { enabled: open }
  );

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
        return '📰';
      case 'report_ready':
        return '📊';
      case 'feed_error':
        return '⚠️';
      case 'ai_complete':
        return '✨';
      default:
        return '🔔';
    }
  };

  const getNotificationLink = (notification: any) => {
    return (notification.data as NotificationData)?.link || '#';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'relative p-2.5 rounded-xl bg-muted/50 hover:bg-muted',
          'transition-all duration-300 hover:scale-105 active:scale-95'
        )}
        title="通知"
      >
        <Bell className="h-4 w-4" />
        {unreadCount && unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-card border rounded-xl shadow-xl z-50 max-h-[600px] flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">通知</h3>
              <div className="flex items-center gap-1">
                {unreadCount && unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                    title="全部已读"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={handleClearRead}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  title="清空已读"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 通知列表 */}
            <div className="flex-1 overflow-y-auto">
              {!notifications || notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">暂无通知</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-4 hover:bg-muted transition-colors',
                        !notification.isRead && 'bg-primary/5'
                      )}
                    >
                      <div className="flex gap-3">
                        <span className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          {(notification.data as NotificationData)?.link ? (
                            <Link
                              href={getNotificationLink(notification)}
                              onClick={() => {
                                if (!notification.isRead) {
                                  handleMarkAsRead(notification.id);
                                }
                                setOpen(false);
                              }}
                              className="block"
                            >
                              <p className="font-medium text-sm truncate">
                                {notification.title}
                              </p>
                              {notification.content && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {notification.content}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(notification.createdAt).toLocaleString()}
                              </p>
                            </Link>
                          ) : (
                            <>
                              <p className="font-medium text-sm truncate">
                                {notification.title}
                              </p>
                              {notification.content && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {notification.content}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(notification.createdAt).toLocaleString()}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex items-start gap-1">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="p-1 hover:bg-muted rounded transition-colors"
                              title="标记已读"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-destructive"
                            title="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部 */}
            {notifications && notifications.length > 0 && (
              <div className="px-4 py-3 border-t">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="block text-center text-sm text-primary hover:underline"
                >
                  查看全部通知
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
