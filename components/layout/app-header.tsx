'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
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
  Keyboard,
  Sun,
  Moon,
  Languages,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/toast';
import { useIsMobile } from '@/hooks/use-media-query';
import { useTheme } from '@/components/providers/theme-provider';
import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { Spinner } from '@/components/animation/loading';
import { QueueStatusIndicator } from '@/components/layout/queue-status-indicator';
import { motion, AnimatePresence } from 'framer-motion';

export interface AppHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onSearch?: (query: string) => void;
}

function AppHeaderComponent({
  onRefresh,
  isRefreshing = false,
  onToggleSidebar,
  isSidebarCollapsed = false,
  onSearch,
}: AppHeaderProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const isMobile = useIsMobile();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = trpc.notifications.unreadCount.useQuery();

  // 点击外部关闭搜索和菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
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

  // 侧边栏切换 - 直接使用父组件传递的回调
  const handleToggleSidebar = () => {
    onToggleSidebar?.();
  };

  return (
    <header className="flex-shrink-0 h-14 md:h-16 sticky top-0 z-40 header-glass">
      <div className="flex h-full items-center justify-between px-3 md:px-4 gap-2 md:gap-4">
        {/* 左侧：Logo 和菜单 */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* 移动端隐藏侧边栏按钮 */}
          {!isMobile && (
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
          )}

          <Link href="/" className="flex items-center gap-2 md:gap-2.5 group">
            <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm group-hover:shadow-md transition-shadow overflow-hidden">
              <img src="/logo-small.png" alt="Rss-Easy" className="h-5 w-5 md:h-6 md:w-6 object-contain" />
            </div>
            <span className="font-semibold text-sm md:text-base hidden sm:block">
              Rss-Easy
            </span>
          </Link>
        </div>

        {/* 中间：搜索栏 */}
        <div
          ref={searchContainerRef}
          className={cn(
            'flex-1 max-w-xl transition-all duration-300',
            isSearchOpen && !isMobile ? 'scale-105' : ''
          )}
        >
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={isMobile ? t('nav.search') : `${t('nav.search')}... (Cmd+K)`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className={cn(
                'w-full h-9 md:h-10 pl-10 pr-10 rounded-xl border bg-muted/30 text-sm',
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

        {/* 右侧：操作按钮 - 桌面端完整版 */}
        {!isMobile && (
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
                className={cn(
                  'border border-transparent',
                  'hover:border-border/60 hover:bg-muted/80',
                  'dark:border-border/40 dark:hover:border-border/70 dark:hover:bg-muted/90',
                  'transition-all duration-200'
                )}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-600" />
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

            {/* 队列状态指示器 */}
            <QueueStatusIndicator />

            <Tooltip content={t('nav.logout')} position="bottom">
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        )}

        {/* 右侧：操作按钮 - 移动端简化版 */}
        {isMobile && (
          <div className="flex items-center gap-1">
            {/* 刷新按钮 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="relative"
            >
              <RefreshCw className={cn(
                'h-5 w-5 transition-transform duration-500',
                isRefreshing && 'animate-spin-smooth'
              )} />
            </Button>

            {/* 队列状态指示器 */}
            <QueueStatusIndicator />

            {/* 更多菜单 */}
            <div ref={menuRef} className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <MoreVertical className="h-5 w-5" />
              </Button>

              <AnimatePresence>
                {isMobileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border/60 bg-background/95 backdrop-blur-lg shadow-xl overflow-hidden z-50"
                  >
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setLanguage(language === 'zh-CN' ? 'en' : 'zh-CN');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Languages className="h-4 w-4 text-muted-foreground" />
                        <span>{language === 'zh-CN' ? 'English' : '中文'}</span>
                      </button>
                      <button
                        onClick={() => {
                          toggleTheme();
                          setIsMobileMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 rounded-lg mx-2',
                          'hover:bg-muted/60',
                          'dark:hover:bg-muted/70'
                        )}
                      >
                        {resolvedTheme === 'dark' ? (
                          <>
                            <Sun className="h-4 w-4 text-amber-400" />
                            <span>浅色模式</span>
                          </>
                        ) : (
                          <>
                            <Moon className="h-4 w-4 text-slate-600" />
                            <span>深色模式</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          router.push('/settings');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <span>{t('nav.settings')}</span>
                      </button>
                      <button
                        onClick={() => {
                          router.push('/notifications');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span>{t('nav.notifications')}</span>
                        {(notifications ?? 0) > 0 && (
                          <span className="ml-auto w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                            {notifications! > 99 ? '99+' : notifications}
                          </span>
                        )}
                      </button>
                      <div className="border-t border-border/60 my-1" />
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{t('nav.logout')}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
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

// 使用 React.memo 优化性能
const AppHeader = memo(AppHeaderComponent);

export default AppHeader;
export { AppHeader };
