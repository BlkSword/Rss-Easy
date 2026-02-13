'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Inbox,
  Star,
  Archive,
  Clock,
  Settings,
  Rss,
  Sparkles,
  Search,
  Bell,
  LogOut,
  User,
  ChevronRight,
  Folder,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { useIsMobile } from '@/hooks/use-media-query';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useUserPreferences } from '@/hooks/use-local-storage';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { addToast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 路由变化时关闭抽屉
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // 防止 body 滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const { data: categories } = trpc.categories.list.useQuery();
  const { data: feeds } = trpc.feeds.list.useQuery({ limit: 10 });
  const { data: stats } = trpc.feeds.globalStats.useQuery();

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      addToast({ type: 'success', title: '已安全登出' });
      window.location.href = '/login';
    } catch {
      addToast({ type: 'error', title: '登出失败' });
    }
  };

  const mainNavItems = [
    { icon: Inbox, label: '全部文章', href: '/', count: stats?.totalEntries },
    { icon: Clock, label: '未读文章', href: '/unread', count: stats?.unreadCount },
    { icon: Star, label: '星标文章', href: '/starred' },
    { icon: Archive, label: '归档', href: '/archive' },
    { icon: Sparkles, label: 'AI 报告', href: '/reports' },
  ];

  const secondaryNavItems = [
    { icon: Search, label: '搜索', href: '/search' },
    { icon: Rss, label: '订阅源', href: '/feeds' },
    { icon: Bell, label: '通知', href: '/notifications' },
    { icon: Settings, label: '设置', href: '/settings' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* 抽屉 */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'fixed top-0 left-0 bottom-0 w-[85vw] max-w-[320px]',
              'bg-background z-50',
              'flex flex-col',
              'shadow-2xl'
            )}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">R</span>
                </div>
                <div>
                  <h2 className="font-semibold">Rss-Easy</h2>
                  <p className="text-xs text-muted-foreground">智能RSS阅读器</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto py-4">
              {/* 主导航 */}
              <nav className="px-3 space-y-1">
                {mainNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl',
                      'transition-colors duration-200',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className={cn(
                      'w-5 h-5',
                      isActive(item.href) && 'text-primary'
                    )} />
                    <span className="flex-1">{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>

              {/* 分组 */}
              {categories && categories.length > 0 && (
                <div className="mt-6 px-3">
                  <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    分组
                  </h3>
                  <div className="space-y-1">
                    {categories.map((category) => {
                      const isExpanded = expandedCategories.has(category.id);
                      return (
                        <div key={category.id}>
                          <button
                            onClick={() => toggleCategory(category.id)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl',
                              'transition-colors duration-200',
                              'text-foreground hover:bg-muted'
                            )}
                          >
                            <ChevronRight className={cn(
                              'w-4 h-4 text-muted-foreground transition-transform',
                              isExpanded && 'rotate-90'
                            )} />
                            <Folder className="w-4 h-4" style={{ color: category.color || undefined }} />
                            <span className="flex-1 text-left">{category.name}</span>
                            {category.unreadCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {category.unreadCount}
                              </span>
                            )}
                          </button>
                          
                          {/* 展开的订阅源 */}
                          <AnimatePresence>
                            {isExpanded && category.feeds && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="ml-8 mt-1 space-y-1">
                                  {category.feeds.slice(0, 5).map((feed) => (
                                    <Link
                                      key={feed.id}
                                      href={`/?feed=${feed.id}`}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50"
                                    >
                                      {feed.iconUrl ? (
                                        <img src={feed.iconUrl} alt="" className="w-4 h-4 rounded" />
                                      ) : (
                                        <Rss className="w-4 h-4" />
                                      )}
                                      <span className="flex-1 truncate">{feed.title}</span>
                                    </Link>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 次要导航 */}
              <div className="mt-6 px-3">
                <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  更多
                </h3>
                <nav className="space-y-1">
                  {secondaryNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 rounded-xl',
                        'transition-colors duration-200',
                        isActive(item.href)
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </div>

            {/* 底部操作 */}
            <div className="p-4 border-t border-border/60 space-y-2">
              <Link
                href="/profile"
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl',
                  'transition-colors duration-200',
                  isActive('/profile')
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <User className="w-5 h-5" />
                <span className="flex-1">个人中心</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>退出登录</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default MobileDrawer;
