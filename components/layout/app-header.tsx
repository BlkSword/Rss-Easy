'use client';

import { useState, useRef, useEffect } from 'react';
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
  Clock,
  Star,
  Rss,
} from 'lucide-react';
import { Button, Input, Dropdown, Space, Badge, Card, Empty, Spin, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { cn } from '@/lib/utils';
import { notifySuccess, notifyError } from '@/lib/feedback';
import { trpc } from '@/lib/trpc/client';

const { Text } = Typography;

interface AppHeaderProps {
  onSearchChange?: (query: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

function SearchDropdown({
  searchQuery,
  visible,
  onClose,
  onSelect,
}: {
  searchQuery: string;
  visible: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  const { data: searchResults, isLoading } = trpc.entries.list.useQuery({
    search: searchQuery || undefined,
    limit: 5,
  }, {
    enabled: visible && searchQuery.length >= 2,
  });

  if (!visible || searchQuery.length < 2) {
    return null;
  }

  const results = searchResults?.items || [];

  return (
    <div className="absolute top-full left-0 right-0 mt-2 z-50">
      <Card className="shadow-lg border-border/60" styles={{ body: { padding: 0 } }}>
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Spin size="small" />
          </div>
        ) : results.length === 0 ? (
          <div className="py-8">
            <Empty description="没有找到相关文章" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {results.map((entry) => (
              <Link
                key={entry.id}
                href={`/entries/${entry.id}`}
                onClick={() => {
                  onClose();
                  onSelect();
                }}
                className="block"
              >
                <div className="p-4 hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0">
                  <div className="flex items-start gap-3">
                    {entry.feed.iconUrl ? (
                      <img src={entry.feed.iconUrl} alt="" className="w-5 h-5 rounded-sm flex-shrink-0 mt-0.5" />
                    ) : (
                      <Rss className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary/50" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Text className="text-sm font-medium truncate" ellipsis>
                          {entry.title}
                        </Text>
                        {entry.isStarred && (
                          <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <Text className="text-xs text-muted-foreground" type="secondary">
                        {entry.feed.title}
                      </Text>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {!entry.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(entry.publishedAt || '').toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {results.length > 0 && (
          <div className="p-2 border-t border-border/40 bg-muted/30">
            <Link
              href={`/search?q=${encodeURIComponent(searchQuery)}`}
              onClick={() => {
                onClose();
                onSelect();
              }}
              className="block"
            >
              <Text className="text-xs text-center block text-muted-foreground hover:text-primary transition-colors">
                查看所有结果
              </Text>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

export function AppHeader({
  onSearchChange,
  onRefresh,
  isRefreshing = false,
  onToggleSidebar,
  isSidebarCollapsed = false,
}: AppHeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearchChange?.(value);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      notifySuccess('已登出');
      router.push('/login');
    } catch (error) {
      notifyError('登出失败');
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogOut className="h-4 w-4" />,
      label: '登出',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <header className="flex-shrink-0 h-14 border-b border-border/60 bg-background/80 backdrop-blur-md relative z-40">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            type="text"
            icon={<Menu className="h-5 w-5" />}
            onClick={onToggleSidebar}
            className={cn(
              'transition-all duration-300',
              isSidebarCollapsed && '-rotate-180'
            )}
            title={isSidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          />

          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm hidden sm:block">Rss-Easy</span>
          </Link>
        </div>

        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <div ref={searchContainerRef} className="relative">
            <Input
              placeholder="搜索文章..."
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              allowClear
              className="h-9 rounded-lg"
            />
            <SearchDropdown
              searchQuery={searchQuery}
              visible={searchFocused}
              onClose={() => setSearchFocused(false)}
              onSelect={() => setSearchQuery('')}
            />
          </div>
        </div>

        <Space className="flex items-center gap-1.5">
          <Button
            type="text"
            icon={<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />}
            onClick={onRefresh}
            loading={isRefreshing}
            className="h-9 w-9 p-0"
            title="刷新订阅源"
          />

          <Button
            type="text"
            icon={<Settings className="h-4 w-4" />}
            onClick={() => router.push('/settings')}
            className="h-9 w-9 p-0"
            title="设置"
          />

          <Badge count={0} showZero={false}>
            <Button
              type="text"
              icon={<Bell className="h-4 w-4" />}
              onClick={() => router.push('/notifications')}
              className="h-9 w-9 p-0"
              title="通知"
            />
          </Badge>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <Button
              type="text"
              className="flex items-center gap-2 h-9 px-2"
            >
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xs font-medium">
                U
              </div>
            </Button>
          </Dropdown>
        </Space>
      </div>
    </header>
  );
}
