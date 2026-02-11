'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  RefreshCw,
  Menu,
  BookOpen,
  LogOut,
  Settings,
  Bell,
  X,
  Command,
  Plus,
  Keyboard,
  Sun,
  Moon,
  Languages,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/toast';
import { useUserPreferences } from '@/hooks/use-local-storage';
import { useIsMobile } from '@/hooks/use-media-query';
import { useTheme } from '@/components/providers/theme-provider';
import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { Spinner } from '@/components/animation/loading';

export interface AppHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onSearch?: (query: string) => void;
}

export function AppHeader({
  onRefresh,
  isRefreshing = false,
  onToggleSidebar,
  isSidebarCollapsed = false,
  onSearch,
}: AppHeaderProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const isMobile = useIsMobile();
  const { sidebarCollapsed, setSidebarCollapsed } = useUserPreferences();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = trpc.notifications.unreadCount.useQuery();

  // 点击外部关闭搜索
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K 打开搜索
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
      }
      // ESC 关闭搜索
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  }, [searchQuery, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      addToast({ type: 'success', title: '已安全登出' });
      router.push('/login');
    } catch {
      addToast({ type: 'error', title: '登出失败，请重试' });
    }
  };

  const handleToggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <header className="flex-shrink-0 h-16 sticky top-0 z-40 header-glass">
      <div className="flex h-full items-center justify-between px-4 gap-4">
        {/* 左侧：Logo 和菜单 */}
        <div className="flex items-center gap-3">
          <Tooltip content="切换侧边栏 (Cmd+B)" position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleSidebar}
              className={cn(
                'transition-transform duration-300',
                isSidebarCollapsed && 'rotate-180'
              )}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </Tooltip>

          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm group-hover:shadow-md transition-shadow">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <span className="font-semibold text-base hidden sm:block">
              Rss-Easy
            </span>
          </Link>
        </div>

        {/* 中间：搜索栏 */}
        <div
          ref={searchContainerRef}
          className={cn(
            'flex-1 max-w-xl transition-all duration-300',
            isSearchOpen ? 'scale-105' : ''
          )}
        >
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`${t('nav.search')}... (Cmd+K)`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className={cn(
                'w-full h-10 pl-10 pr-10 rounded-xl border bg-muted/30 text-sm',
                'placeholder:text-muted-foreground/60',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
                'transition-all duration-200'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            
            {/* 搜索建议下拉框 */}
            {isSearchOpen && (
              <SearchDropdown
                query={searchQuery}
                onSelect={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
              />
            )}
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-1">
          <Tooltip content={t('action.refresh')} position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={cn(
                'transition-all duration-200',
                isRefreshing && 'hover:bg-transparent'
              )}
            >
              <RefreshCw className={cn(
                'h-4 w-4 transition-transform duration-500',
                isRefreshing && 'animate-spin-smooth'
              )} />
            </Button>
          </Tooltip>

          <Tooltip content={t('settings.language')} position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLanguage(language === 'zh-CN' ? 'en' : 'zh-CN')}
              className="font-medium text-sm"
            >
              {language === 'zh-CN' ? 'EN' : '中'}
            </Button>
          </Tooltip>

          <Tooltip content={t('settings.theme')} position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </Tooltip>

          <Tooltip content={t('nav.shortcuts')} position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/shortcuts')}
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </Tooltip>

          <Tooltip content={t('nav.settings')} position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/settings')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </Tooltip>

          <Tooltip content={t('nav.notifications')} position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/notifications')}
              className="relative"
            >
              <Bell className="h-4 w-4" />
              {(notifications ?? 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-background" />
              )}
            </Button>
          </Tooltip>

          <div className="w-px h-6 bg-border/60 mx-1" />

          <Tooltip content={t('nav.add_feed')} position="bottom">
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/feeds/manage')}
              leftIcon={<Plus className="h-4 w-4" />}
              className="hidden sm:flex"
            >
              {t('nav.feeds')}
            </Button>
          </Tooltip>

          <Tooltip content={t('nav.logout')} position="bottom">
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

/**
 * 搜索建议下拉框
 */
function SearchDropdown({
  query,
  onSelect,
}: {
  query: string;
  onSelect: () => void;
}) {
  const router = useRouter();
  const { data: results, isLoading } = trpc.entries.list.useQuery(
    { search: query || undefined, limit: 5 },
    { enabled: query.length >= 2 }
  );

  const entries = results?.items || [];

  return (
    <div className="absolute top-full left-0 right-0 mt-2 frosted-glass rounded-xl overflow-hidden animate-fadeIn">
      {query.length < 2 ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          输入至少 2 个字符开始搜索
        </div>
      ) : isLoading ? (
        <div className="p-8 flex justify-center">
          <Spinner size="sm" />
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center">
          <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">没有找到相关文章</p>
        </div>
      ) : (
        <>
          <div className="max-h-80 overflow-y-auto py-2">
            {entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => {
                  router.push(`/entries/${entry.id}`);
                  onSelect();
                }}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left"
              >
                {entry.feed.iconUrl ? (
                  <img
                    src={entry.feed.iconUrl}
                    alt=""
                    className="w-5 h-5 rounded mt-0.5"
                  />
                ) : (
                  <BookOpen className="w-5 h-5 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {entry.feed.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-border/60 bg-muted/30">
            <button
              onClick={() => {
                router.push(`/search?q=${encodeURIComponent(query)}`);
                onSelect();
              }}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              查看所有结果
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AppHeader;
