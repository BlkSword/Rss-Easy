/**
 * 应用侧边栏组件
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Rss,
  FolderOpen,
  Star,
  Clock,
  Archive,
  Settings,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';

interface SidebarItem {
  id: string;
  name: string;
  count: number;
  icon?: React.ReactNode;
}

export function AppSidebar() {
  const pathname = usePathname();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const { data: categories, isLoading } = trpc.categories.list.useQuery();

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const navItems = [
    { path: '/', label: '全部文章', icon: Rss },
    { path: '/unread', label: '未读', icon: Clock },
    { path: '/starred', label: '星标', icon: Star },
    { path: '/archive', label: '归档', icon: Archive },
  ];

  return (
    <aside className="w-64 h-[calc(100vh-4rem)] bg-muted/30 border-r overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* 主导航 */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                pathname === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* 分类 */}
        <div>
          <div className="flex items-center justify-between mb-2 px-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              分类
            </span>
            <button className="p-1 rounded hover:bg-muted transition-colors">
              <Plus className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-1 px-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 bg-muted/50 rounded animate-pulse"
                />
              ))}
            </div>
          ) : (
            <nav className="space-y-1">
              {categories?.map((category) => {
                const isOpen = openCategories.has(category.id);
                const hasFeeds = category._count.feeds > 0;

                return (
                  <div key={category.id}>
                    <button
                      onClick={() => hasFeeds && toggleCategory(category.id)}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors text-left',
                        hasFeeds && 'hover:bg-muted',
                        !hasFeeds && 'opacity-50'
                      )}
                    >
                      {hasFeeds ? (
                        isOpen ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )
                      ) : (
                        <span className="w-3" />
                      )}
                      <FolderOpen
                        className="h-4 w-4"
                        style={{ color: category.color || undefined }}
                      />
                      <span className="flex-1 text-sm font-medium truncate">
                        {category.name}
                      </span>
                      {category.unreadCount > 0 && (
                        <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                          {category.unreadCount}
                        </span>
                      )}
                    </button>

                    {isOpen && hasFeeds && (
                      <div className="ml-6 mt-1 space-y-1">
                        {category.feeds?.map((feed) => (
                          <Link
                            key={feed.id}
                            href={`/feeds/${feed.id}`}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
                          >
                            {feed.iconUrl && (
                              <img src={feed.iconUrl} alt="" className="w-4 h-4 rounded" />
                            )}
                            <span className="flex-1 truncate">{feed.title}</span>
                            {feed.unreadCount > 0 && (
                              <span className="text-xs bg-muted-foreground/20 px-1.5 rounded">
                                {feed.unreadCount}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          )}
        </div>

        {/* AI 功能入口 */}
        <div>
          <Link
            href="/ai"
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gradient-to-r from-primary/10 to-purple-500/10 hover:from-primary/20 hover:to-purple-500/20 transition-colors group"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">AI 助手</div>
              <div className="text-xs text-muted-foreground">智能摘要与分类</div>
            </div>
          </Link>
        </div>

        {/* 设置链接 */}
        <div className="pt-4 border-t">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              pathname === '/settings' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">设置</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
