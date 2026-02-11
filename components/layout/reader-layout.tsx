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
  const { sidebarCollapsed, setSidebarCollapsed } = useUserPreferences();

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
  const markAsRead = trpc.entries.markAsRead.useMutation({
    onMutate: async (vars) => {
      // 取消正在进行的查询
      await Promise.all([
        utils.entries.list.cancel({ ...filters, limit: 50 }),
        utils.entries.infiniteList.cancel({ ...filters, limit: 20 }),
        utils.feeds.globalStats.cancel(),
        utils.categories.list.cancel(),
        utils.feeds.list.cancel({ limit: 100 }),
      ]);

      // 保存当前数据以便回滚
      const previousListData = utils.entries.list.getData({ ...filters, limit: 50 });
      const previousInfiniteData = utils.entries.infiniteList.getData({ ...filters, limit: 20 });
      const previousGlobalStats = utils.feeds.globalStats.getData();
      const previousCategories = utils.categories.list.getData();
      const previousFeeds = utils.feeds.list.getData({ limit: 100 });

      // 乐观更新：立即更新 list 缓存中的数据
      utils.entries.list.setData({ ...filters, limit: 50 }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((item: any) =>
            vars.entryIds.includes(item.id)
              ? { ...item, isRead: true }
              : item
          ),
        };
      });

      // 乐观更新：立即更新 infiniteList 缓存中的数据
      utils.entries.infiniteList.setData({ ...filters, limit: 20 }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: any) =>
              vars.entryIds.includes(item.id)
                ? { ...item, isRead: true }
                : item
            ),
          })),
        };
      });

      // 乐观更新：更新全局未读计数
      utils.feeds.globalStats.setData(undefined, (oldStats: any) => {
        if (!oldStats) return oldStats;
        return {
          ...oldStats,
          unreadCount: Math.max(0, oldStats.unreadCount - vars.entryIds.length),
        };
      });

      // 乐观更新：更新分类和订阅源未读计数
      const currentEntries = entriesData?.items || [];
      utils.categories.list.setData(undefined, (oldData: any) => {
        // oldData 直接是数组，不是包含 categories 属性的对象
        if (!oldData || !Array.isArray(oldData)) return oldData;
        return oldData.map((category: any) => {
          const affectedCount = vars.entryIds.filter((id: string) => {
            const entry = currentEntries.find((e: any) => e.id === id);
            return entry?.feed?.categoryId === category.id;
          }).length;
          return {
            ...category,
            unreadCount: Math.max(0, (category.unreadCount || 0) - affectedCount),
            feeds: category.feeds?.map((feed: any) => {
              const feedAffectedCount = vars.entryIds.filter((id: string) => {
                const entry = currentEntries.find((e: any) => e.id === id);
                return entry?.feedId === feed.id;
              }).length;
              return {
                ...feed,
                unreadCount: Math.max(0, (feed.unreadCount || 0) - feedAffectedCount),
              };
            }),
          };
        });
      });

      utils.feeds.list.setData({ limit: 100 }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((feed: any) => {
            const affectedCount = vars.entryIds.filter((id: string) => {
              const entry = currentEntries.find((e: any) => e.id === id);
              return entry?.feedId === feed.id;
            }).length;
            return {
              ...feed,
              unreadCount: Math.max(0, (feed.unreadCount || 0) - affectedCount),
            };
          }),
        };
      });

      return { previousListData, previousInfiniteData, previousGlobalStats, previousCategories, previousFeeds };
    },
    onSuccess: async () => {
      // 重新验证查询以确保数据同步
      await Promise.all([
        utils.entries.list.invalidate({ ...filters, limit: 50 }),
        utils.entries.infiniteList.invalidate({ ...filters, limit: 20 }),
        utils.feeds.globalStats.invalidate(),
        utils.categories.list.invalidate(),
        utils.feeds.list.invalidate({ limit: 100 }),
      ]);
    },
    onError: (error, _vars, context) => {
      // 出错时回滚到之前的状态
      if (context?.previousListData) {
        utils.entries.list.setData({ ...filters, limit: 50 }, context.previousListData);
      }
      if (context?.previousInfiniteData) {
        utils.entries.infiniteList.setData({ ...filters, limit: 20 }, context.previousInfiniteData);
      }
      if (context?.previousGlobalStats) {
        utils.feeds.globalStats.setData(undefined, context.previousGlobalStats);
      }
      if (context?.previousCategories) {
        utils.categories.list.setData(undefined, context.previousCategories);
      }
      if (context?.previousFeeds) {
        utils.feeds.list.setData({ limit: 100 }, context.previousFeeds);
      }
    },
  });

  const entries = entriesData?.items || [];
  const selectedIndex = entries.findIndex((e) => e.id === selectedEntryId);

  // 键盘快捷键
  useReaderShortcuts({
    onNext: () => {
      if (selectedIndex < entries.length - 1) {
        const nextEntryId = entries[selectedIndex + 1].id;
        setSelectedEntryId(nextEntryId);
        // 点击查看时自动标记为已读
        markAsRead.mutate({ entryIds: [nextEntryId] });
      }
    },
    onPrevious: () => {
      if (selectedIndex > 0) {
        const prevEntryId = entries[selectedIndex - 1].id;
        setSelectedEntryId(prevEntryId);
        // 点击查看时自动标记为已读
        markAsRead.mutate({ entryIds: [prevEntryId] });
      }
    },
    onRefresh: () => handleRefresh(),
    onSearch: () => document.querySelector<HTMLInputElement>('input[type="text"]')?.focus(),
  });

  const handleSelectEntry = useCallback((entryId: string) => {
    setSelectedEntryId(entryId);
    // 点击查看时自动标记为已读
    markAsRead.mutate({ entryIds: [entryId] });
  }, [markAsRead]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 刷新所有相关查询，包括侧边栏统计数据
      await Promise.all([
        // 文章列表
        utils.entries.list.invalidate({ ...filters, limit: 50 }),
        utils.entries.infiniteList.invalidate({ ...filters, limit: 20 }),
        // 侧边栏数据
        utils.feeds.globalStats.invalidate(),
        utils.categories.list.invalidate(),
        utils.feeds.list.invalidate({ limit: 100 }),
      ]);
      // 等待所有查询重新完成
      await Promise.all([
        utils.entries.list.refetch({ ...filters, limit: 50 }),
        utils.feeds.globalStats.refetch(),
      ]);
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      // 延迟一点时间让用户看到刷新动画
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, [filters, utils]);

  const handlePrevious = useCallback(() => {
    if (selectedIndex > 0) {
      const prevEntryId = entries[selectedIndex - 1].id;
      setSelectedEntryId(prevEntryId);
      // 点击查看时自动标记为已读
      markAsRead.mutate({ entryIds: [prevEntryId] });
    }
  }, [selectedIndex, entries, markAsRead]);

  const handleNext = useCallback(() => {
    if (selectedIndex < entries.length - 1) {
      const nextEntryId = entries[selectedIndex + 1].id;
      setSelectedEntryId(nextEntryId);
      // 点击查看时自动标记为已读
      markAsRead.mutate({ entryIds: [nextEntryId] });
    }
  }, [selectedIndex, entries, markAsRead]);

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
