/**
 * 主页面 - 书签风格的RSS阅读器
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { EntryCard, EntryCardGrid, EntryCardList } from '@/components/entries/entry-card';
import {
  Grid3X3,
  List,
  Filter,
  BookOpen,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'unread' | 'starred';

export default function HomePage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 获取文章列表
  const { data: entriesData, isLoading } = trpc.entries.list.useQuery({
    page: 1,
    limit: 20,
    unreadOnly: filter === 'unread',
    starredOnly: filter === 'starred',
  });

  // 获取统计信息
  const { data: stats } = trpc.feeds.globalStats.useQuery();

  const handleRefresh = () => {
    // 触发订阅源刷新
    window.location.reload();
  };

  const handleAddFeed = () => {
    router.push('/feeds/add');
  };

  const displayEntries = entriesData?.items || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <AppHeader
        onAddFeed={handleAddFeed}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      <div className="flex">
        {/* 侧边栏 */}
        <div className={cn('hidden md:block', sidebarOpen && 'md:hidden')}>
          <AppSidebar />
        </div>

        {/* 主内容区 */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 过滤器栏 */}
          <div className="mb-8 flex flex-wrap items-center gap-4 animate-fadeIn">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-1">
              <Filter
                className={cn(
                  'h-4 w-4 ml-3 transition-colors',
                  filter !== 'all' ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
                  filter === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                全部
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
                  filter === 'unread'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                未读
              </button>
              <button
                onClick={() => setFilter('starred')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
                  filter === 'starred'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                星标
              </button>
            </div>

            {/* 快速统计 */}
            <div className="flex items-center gap-4 ml-auto text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                <span>{stats?.totalEntries || 0} 篇文章</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                <span>今日新增 {stats?.todayEntries || 0} 篇</span>
              </div>
            </div>
          </div>

          {/* 加载状态 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">加载中...</p>
            </div>
          )}

          {/* 文章列表 */}
          {!isLoading && displayEntries.length > 0 && (
            <>
              {viewMode === 'grid' ? (
                <EntryCardGrid>
                  {displayEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="animate-fadeIn"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <EntryCard
                        id={entry.id}
                        title={entry.title}
                        summary={entry.summary || ''}
                        url={entry.url}
                        feedTitle={entry.feed.title}
                        feedIconUrl={entry.feed.iconUrl}
                        publishedAt={entry.publishedAt}
                        isRead={entry.isRead}
                        isStarred={entry.isStarred}
                        readingTime={entry.readingTime}
                        aiSummary={entry.aiSummary}
                        aiCategory={entry.aiCategory}
                      />
                    </div>
                  ))}
                </EntryCardGrid>
              ) : (
                <EntryCardList>
                  {displayEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="animate-fadeIn"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <EntryCard
                        id={entry.id}
                        title={entry.title}
                        summary={entry.summary || ''}
                        url={entry.url}
                        feedTitle={entry.feed.title}
                        feedIconUrl={entry.feed.iconUrl}
                        publishedAt={entry.publishedAt}
                        isRead={entry.isRead}
                        isStarred={entry.isStarred}
                        readingTime={entry.readingTime}
                        aiSummary={entry.aiSummary}
                        aiCategory={entry.aiCategory}
                      />
                    </div>
                  ))}
                </EntryCardList>
              )}
            </>
          )}

          {/* 空状态 */}
          {!isLoading && displayEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 mb-6 rounded-full bg-muted/50 flex items-center justify-center">
                <BookOpen className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">暂无文章</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {filter === 'unread'
                  ? '太棒了！你已经读完所有文章。'
                  : filter === 'starred'
                  ? '还没有标记任何星标文章'
                  : '还没有添加任何订阅源'}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
