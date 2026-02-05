/**
 * 搜索页面 - 全屏布局
 */

'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, X, Clock, TrendingUp, History } from 'lucide-react';
import { Button, Input, Card, Tag, Space, Empty, Spin, Select, DatePicker, Badge } from 'antd';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { trpc } from '@/lib/trpc/client';
import { CompactEntryList, CompactEntryItem, CompactEntryEmpty } from '@/components/entries/compact-entry-list';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    feedId: '',
    categoryId: '',
    isRead: undefined as boolean | undefined,
    isStarred: false,
  });

  // 获取搜索结果
  const { data: searchResults, isLoading } = trpc.entries.list.useQuery({
    page: 1,
    limit: 50,
    search: hasSearched ? query : undefined,
    feedId: filters.feedId || undefined,
    unreadOnly: filters.isRead === true ? true : undefined,
    starredOnly: filters.isStarred ? true : undefined,
  }, {
    enabled: hasSearched && query.length > 0,
  });

  // 获取数据
  const { data: feeds } = trpc.feeds.list.useQuery({ limit: 100 });
  const { data: categories } = trpc.categories.list.useQuery();

  const entries = searchResults?.items || [];
  const selectedEntryId = null;

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setHasSearched(true);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleClearFilters = () => {
    setFilters({
      feedId: '',
      categoryId: '',
      isRead: undefined,
      isStarred: false,
    });
  };

  const clearFilter = (key: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'isRead' ? undefined : '',
    }));
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== '' && v !== undefined && v !== false
  ).length;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 hidden lg:block">
          <AppSidebar />
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-background/30">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* 搜索框 */}
            <div className="mb-6">
              <form onSubmit={handleSearch}>
                <Input
                  size="large"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索文章标题、内容、关键词..."
                  prefix={<Search className="h-5 w-5 text-muted-foreground" />}
                  suffix={
                    query && (
                      <Button
                        type="text"
                        size="small"
                        icon={<X className="h-4 w-4" />}
                        onClick={() => {
                          setQuery('');
                          setHasSearched(false);
                        }}
                      />
                    )
                  }
                  onPressEnter={handleSearch}
                  className="shadow-sm"
                />
              </form>
            </div>

            {/* 过滤器 */}
            {activeFilterCount > 0 && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                {filters.feedId && (
                  <Tag
                    closable
                    onClose={() => clearFilter('feedId')}
                    className="rounded-full"
                  >
                    订阅源: {feeds?.items.find((f) => f.id === filters.feedId)?.title}
                  </Tag>
                )}
                {filters.categoryId && (
                  <Tag
                    closable
                    onClose={() => clearFilter('categoryId')}
                    className="rounded-full"
                  >
                    分类: {categories?.find((c) => c.id === filters.categoryId)?.name}
                  </Tag>
                )}
                {filters.isRead !== undefined && (
                  <Tag
                    closable
                    onClose={() => clearFilter('isRead')}
                    className="rounded-full"
                  >
                    {filters.isRead ? '已读' : '未读'}
                  </Tag>
                )}
                {filters.isStarred && (
                  <Tag
                    closable
                    onClose={() => clearFilter('isStarred')}
                    className="rounded-full"
                  >
                    星标
                  </Tag>
                )}
                <Button type="link" size="small" onClick={handleClearFilters}>
                  清除全部
                </Button>
              </div>
            )}

            {/* 过滤器面板 */}
            {showFilters && (
              <Card size="small" className="mb-6">
                <Space direction="vertical" size="middle" className="w-full">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">订阅源</div>
                    <Select
                      placeholder="全部订阅源"
                      allowClear
                      value={filters.feedId || undefined}
                      onChange={(value) => setFilters({ ...filters, feedId: value || '' })}
                      className="w-full"
                      options={feeds?.items.map((feed) => ({
                        label: feed.title,
                        value: feed.id,
                      }))}
                    />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">分类</div>
                    <Select
                      placeholder="全部分类"
                      allowClear
                      value={filters.categoryId || undefined}
                      onChange={(value) => setFilters({ ...filters, categoryId: value || '' })}
                      className="w-full"
                      options={categories?.map((cat) => ({
                        label: cat.name,
                        value: cat.id,
                      }))}
                    />
                  </div>
                  <div className="flex gap-4">
                    <Button
                      type={filters.isRead === undefined ? 'default' : 'primary'}
                      size="small"
                      onClick={() => setFilters({ ...filters, isRead: filters.isRead === undefined ? true : undefined })}
                    >
                      {filters.isRead === undefined ? '已读/未读' : filters.isRead ? '已读' : '未读'}
                    </Button>
                    <Button
                      type={filters.isStarred ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setFilters({ ...filters, isStarred: !filters.isStarred })}
                    >
                      星标文章
                    </Button>
                  </div>
                </Space>
              </Card>
            )}

            {/* 工具栏 */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {hasSearched && (
                  <span>
                    {isLoading ? '搜索中...' : `找到 ${entries.length} 篇文章`}
                  </span>
                )}
              </div>
              <Button
                icon={<Filter className="h-4 w-4" />}
                onClick={() => setShowFilters(!showFilters)}
                type={showFilters ? 'primary' : 'default'}
              >
                筛选
              </Button>
            </div>

            {/* 搜索结果 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Spin size="large" />
              </div>
            ) : !hasSearched ? (
              <Card className="text-center py-12">
                <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium mb-2">搜索文章</h3>
                <p className="text-muted-foreground text-sm">
                  输入关键词搜索文章标题、内容或标签
                </p>
              </Card>
            ) : entries.length === 0 ? (
              <CompactEntryEmpty message="没有找到匹配的文章" />
            ) : (
              <CompactEntryList>
                {entries.map((entry) => (
                  <CompactEntryItem
                    key={entry.id}
                    id={entry.id}
                    title={entry.title}
                    url={entry.url}
                    feedTitle={entry.feed.title}
                    feedIconUrl={entry.feed.iconUrl}
                    publishedAt={entry.publishedAt}
                    isRead={entry.isRead}
                    isStarred={entry.isStarred}
                    isActive={selectedEntryId === entry.id}
                    onClick={() => router.push(`/entries/${entry.id}`)}
                  />
                ))}
              </CompactEntryList>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <Spin size="large" />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
