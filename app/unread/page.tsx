/**
 * 未读文章页面 - 三栏布局
 */

'use client';

import { useState, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { CompactEntryList, CompactEntryItem, CompactEntryEmpty } from '@/components/entries/compact-entry-list';
import { ArticlePreviewPanel } from '@/components/entries/article-preview-panel';
import { Button, Tabs } from 'antd';
import { cn } from '@/lib/utils';

export default function UnreadPage() {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setIsSidebarCollapsed(prev => !prev);

  const { data: entriesData, isLoading } = trpc.entries.list.useQuery({
    page: 1,
    limit: 50,
    unreadOnly: true,
  });

  const displayEntries = entriesData?.items || [];
  const selectedIndex = displayEntries.findIndex((e) => e.id === selectedEntryId);

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧栏 */}
        <aside className={cn(
          'w-60 flex-shrink-0 border-r border-border/60 bg-muted/5 transition-all duration-300',
          isSidebarCollapsed ? 'hidden lg:hidden' : 'block'
        )}>
          <AppSidebar />
        </aside>

        {/* 中间栏 - 文章列表 */}
        <section className="flex-1 min-w-0 max-w-lg xl:max-w-xl border-r border-border/60 flex flex-col bg-background/30">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border/60 bg-background/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">未读文章</h2>
              </div>
              <div className="text-xs text-muted-foreground">
                {displayEntries.length} 篇
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center text-sm text-muted-foreground">加载中...</div>
              </div>
            ) : displayEntries.length === 0 ? (
              <CompactEntryEmpty message="太棒了！你已经读完所有文章" />
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

        {/* 右侧栏 - 文章预览 */}
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
