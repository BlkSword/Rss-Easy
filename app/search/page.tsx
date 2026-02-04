/**
 * 搜索页面
 */

'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, X, Clock, TrendingUp } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { EntryList } from '@/components/entries/entry-list';
import { cn } from '@/lib/utils';

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    feedId: '',
    categoryId: '',
    isRead: undefined as boolean | undefined,
    isStarred: false,
    startDate: '',
    endDate: '',
  });

  const { data: suggestions } = trpc.search.suggestions.useQuery(
    { query, limit: 5 },
    { enabled: query.length >= 2 }
  );

  const { data: popularSearches } = trpc.search.popular.useQuery(
    { limit: 10 },
    { enabled: !query }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    router.push(`/search?q=${encodeURIComponent(suggestion)}`);
  };

  const clearFilter = (key: string) => {
    setFilters((prev) => ({ ...prev, [key]: key === 'isRead' ? undefined : '' }));
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== '' && v !== undefined && v !== false
  ).length;

  return (
    <div className="container py-6 max-w-5xl">
      {/* 搜索框 */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文章标题、内容、关键词..."
            className="w-full pl-12 pr-24 py-4 bg-card border rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            搜索
          </button>
        </form>

        {/* 搜索建议 */}
        {query.length >= 2 && suggestions && suggestions.length > 0 && (
          <div className="mt-2 bg-card border rounded-lg overflow-hidden">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        )}

        {/* 热门搜索 */}
        {!query && popularSearches && popularSearches.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>热门搜索</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map((item) => (
                <button
                  key={item.query}
                  onClick={() => handleSuggestionClick(item.query)}
                  className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-full text-sm transition-colors"
                >
                  {item.query}
                  <span className="ml-2 text-xs text-muted-foreground">({item.count})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 过滤器 */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              showFilters || activeFilterCount > 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            <Filter className="h-4 w-4" />
            筛选
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-primary-foreground/20 rounded-full text-xs">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* 活跃过滤器标签 */}
          {activeFilterCount > 0 && (
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              {filters.feedId && (
                <span className="px-3 py-1 bg-secondary rounded-full text-sm flex items-center gap-2">
                  订阅源
                  <button onClick={() => clearFilter('feedId')} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.categoryId && (
                <span className="px-3 py-1 bg-secondary rounded-full text-sm flex items-center gap-2">
                  分类
                  <button onClick={() => clearFilter('categoryId')} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.isRead !== undefined && (
                <span className="px-3 py-1 bg-secondary rounded-full text-sm flex items-center gap-2">
                  {filters.isRead ? '已读' : '未读'}
                  <button onClick={() => clearFilter('isRead')} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.isStarred && (
                <span className="px-3 py-1 bg-secondary rounded-full text-sm flex items-center gap-2">
                  星标
                  <button onClick={() => clearFilter('isStarred')} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* 过滤器面板 */}
        {showFilters && (
          <div className="mt-4 p-4 bg-card border rounded-lg space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">订阅源</label>
                <select
                  value={filters.feedId}
                  onChange={(e) => setFilters({ ...filters, feedId: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary rounded-md"
                >
                  <option value="">全部</option>
                  {/* TODO: 加载订阅源列表 */}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">分类</label>
                <select
                  value={filters.categoryId}
                  onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary rounded-md"
                >
                  <option value="">全部</option>
                  {/* TODO: 加载分类列表 */}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">阅读状态</label>
                <select
                  value={filters.isRead === undefined ? '' : filters.isRead ? 'true' : 'false'}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      isRead: e.target.value === '' ? undefined : e.target.value === 'true',
                    })
                  }
                  className="w-full px-3 py-2 bg-secondary rounded-md"
                >
                  <option value="">全部</option>
                  <option value="false">未读</option>
                  <option value="true">已读</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.isStarred}
                    onChange={(e) => setFilters({ ...filters, isStarred: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium">仅显示星标</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">开始日期</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">结束日期</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary rounded-md"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() =>
                  setFilters({
                    feedId: '',
                    categoryId: '',
                    isRead: undefined,
                    isStarred: false,
                    startDate: '',
                    endDate: '',
                  })
                }
                className="px-4 py-2 text-sm hover:bg-secondary rounded-md transition-colors"
              >
                重置
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                应用
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 搜索结果 */}
      {query && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            搜索结果: "{query}"
          </h2>
          <EntryList filters={{ search: query }} />
        </div>
      )}

      {/* 搜索历史 */}
      {!query && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              搜索历史
            </h2>
            <button className="text-sm text-muted-foreground hover:text-destructive transition-colors">
              清空历史
            </button>
          </div>
          <div className="text-center text-muted-foreground py-8">
            暂无搜索历史
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container py-6">加载中...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
