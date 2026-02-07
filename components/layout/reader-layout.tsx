/**
 * RSS 阅读器布局
 * 三栏式布局：侧边栏 + 文章列表 + 阅读面板
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { useUserPreferences } from '@/hooks/use-local-storage';
import { useIsMobile } from '@/hooks/use-media-query';
import { useReaderShortcuts } from '@/hooks/use-keyboard';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { EntryList } from '@/components/entries/entry-list';
import { ArticlePreviewPanel } from '@/components/entries/article-preview-panel';
import { ErrorBoundary } from '@/components/error-boundary';

interface ReaderLayoutProps {
  filters?: {
    unreadOnly?: boolean;
    starredOnly?: boolean;
    archivedOnly?: boolean;
    feedId?: string;
    categoryId?: string;
    search?: string;
  };
}

export function ReaderLayout({ filters = {} }: ReaderLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { sidebarCollapsed, setSidebarCollapsed, autoMarkRead } = useUserPreferences();

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 获取 tRPC utils 用于缓存操作
  const utils = trpc.useUtils();

  // 获取当前选中的文章索引
  const { data: entriesData } = trpc.entries.list.useQuery({
    ...filters,
    limit: 50,
  });

  // 定义 mutation（必须在组件顶层）
  const markAsRead = trpc.entries.markAsRead.useMutation();

  const entries = entriesData?.items || [];
  const selectedIndex = entries.findIndex((e) => e.id === selectedEntryId);

  // 键盘快捷键
  useReaderShortcuts({
    onNext: () => {
      if (selectedIndex < entries.length - 1) {
        setSelectedEntryId(entries[selectedIndex + 1].id);
      }
    },
    onPrevious: () => {
      if (selectedIndex > 0) {
        setSelectedEntryId(entries[selectedIndex - 1].id);
      }
    },
    onRefresh: () => handleRefresh(),
    onSearch: () => document.querySelector<HTMLInputElement>('input[type="text"]')?.focus(),
  });

  const handleSelectEntry = useCallback((entryId: string) => {
    setSelectedEntryId(entryId);
    if (autoMarkRead) {
      // 自动标记已读
      markAsRead.mutate({ entryIds: [entryId] });
    }
  }, [autoMarkRead, markAsRead]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 刷新所有相关查询
      await Promise.all([
        utils.entries.list.invalidate({ ...filters, limit: 50 }),
        utils.entries.infiniteList.invalidate({ ...filters, limit: 20 }),
      ]);
    } finally {
      // 延迟一点时间让用户看到刷新动画
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [filters, utils]);

  const handlePrevious = useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedEntryId(entries[selectedIndex - 1].id);
    }
  }, [selectedIndex, entries]);

  const handleNext = useCallback(() => {
    if (selectedIndex < entries.length - 1) {
      setSelectedEntryId(entries[selectedIndex + 1].id);
    }
  }, [selectedIndex, entries]);

  // 移动端：选择文章后跳转到详情页
  const handleMobileSelect = useCallback((entryId: string) => {
    if (isMobile) {
      router.push(`/entries/${entryId}`);
    } else {
      handleSelectEntry(entryId);
    }
  }, [isMobile, router, handleSelectEntry]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <AppHeader
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        isSidebarCollapsed={sidebarCollapsed}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={cn(
            'flex-shrink-0 border-r border-border/60 bg-muted/20 transition-all duration-300',
            sidebarCollapsed ? 'w-16' : 'w-64 hidden md:block'
          )}
        >
          <ErrorBoundary>
            <AppSidebar collapsed={sidebarCollapsed} />
          </ErrorBoundary>
        </aside>

        {/* 文章列表 */}
        <main
          className={cn(
            'flex-1 min-w-0 border-r border-border/60 bg-background flex flex-col overflow-hidden',
            selectedEntryId && 'hidden lg:flex lg:max-w-md xl:max-w-lg'
          )}
        >
          <ErrorBoundary>
            <EntryList
              filters={filters}
              onSelect={handleMobileSelect}
              selectedId={selectedEntryId}
            />
          </ErrorBoundary>
        </main>

        {/* 文章预览面板 - 桌面端 */}
        {!isMobile && (
          <aside className="flex-1 min-w-0 bg-muted/10 hidden lg:block">
            <ErrorBoundary>
              <ArticlePreviewPanel
                entryId={selectedEntryId}
                onPrevious={handlePrevious}
                onNext={handleNext}
                hasPrevious={selectedIndex > 0}
                hasNext={selectedIndex < entries.length - 1}
              />
            </ErrorBoundary>
          </aside>
        )}
      </div>
    </div>
  );
}

export default ReaderLayout;
