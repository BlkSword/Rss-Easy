/**
 * 应用头部组件
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  Plus,
  Menu,
  X,
  BookOpen,
  LogOut,
  Settings,
  User,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  onSearchChange?: (query: string) => void;
  onAddFeed?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function AppHeader({
  onSearchChange,
  onAddFeed,
  onRefresh,
  isRefreshing = false,
}: AppHeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearchChange?.(value);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 glass border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/" className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/25">
                  <BookOpen className="h-5 w-5" />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Rss-Easy
                </h1>
                <p className="text-xs text-muted-foreground">智能资讯聚合</p>
              </div>
            </Link>
          </div>

          {/* 搜索栏 */}
          <div className="flex-1 max-w-md mx-4 hidden sm:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                type="text"
                placeholder="搜索文章..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={cn(
                  'w-full h-10 pl-10 pr-4 rounded-xl border bg-background/50',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'transition-all duration-300',
                  'placeholder:text-muted-foreground'
                )}
              />
            </div>
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-2">
            {/* 刷新按钮 */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={cn(
                'p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20',
                'transition-all duration-300 hover:scale-105 active:scale-95',
                'disabled:opacity-50'
              )}
              title="刷新订阅源"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </button>

            {/* 添加订阅源 */}
            <button
              onClick={onAddFeed}
              className="hidden sm:flex p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 hover:scale-105 active:scale-95 items-center gap-2"
              title="添加订阅源"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">添加</span>
            </button>

            {/* 深色模式切换 */}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-all duration-300 hover:scale-105 active:scale-95"
              title={isDark ? '浅色模式' : '深色模式'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* 通知 */}
            <button className="relative p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-all duration-300 hover:scale-105 active:scale-95">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
            </button>

            {/* 用户菜单 */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-muted/50 hover:bg-muted transition-all duration-300"
              >
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-medium">
                  U
                </div>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-card border rounded-xl shadow-xl z-50 py-2">
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
                    >
                      <User className="h-4 w-4" />
                      <span>个人资料</span>
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>设置</span>
                    </Link>
                    <hr className="my-2" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>登出</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
