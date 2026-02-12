/**
 * 通知页面 - 全屏布局
 * 使用项目统一的设计系统，增强交互反馈
 */

'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, Filter, Mail, FileText, AlertTriangle, Sparkles, Info } from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { handleApiSuccess, handleApiError } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

type NotificationData = {
  link?: string;
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setIsSidebarCollapsed(prev => !prev);

  const utils = trpc.useUtils();

  const { data: notifications } = trpc.notifications.list.useQuery({
    limit: 100,
    onlyUnread: filter === 'unread',
  });

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onMutate: async ({ id }) => {
      // 取消正在进行的查询，避免覆盖我们的乐观更新
      await utils.notifications.list.cancel();
      await utils.notifications.unreadCount.cancel();

      // 获取当前快照
      const previousNotifications = {
        all: utils.notifications.list.getData({ limit: 100, onlyUnread: false }),
        unread: utils.notifications.list.getData({ limit: 100, onlyUnread: true }),
      };
      const previousUnreadCount = utils.notifications.unreadCount.getData();

      // 乐观更新：将通知标记为已读（更新两个缓存）
      const updateCache = (old: any) => {
        if (!old) return old;
        return old.map((notification: any) =>
          notification.id === id
            ? { ...notification, isRead: true, readAt: new Date() }
            : notification
        );
      };
      utils.notifications.list.setData({ limit: 100, onlyUnread: false }, updateCache);
      utils.notifications.list.setData({ limit: 100, onlyUnread: true }, updateCache);

      // 乐观更新未读计数
      utils.notifications.unreadCount.setData(undefined,
        typeof previousUnreadCount === 'number' && previousUnreadCount > 0 ? previousUnreadCount - 1 : 0
      );

      // 返回上下文，用于错误恢复
      return { previousNotifications, previousUnreadCount };
    },
    onError: (err, variables, context) => {
      // 出错时回滚
      if (context?.previousNotifications) {
        utils.notifications.list.setData({ limit: 100, onlyUnread: false }, context.previousNotifications.all);
        utils.notifications.list.setData({ limit: 100, onlyUnread: true }, context.previousNotifications.unread);
      }
      if (context?.previousUnreadCount !== undefined) {
        utils.notifications.unreadCount.setData(undefined, context.previousUnreadCount);
      }
      handleApiError(err, '操作失败');
    },
    onSettled: () => {
      // 无论如何都重新验证，确保数据一致性
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onMutate: async () => {
      await utils.notifications.list.cancel();
      await utils.notifications.unreadCount.cancel();

      const previousNotifications = {
        all: utils.notifications.list.getData({ limit: 100, onlyUnread: false }),
        unread: utils.notifications.list.getData({ limit: 100, onlyUnread: true }),
      };
      const previousUnreadCount = utils.notifications.unreadCount.getData();

      // 乐观更新：将所有通知标记为已读
      const markAllRead = (old: any) => {
        if (!old) return old;
        return old.map((notification: any) => ({
          ...notification,
          isRead: true,
          readAt: new Date(),
        }));
      };
      utils.notifications.list.setData({ limit: 100, onlyUnread: false }, markAllRead);
      utils.notifications.list.setData({ limit: 100, onlyUnread: true }, markAllRead);

      // 乐观更新未读计数为 0
      utils.notifications.unreadCount.setData(undefined, 0);

      return { previousNotifications, previousUnreadCount };
    },
    onError: (err, variables, context) => {
      if (context?.previousNotifications) {
        utils.notifications.list.setData({ limit: 100, onlyUnread: false }, context.previousNotifications.all);
        utils.notifications.list.setData({ limit: 100, onlyUnread: true }, context.previousNotifications.unread);
      }
      if (context?.previousUnreadCount !== undefined) {
        utils.notifications.unreadCount.setData(undefined, context.previousUnreadCount);
      }
      handleApiError(err, '操作失败');
    },
    onSuccess: () => {
      handleApiSuccess('已全部标记为已读');
    },
    onSettled: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const deleteMutation = trpc.notifications.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.notifications.list.cancel();
      await utils.notifications.unreadCount.cancel();

      const previousNotifications = {
        all: utils.notifications.list.getData({ limit: 100, onlyUnread: false }),
        unread: utils.notifications.list.getData({ limit: 100, onlyUnread: true }),
      };
      const wasUnread = previousNotifications.all?.find(n => n.id === id)?.isRead === false;

      // 乐观更新：从列表中移除通知
      const removeNotification = (old: any) => {
        if (!old) return old;
        return old.filter((notification: any) => notification.id !== id);
      };
      utils.notifications.list.setData({ limit: 100, onlyUnread: false }, removeNotification);
      utils.notifications.list.setData({ limit: 100, onlyUnread: true }, removeNotification);

      // 如果删除的是未读通知，更新未读计数
      const previousUnreadCount = utils.notifications.unreadCount.getData();
      if (wasUnread) {
        utils.notifications.unreadCount.setData(undefined,
          typeof previousUnreadCount === 'number' && previousUnreadCount > 0 ? previousUnreadCount - 1 : 0
        );
      }

      return { previousNotifications, previousUnreadCount, wasUnread };
    },
    onError: (err, variables, context) => {
      if (context?.previousNotifications) {
        utils.notifications.list.setData({ limit: 100, onlyUnread: false }, context.previousNotifications.all);
        utils.notifications.list.setData({ limit: 100, onlyUnread: true }, context.previousNotifications.unread);
      }
      if (context?.previousUnreadCount !== undefined) {
        utils.notifications.unreadCount.setData(undefined, context.previousUnreadCount);
      }
      handleApiError(err, '操作失败');
    },
    onSettled: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const clearReadMutation = trpc.notifications.clearRead.useMutation({
    onMutate: async () => {
      await utils.notifications.list.cancel();

      const previousNotifications = {
        all: utils.notifications.list.getData({ limit: 100, onlyUnread: false }),
        unread: utils.notifications.list.getData({ limit: 100, onlyUnread: true }),
      };

      // 乐观更新：移除所有已读通知
      const filterRead = (old: any) => {
        if (!old) return old;
        return old.filter((notification: any) => !notification.isRead);
      };
      utils.notifications.list.setData({ limit: 100, onlyUnread: false }, filterRead);
      // 已读通知在"仅未读"列表中本就不存在，不需要过滤

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      if (context?.previousNotifications) {
        utils.notifications.list.setData({ limit: 100, onlyUnread: false }, context.previousNotifications.all);
        utils.notifications.list.setData({ limit: 100, onlyUnread: true }, context.previousNotifications.unread);
      }
      handleApiError(err, '操作失败');
    },
    onSuccess: () => {
      handleApiSuccess('已清空已读通知');
    },
    onSettled: () => {
      utils.notifications.list.invalidate();
    },
  });

  const handleMarkAsRead = (id: string) => {
    markAsReadMutation.mutate({ id });
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const handleClearRead = () => {
    clearReadMutation.mutate();
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

  const getTypeBadgeVariant = (type: string): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' => {
    switch (type) {
      case 'new_entry':
        return 'info';
      case 'report_ready':
        return 'success';
      case 'feed_error':
        return 'danger';
      case 'ai_complete':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className={cn(
          'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
          isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
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
              <div className="flex items-center gap-2">
                {unreadCount && unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<CheckCheck className="h-4 w-4" />}
                    onClick={handleMarkAllAsRead}
                  >
                    全部已读
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  onClick={handleClearRead}
                >
                  清空已读
                </Button>
              </div>
            </div>

            {/* 过滤器 */}
            <div className="flex items-center gap-2 mb-6">
              <Button
                variant={filter === 'all' ? 'primary' : 'outline'}
                size="sm"
                leftIcon={<Filter className="h-4 w-4" />}
                onClick={() => setFilter('all')}
              >
                全部
              </Button>
              <Button
                variant={filter === 'unread' ? 'primary' : 'outline'}
                size="sm"
                leftIcon={<Bell className="h-4 w-4" />}
                onClick={() => setFilter('unread')}
                rightIcon={unreadCount ? (
                  <Badge variant="primary" size="sm" className="ml-1">{unreadCount}</Badge>
                ) : undefined}
              >
                未读
              </Button>
            </div>

            {/* 通知列表 */}
            {!notifications || notifications.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-12 w-12" />}
                title={filter === 'unread' ? '没有未读通知' : '还没有任何通知'}
                description={filter === 'unread' ? '您已阅读所有通知' : '当有新消息时，会显示在这里'}
                variant="default"
              />
            ) : (
              <div className="space-y-3">
                {notifications.map((notification, index) => (
                  <Card
                    key={notification.id}
                    isHoverable
                    className={cn(
                      'border-2 transition-all duration-250',
                      !notification.isRead
                        ? 'border-primary/20 bg-gradient-to-r from-primary/[0.03] to-transparent'
                        : 'border-border/60'
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex gap-4 p-4">
                      {/* 图标 */}
                      <div className="flex-shrink-0 pt-0.5">
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200',
                          !notification.isRead ? 'bg-primary/10' : 'bg-muted/50'
                        )}>
                          {getNotificationIcon(notification.type)}
                        </div>
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={getTypeBadgeVariant(notification.type)} size="sm">
                                {getTypeLabel(notification.type)}
                              </Badge>
                              {!notification.isRead && (
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                              )}
                            </div>
                            <h3 className={cn(
                              'font-semibold transition-colors',
                              !notification.isRead ? 'text-foreground' : 'text-muted-foreground'
                            )}>
                              {notification.title}
                            </h3>
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
                                className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                              >
                                查看
                              </Link>
                            )}
                            {!notification.isRead && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-110 active:scale-95"
                                title="标记已读"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(notification.id)}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all duration-200 hover:scale-110 active:scale-95"
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
