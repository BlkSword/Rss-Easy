'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Inbox,
  Star,
  Settings,
  Plus,
  Search,
  Bookmark,
  Archive,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import { trpc } from '@/lib/trpc/client';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

const quickActions = [
  { icon: Plus, label: '添加订阅', href: '/feeds/manage', color: 'bg-blue-500' },
  { icon: Search, label: '搜索', href: '/search', color: 'bg-green-500' },
  { icon: Bookmark, label: '分组', href: '/feeds', color: 'bg-purple-500' },
  { icon: Archive, label: '归档', href: '/archive', color: 'bg-orange-500' },
];

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 获取未读数量
  const { data: stats } = trpc.feeds.globalStats.useQuery(undefined, {
    enabled: isMobile,
    refetchInterval: 30000,
  });

  const mainNavItems: NavItem[] = [
    { href: '/', icon: Home, label: '首页' },
    { href: '/unread', icon: Inbox, label: '未读', badge: stats?.unreadCount },
    { href: '/starred', icon: Star, label: '收藏' },
    { href: '/settings', icon: Settings, label: '设置' },
  ];

  if (!isMobile) return null;

  // 在登录页面不显示
  if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
    return null;
  }

  return (
    <>
      {/* 快捷操作菜单 */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="fixed bottom-24 right-4 z-50 flex flex-col gap-3"
            >
              {quickActions.map((action, index) => (
                <motion.div
                  key={action.label}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={action.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 group"
                  >
                    <span className="text-sm font-medium text-white bg-black/60 px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      {action.label}
                    </span>
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg',
                        action.color
                      )}
                    >
                      <action.icon className="w-5 h-5" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        <div className="bg-background/95 backdrop-blur-lg border-t border-border/60">
          <div className="flex items-center justify-around h-16 px-2">
            {mainNavItems.slice(0, 2).map((item) => (
              <NavButton
                key={item.href}
                item={item}
                isActive={pathname === item.href}
              />
            ))}

            {/* 中央快捷按钮 */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'relative -mt-5 w-14 h-14 rounded-full flex items-center justify-center',
                'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground',
                'shadow-lg shadow-primary/30',
                'transition-transform duration-200 active:scale-95',
                isMenuOpen && 'rotate-45'
              )}
            >
              <Plus className="w-6 h-6" />
              {isMenuOpen && (
                <span className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
              )}
            </button>

            {mainNavItems.slice(2).map((item) => (
              <NavButton
                key={item.href}
                item={item}
                isActive={pathname === item.href}
              />
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}

function NavButton({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'flex flex-col items-center justify-center flex-1 h-full gap-1 py-2',
        'transition-colors duration-200',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <div className="relative p-1">
        <Icon className="w-5 h-5" />
        {item.badge && item.badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </div>
      <span className="text-[11px] font-medium">{item.label}</span>
      {isActive && (
        <motion.div
          layoutId="bottomNavIndicator"
          className="absolute bottom-1 w-4 h-0.5 rounded-full bg-primary"
        />
      )}
    </Link>
  );
}

export default MobileBottomNav;
