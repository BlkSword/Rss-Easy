'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckSquare,
  Filter,
} from 'lucide-react';
import { Button, Spin, Tabs, Breadcrumb } from 'antd';
import { cn } from '@/lib/utils';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { CompactEntryList, CompactEntryItem, CompactEntryEmpty } from '@/components/entries/compact-entry-list';
import { ArticlePreviewPanel } from '@/components/entries/article-preview-panel';
import { trpc } from '@/lib/trpc/client';
import { useSidebar } from '@/components/providers/sidebar-provider';

type FilterType = 'all' | 'unread' | 'starred';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedParam = searchParams.get('feed');
  const { isCollapsed, toggleSidebar } = useSidebar();

  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const { data: entriesData, isLoading } = trpc.entries.list.useQuery({
    page: 1,
    limit: 50,
    feedId: feedParam || undefined,
    unreadOnly: filter === 'unread',
    starredOnly: filter === 'starred',
  });

  const { data: currentFeed } = trpc.feeds.byId.useQuery(
    { id: feedParam || '' },
    { enabled: !!feedParam }
  );

  const { data: stats } = trpc.feeds.globalStats.useQuery();

  const displayEntries = entriesData?.items || [];
  const selectedIndex = displayEntries.findIndex((e) => e.id === selectedEntryId);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleSelectEntry = useCallback((entryId: string) => {
    setSelectedEntryId(entryId);
  }, []);

  const handlePrevious = useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedEntryId(displayEntries[selectedIndex - 1].id);
    }
  }, [selectedIndex, displayEntries]);

  const handleNext = useCallback(() => {
    if (selectedIndex < displayEntries.length - 1) {
      setSelectedEntryId(displayEntries[selectedIndex + 1].id);
    }
  }, [selectedIndex, displayEntries]);

  const handleClearFilter = () => {
    router.push('/');
  };

  const filterTabs = [
    { key: 'all', label: '全部' },
    { key: 'unread', label: '未读', dot: true },
    { key: 'starred', label: '星标' },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        onToggleSidebar={toggleSidebar}
        isSidebarCollapsed={isCollapsed}
      />

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={cn(
            'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
            isCollapsed ? 'hidden lg:hidden' : 'block'
          )}
        >
          <AppSidebar />
        </aside>

        <section className="flex-1 min-w-0 max-w-lg xl:max-w-xl border-r border-border/60 flex flex-col bg-background/30">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border/60 bg-background/50 backdrop-blur-sm">
            {feedParam && currentFeed && (
              <div className="mb-3">
                <Breadcrumb
                  items={[
                    { title: <a href="/">全部文章</a> },
                    { title: currentFeed.title },
                  ]}
                  className="text-xs"
                />
              </div>
            )}

            <div className="mb-3">
              <Tabs
                activeKey={filter}
                onChange={(value) => setFilter(value as FilterType)}
                items={filterTabs}
                size="small"
                className="feed-filter-tabs"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {displayEntries.length > 0 && (
                  <span>
                    {feedParam && <span>{currentFeed?.title} · </span>}
                    {filter === 'unread' && '未读 '}
                    {filter === 'starred' && '星标 '}
                    文章 {displayEntries.length} 篇
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {feedParam && (
                  <Button
                    type="text"
                    size="small"
                    icon={<Filter className="h-3 w-3" />}
                    onClick={handleClearFilter}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    全部
                  </Button>
                )}

                {filter === 'unread' && displayEntries.length > 0 && (
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckSquare className="h-4 w-4" />}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    全部已读
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Spin size="large" />
                  <p className="text-sm text-muted-foreground mt-4">加载中...</p>
                </div>
              </div>
            ) : displayEntries.length === 0 ? (
              <CompactEntryEmpty
                message={
                  feedParam
                    ? '该订阅源暂无文章'
                    : filter === 'unread'
                    ? '太棒了！你已经读完所有文章。'
                    : filter === 'starred'
                    ? '还没有标记任何星标文章'
                    : '还没有添加任何订阅源'
                }
              />
            ) : (
              <CompactEntryList>
                {displayEntries.map((entry) => (
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
                    onClick={() => handleSelectEntry(entry.id)}
                  />
                ))}
              </CompactEntryList>
            )}
          </div>
        </section>

        <aside className="flex-1 min-w-0 bg-background/10 hidden md:block">
          <ArticlePreviewPanel
            entryId={selectedEntryId}
            onPrevious={handlePrevious}
            onNext={handleNext}
            hasPrevious={selectedIndex > 0}
            hasNext={selectedIndex < displayEntries.length - 1}
          />
        </aside>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
